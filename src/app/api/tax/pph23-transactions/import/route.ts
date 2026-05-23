import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { parseCSV, validatePPh23Rows, type ParsedRow } from '@/lib/tax/bulk-import/csv-parser';
import type { RequestWithSession } from '@/types/auth';

/**
 * POST /api/tax/pph23-transactions/import
 *
 * 사용자가 작성한 거래 목록을 한 번에 PPh 23 거래로 등록한다.
 * 두 가지 입력 방식 모두 지원 — OCR 결과도 같은 path 로 정규화 가능:
 *
 *   1. { customerId, taxPeriod, csvContent: string } — Papa.parse 로 파싱
 *   2. { customerId, taxPeriod, rows: ImportRow[] }    — OCR / 수동 변환된 행
 *
 * 단순화 정책:
 *   - bulk 는 표준 rate (2% / 15%) 만 적용. 단건 입력 시의 TaxResolutionEngine 정밀 계산
 *     (CoD/DGT/주주관계 등) 은 적용하지 않는다.
 *   - 검증 실패 행은 insert 하지 않고 errors 배열로 반환.
 *   - counterparty_id 는 import 단계에서 매칭하지 않음 (필요시 별도 화면에서).
 */

interface ImportRow {
  transaction_date: string;       // 'YYYY-MM-DD'
  service_type: string;           // JASA_*, SEWA, DIVIDEN, BUNGA, ROYALTI, HADIAH
  gross_amount: number | string;
  counterparty_name: string;
  counterparty_npwp?: string;
  invoice_number?: string;
  description?: string;
}

interface RequestBody {
  customerId?: string;
  taxPeriod: string;            // 'YYYY-MM'
  csvContent?: string;
  rows?: ImportRow[];
}

const FINAL_RATE_TYPES = new Set(['DIVIDEN', 'BUNGA', 'ROYALTI', 'HADIAH']);

function rateFor(serviceType: string): number {
  return FINAL_RATE_TYPES.has(serviceType) ? 0.15 : 0.02;
}

function rowsFromBody(body: RequestBody): { rows: ParsedRow[]; headers: string[] } | null {
  if (typeof body.csvContent === 'string' && body.csvContent.trim().length > 0) {
    const parsed = parseCSV(body.csvContent);
    return { rows: parsed.rows, headers: parsed.headers };
  }
  if (Array.isArray(body.rows)) {
    const headers = ['transaction_date', 'service_type', 'gross_amount', 'counterparty_name', 'counterparty_npwp', 'invoice_number', 'description'];
    const rows: ParsedRow[] = body.rows.map((r, idx) => ({
      rowNumber: idx + 1,
      data: {
        transaction_date: String(r.transaction_date ?? ''),
        service_type: String(r.service_type ?? ''),
        gross_amount: String(r.gross_amount ?? ''),
        counterparty_name: String(r.counterparty_name ?? ''),
        counterparty_npwp: String(r.counterparty_npwp ?? ''),
        invoice_number: String(r.invoice_number ?? ''),
        description: String(r.description ?? ''),
      },
      errors: [],
      isValid: true,
    }));
    return { rows, headers };
  }
  return null;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { taxPeriod } = body;

  // customerId 우선순위: body 우선, 없으면 CUSTOMER 자기 customer 로 lookup.
  const sb = getSupabaseAdmin();
  let customerId = body.customerId;
  if (!customerId && req.session.role === 'CUSTOMER') {
    const { data } = await sb.from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
    customerId = data?.id;
  }
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
  }
  if (!taxPeriod || !/^\d{4}-\d{2}$/.test(taxPeriod)) {
    return NextResponse.json({ success: false, error: 'taxPeriod (YYYY-MM) required' }, { status: 400 });
  }

  const inputBundle = rowsFromBody(body);
  if (!inputBundle) {
    return NextResponse.json(
      { success: false, error: 'Either csvContent or rows is required' },
      { status: 400 },
    );
  }
  if (inputBundle.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No input rows' },
      { status: 400 },
    );
  }
  if (inputBundle.rows.length > 500) {
    return NextResponse.json(
      { success: false, error: 'At most 500 rows per request' },
      { status: 400 },
    );
  }

  // 공통 validation 으로 통과시킴 — CSV/OCR 어느 경로든 같은 검증 통과.
  const validated = validatePPh23Rows({
    rows: inputBundle.rows,
    totalRows: inputBundle.rows.length,
    validRows: inputBundle.rows.length,
    errorRows: 0,
    headers: inputBundle.headers,
  });

  // 유효 행만 insert payload 로 변환.
  const inserts = validated.rows
    .filter((r) => r.isValid)
    .map((r) => {
      const serviceType = r.data.service_type.toUpperCase();
      const gross = parseFloat(r.data.gross_amount);
      const rate = rateFor(serviceType);
      const taxAmount = Math.round(gross * rate);
      return {
        customer_id: customerId,
        tax_period: taxPeriod,
        transaction_date: r.data.transaction_date,
        description: r.data.description || null,
        service_type: serviceType,
        invoice_number: r.data.invoice_number || null,
        gross_amount: gross,
        tax_rate: rate,
        tax_amount: taxAmount,
        counterparty_name: r.data.counterparty_name || null,
        counterparty_npwp: r.data.counterparty_npwp || null,
      };
    });

  let insertedCount = 0;
  let insertError: string | null = null;
  if (inserts.length > 0) {
    const { error, count } = await sb
      .from('pph23_transaction')
      .insert(inserts, { count: 'exact' });
    if (error) {
      insertError = error.message;
      loggers.tax.error({ err: error, customerId, taxPeriod }, 'PPh23 bulk insert failed');
    } else {
      insertedCount = count ?? inserts.length;
    }
  }

  // error rows 정리 — 사용자에게 어떤 행이 왜 빠졌는지 알려줌.
  const errors = validated.rows
    .filter((r) => !r.isValid)
    .slice(0, 50) // 응답 크기 보호
    .map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.errors,
      data: r.data,
    }));

  return NextResponse.json({
    success: insertError == null,
    data: {
      totalRows: validated.totalRows,
      validRows: validated.validRows,
      errorRows: validated.errorRows,
      insertedCount,
      errors,
      insertError,
      taxPeriod,
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    withAudit('PPH23_BULK_IMPORT'),
  )(request as RequestWithSession, handle);
}
