/**
 * POST /api/tax/wht-import
 *
 * Bulk insert from the JTC WHT one-sheet integrated import flow.
 * Receives ClassifiedRow[] (already parsed + classified client-side) and
 * routes each row to the appropriate target table:
 *
 *   pph23_jasa   → pph23_transaction (service_type=JASA_LAINNYA, income_type=JASA_LAINNYA, tax_regime=PPH23, rate=0.02)
 *   pph23_sewa   → pph23_transaction (service_type=SEWA, income_type=SEWA, tax_regime=PPH4_2, rate=0.02)
 *   pph4_2_sewa  → pph23_transaction (service_type=SEWA, income_type=SEWA, tax_regime=PPH4_2, rate=0.10,
 *                                     description prefixed with '[PPh4(2)]')
 *   pph26        → pph26_transaction (income_type=service, applied_rate=0.20)
 *
 * If row.vatInsert: also writes ppn_faktur_monthly (MASUKAN). PPN duplicate
 * check uses (customer_id, tax_period, counterparty_npwp, faktur_number).
 *
 * Partial failure: per-row try/catch. Skipped rows (classified='unknown' or
 * checkbox off via include=false) excluded entirely. Failed rows reported
 * via results.failed[].
 *
 * Audit: WHT_IMPORT (single audit_log row covering the whole upload).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { ClassifiedRow, ClassifiedType } from '@/lib/tax/bulk-import/wht-onesheet-parser';

interface ImportBody {
  customerId?: string;
  taxPeriod?: string;
  rows?: Array<ClassifiedRow & { include?: boolean }>;
}

interface ImportResult {
  insertedPph23: number;
  insertedPph26: number;
  insertedPph42: number;
  insertedPpn: number;
  skipped: number;
  failed: Array<{ rowNo: number; reason: string }>;
}

const PPH23_SUPERVISOR_OK = [
  UserRole.CUSTOMER,
  UserRole.CONSULTANT_JTC,
  UserRole.TAX_ADVISOR_JTC,
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

function isValidPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2]|99)$/.test(s);
}

/**
 * Resolve which customer the request can write to. Customers can only write
 * to their own row (use session.customerId or look up by user_id). Higher
 * roles can write to any customer they pass.
 */
async function resolveCustomerId(
  req: RequestWithSession,
  requested: string,
): Promise<{ ok: true; customerId: string } | { ok: false; status: number; error: string }> {
  if (req.session?.role === UserRole.CUSTOMER) {
    let own = req.session?.customerId;
    if (!own && req.session?.userId) {
      const { data } = await getSupabaseAdmin()
        .from('customer')
        .select('id')
        .eq('user_id', req.session.userId)
        .maybeSingle();
      own = data?.id;
    }
    if (!own) return { ok: false, status: 404, error: 'customer not found' };
    if (requested && requested !== own) {
      return { ok: false, status: 403, error: 'cannot write to other customer' };
    }
    return { ok: true, customerId: own };
  }
  if (!requested) return { ok: false, status: 400, error: 'customerId required' };
  return { ok: true, customerId: requested };
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 });
  }

  const { customerId: reqCustomerId = '', taxPeriod = '', rows } = body;
  if (!Array.isArray(rows)) {
    return NextResponse.json({ success: false, error: 'rows[] required' }, { status: 400 });
  }
  if (!isValidPeriod(taxPeriod)) {
    return NextResponse.json({ success: false, error: 'taxPeriod must be YYYY-MM' }, { status: 400 });
  }

  const resolved = await resolveCustomerId(req, reqCustomerId);
  if (!resolved.ok) {
    return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
  }
  const customerId = resolved.customerId;

  const sb = getSupabaseAdmin();
  const result: ImportResult = {
    insertedPph23: 0,
    insertedPph26: 0,
    insertedPph42: 0,
    insertedPpn: 0,
    skipped: 0,
    failed: [],
  };

  for (const row of rows) {
    const rowNo = row?.no ?? 0;
    try {
      // Skip if user unchecked or row was 'unknown'
      const include = row.include !== false;
      if (!include || row.classified === 'unknown') {
        result.skipped++;
        continue;
      }

      const txDate = row.dates?.invoice ?? row.dates?.payment ?? null;
      if (!txDate) {
        result.failed.push({ rowNo, reason: 'no transaction date' });
        continue;
      }
      if (!row.wht || !(row.wht.base > 0)) {
        result.failed.push({ rowNo, reason: 'no WHT base (col O = 0)' });
        continue;
      }

      // Companion PPN insert (independent of PPh dispatch)
      if (row.vatInsert) {
        const fakturNo = row.invoice?.fakturNo || '';
        const vendorNpwp = row.vendor?.npwp || '';

        // Duplicate check (best-effort; ignore errors)
        let duplicate = false;
        try {
          const { data: existing } = await sb
            .from('ppn_faktur_monthly')
            .select('id')
            .eq('customer_id', customerId)
            .eq('tax_period', taxPeriod)
            .eq('counterparty_npwp', vendorNpwp)
            .eq('faktur_number', fakturNo)
            .limit(1);
          duplicate = !!(existing && existing.length > 0);
        } catch {
          duplicate = false;
        }

        if (!duplicate) {
          const { error: ppnErr } = await sb.from('ppn_faktur_monthly').insert({
            customer_id: customerId,
            tax_period: taxPeriod,
            faktur_type: 'MASUKAN',
            faktur_number: fakturNo || null,
            faktur_date: txDate,
            counterparty_name: row.vendor?.nama || '',
            counterparty_npwp: vendorNpwp || null,
            dpp: row.vat?.dpp ?? 0,
            ppn: row.vat?.ppn ?? 0,
            is_luxury: false,
            status: 'PENDING',
          });
          if (ppnErr) {
            // Don't fail the whole row — log + continue with PPh.
            loggers.api.warn({ rowNo, err: ppnErr.message }, 'wht-import: PPN insert failed');
          } else {
            result.insertedPpn++;
          }
        }
      }

      // PPh dispatch
      const vendorName = row.vendor?.nama || '';
      const vendorNpwp = row.vendor?.npwp || '';
      const description = row.invoice?.description || row.notes || '';
      const invoiceNo = row.invoice?.invoiceNo || null;
      const taxBase = row.wht.base;

      if (row.classified === 'pph23_jasa') {
        const rate = 0.02;
        const taxAmount = Math.round(taxBase * rate);
        const { error } = await sb.from('pph23_transaction').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          transaction_date: txDate,
          description,
          service_type: 'JASA_LAINNYA',
          income_type: 'JASA_LAINNYA',
          tax_regime: 'PPH23',
          invoice_number: invoiceNo,
          gross_amount: taxBase,
          tax_rate: rate,
          tax_amount: taxAmount,
          counterparty_name: vendorName,
          counterparty_npwp: vendorNpwp || null,
        });
        if (error) throw error;
        result.insertedPph23++;
      } else if (row.classified === 'pph23_sewa') {
        const rate = 0.02;
        const taxAmount = Math.round(taxBase * rate);
        const { error } = await sb.from('pph23_transaction').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          transaction_date: txDate,
          description,
          service_type: 'SEWA',
          income_type: 'SEWA',
          tax_regime: 'PPH4_2',
          rental_asset_type: 'OTHER',
          invoice_number: invoiceNo,
          gross_amount: taxBase,
          tax_rate: rate,
          tax_amount: taxAmount,
          counterparty_name: vendorName,
          counterparty_npwp: vendorNpwp || null,
        });
        if (error) throw error;
        result.insertedPph23++;
      } else if (row.classified === 'pph4_2_sewa') {
        const rate = 0.10;
        const taxAmount = Math.round(taxBase * rate);
        const markedDesc = `[PPh4(2)] ${description}`.trim();
        const { error } = await sb.from('pph23_transaction').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          transaction_date: txDate,
          description: markedDesc,
          service_type: 'SEWA',
          income_type: 'SEWA',
          tax_regime: 'PPH4_2',
          rental_asset_type: 'BUILDING_LAND',
          invoice_number: invoiceNo,
          gross_amount: taxBase,
          tax_rate: rate,
          tax_amount: taxAmount,
          counterparty_name: vendorName,
          counterparty_npwp: vendorNpwp || null,
        });
        if (error) throw error;
        result.insertedPph42++;
      } else if (row.classified === 'pph26') {
        const rate = 0.20;
        const taxAmount = Math.round(taxBase * rate);
        const { error } = await sb.from('pph26_transaction').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          transaction_date: txDate,
          description,
          income_type: 'service',
          invoice_number: invoiceNo,
          gross_amount: taxBase,
          standard_rate: 0.20,
          applied_rate: rate,
          tax_amount: taxAmount,
          recipient_name: vendorName,
          recipient_npwp: vendorNpwp || null,
          treaty_applied: false,
          has_cod: false,
        });
        if (error) throw error;
        result.insertedPph26++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.failed.push({ rowNo, reason });
      loggers.api.warn({ rowNo, reason }, 'wht-import: row insert failed');
    }
  }

  loggers.api.info({
    customerId,
    taxPeriod,
    totalRows: rows.length,
    ...result,
  }, 'wht-import: done');

  return NextResponse.json({ success: true, data: result });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...(PPH23_SUPERVISOR_OK as unknown as UserRole[])),
    withAudit('WHT_IMPORT'),
  )(request as RequestWithSession, handlePost);
}

// Classified types re-exported in case tests want it
export type { ClassifiedType };
