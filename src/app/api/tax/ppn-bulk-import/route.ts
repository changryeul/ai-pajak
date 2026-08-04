/**
 * POST /api/tax/ppn-bulk-import
 *
 * Wholesale VAT compliance importer endpoint — accepts two CSVs (OUT + IN)
 * produced by `importPpnWholesaleFile` and inserts them into
 * `ppn_faktur_monthly` with the correct `faktur_type`.
 *
 * Why a new endpoint (Q3 = B):
 *   - Single-faktur entry path (POST /api/tax/ppn-faktur-monthly) was added
 *     for a different shape (one row per request, UI-side total + ppn). Bulk
 *     import must preserve the file's raw VAT (some periods are 12%, and some
 *     rows are PPN Tidak Dipungut where VAT ≠ dpp × rate).
 *   - Keeps single-faktur entry path untouched.
 *
 * Body shape:
 *   { customerId?, taxPeriod: 'YYYY-MM', outCsv?: string, inCsv?: string }
 *   At least one of outCsv / inCsv must be non-empty.
 *
 * Validation policy:
 *   - reuse `validatePPNRows` (csv-parser) for shared shape checks
 *   - ppn fallback: if file's VAT cell is empty/0 → server applies 12%
 *     (current Indonesian PMK rate; see PMK 131/2024)
 *   - ≤500 rows per section (mirrors PPh23 limit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';
import { loggers } from '@/lib/logger';
import { parseCSV, validatePPNRows } from '@/lib/tax/bulk-import/csv-parser';
import { PPNCalculator } from '@/lib/tax/ppn-calculator';
import type { RequestWithSession } from '@/types/auth';

interface RequestBody {
  customerId?: string;
  taxPeriod: string;     // YYYY-MM
  outCsv?: string;       // KELUARAN
  inCsv?: string;        // MASUKAN
  mode?: 'replace' | 'append'; // 2026-06-22: default 'append' (backward compat)
}

interface SectionError {
  rowNumber: number;
  section: 'KELUARAN' | 'MASUKAN';
  errors: string[];
}

interface SectionResult {
  inserted: number;
  errors: SectionError[];
  luxuryCount: number;
}

// Fallback rate when file's VAT cell is empty/zero. 0.12 = current Indonesian
// PMK 131/2024 standard rate. If the calculation should use 11% or 0, the file
// already carries the right value — the fallback only fires when missing.
const MAX_ROWS_PER_SECTION = 500;

async function processSection(
  csv: string | undefined,
  fakturType: 'KELUARAN' | 'MASUKAN',
  customerId: string,
  taxPeriod: string,
): Promise<SectionResult> {
  if (!csv || csv.trim().length === 0) {
    return { inserted: 0, errors: [], luxuryCount: 0 };
  }

  const parsed = parseCSV(csv);
  if (parsed.rows.length === 0) {
    return { inserted: 0, errors: [], luxuryCount: 0 };
  }
  if (parsed.rows.length > MAX_ROWS_PER_SECTION) {
    return {
      inserted: 0,
      errors: [{
        rowNumber: 0,
        section: fakturType,
        errors: [`Too many rows (${parsed.rows.length}) for ${fakturType} — max ${MAX_ROWS_PER_SECTION} per section`],
      }],
      luxuryCount: 0,
    };
  }

  // Run shared validation — checks faktur_date / counterparty_name / dpp.
  // We intentionally do NOT set faktur_type per-row (importer CSV omits it);
  // the validator's default 'KELUARAN' satisfies its check, and the row gets
  // the correct type via the explicit insert below.
  const validated = validatePPNRows(parsed);

  // 2026-06-29: 자동 luxury 분류 OFF — 사용자가 false-positive 에 짜증나는
  // 사례가 누적되어 정책 변경. 모든 import 행은 essential (일반) 로 들어가고,
  // 사치품은 inline-edit 토글로 사용자가 명시적으로 표시한다.
  // 이전: classifyLuxuryBatch(description) → 키워드 substring 매칭.
  // 이전 stop-list 강화에도 한계가 명확해 단순 default false 가 더 안전.
  const sb = getSupabaseAdmin();
  const validRows = validated.rows.filter((r) => r.isValid);

  const inserts = validRows.map((r) => {
    const dppNum = parseFloat(r.data.dpp);
    let ppnNum = parseFloat(r.data.ppn ?? '');
    if (!Number.isFinite(ppnNum) || ppnNum === 0) {
      // Essential 기본 → PMK 131/2024 effective 11% × dpp.
      // (luxury 면 12% × dpp 인데 default false 라 그쪽 분기 안 탐.)
      ppnNum = Math.round(dppNum * 0.11);
    }
    const isLuxury = false;
    const dppNilaiLainFromFile = parseFloat(r.data.dpp_nilai_lain ?? '');
    const dppNilaiLain = Number.isFinite(dppNilaiLainFromFile) && dppNilaiLainFromFile > 0
      ? Math.round(dppNilaiLainFromFile)
      : PPNCalculator.adjustDPP(dppNum, new Date(r.data.faktur_date), isLuxury);
    return {
      customer_id: customerId,
      tax_period: taxPeriod,
      faktur_type: fakturType,
      faktur_number: r.data.faktur_number || null,
      faktur_date: r.data.faktur_date,
      counterparty_name: r.data.counterparty_name || null,
      counterparty_npwp: r.data.counterparty_npwp || null,
      // 2026-06-26: PPN 양식에서 수집되지만 그동안 버려졌던 설명. 상세에서 surface.
      description: r.data.description || null,
      dpp: dppNum,
      dpp_nilai_lain: dppNilaiLain,
      is_luxury: isLuxury,
      ppn: Math.round(ppnNum),
    };
  });

  const luxuryCount = 0;
  let inserted = 0;
  const errors: SectionError[] = [];

  if (inserts.length > 0) {
    const { count, error } = await sb
      .from('ppn_faktur_monthly')
      .insert(inserts, { count: 'exact' });
    if (error) {
      loggers.tax.error(
        { err: error, fakturType, customerId, taxPeriod, attempted: inserts.length },
        'PPN bulk insert failed',
      );
      errors.push({ rowNumber: 0, section: fakturType, errors: [error.message] });
    } else {
      inserted = count ?? inserts.length;
    }
  }

  // Surface up to 50 row-level validation errors so the UI can show actionable
  // feedback without flooding the JSON response.
  validated.rows
    .filter((r) => !r.isValid)
    .slice(0, 50)
    .forEach((r) => {
      errors.push({
        rowNumber: r.rowNumber,
        section: fakturType,
        errors: r.errors,
      });
    });

  return { inserted, errors, luxuryCount };
}

async function handle(req: RequestWithSession): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { taxPeriod } = body;

  // customerId precedence: explicit body wins, else lookup for CUSTOMER role.
  const sb = getSupabaseAdmin();
  let customerId = body.customerId;
  if (!customerId && req.session.role === 'CUSTOMER') {
    const { data } = await sb
      .from('customer')
      .select('id')
      .eq('user_id', req.session.userId)
      .maybeSingle();
    customerId = data?.id;
  }
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
  }
  if (!taxPeriod || !/^\d{4}-\d{2}$/.test(taxPeriod)) {
    return NextResponse.json(
      { success: false, error: 'taxPeriod (YYYY-MM) required' },
      { status: 400 },
    );
  }
  if (!body.outCsv && !body.inCsv) {
    return NextResponse.json(
      { success: false, error: 'outCsv or inCsv required' },
      { status: 400 },
    );
  }

  // 2026-06-22: mode='replace' 면 기존 행 삭제 후 insert
  let deleted = 0;
  if (body.mode === 'replace') {
    const { count, error: delErr } = await sb
      .from('ppn_faktur_monthly')
      .delete({ count: 'exact' })
      .eq('customer_id', customerId)
      .eq('tax_period', taxPeriod);
    if (delErr) {
      return NextResponse.json({ success: false, error: `replace delete failed: ${delErr.message}` }, { status: 500 });
    }
    deleted = count ?? 0;
  }

  const outResult = await processSection(body.outCsv, 'KELUARAN', customerId, taxPeriod);
  const inResult = await processSection(body.inCsv, 'MASUKAN', customerId, taxPeriod);

  // 고객 PPN 일괄 임포트 → 담당 상담원 업무함에 PPN 큐 자동 노출 (best-effort).
  await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPN', taxPeriod);

  return NextResponse.json({
    success: true,
    data: {
      mode: body.mode ?? 'append',
      deleted,
      outInserted: outResult.inserted,
      inInserted: inResult.inserted,
      luxuryClassified: outResult.luxuryCount + inResult.luxuryCount,
      errors: [...outResult.errors, ...inResult.errors],
      taxPeriod,
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    withAudit('PPN_BULK_IMPORT'),
  )(request as RequestWithSession, handle);
}
