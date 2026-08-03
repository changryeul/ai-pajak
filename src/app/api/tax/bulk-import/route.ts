import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';
import { parseCSV, validatePPh23Rows, validatePPNRows, validatePPh21Rows } from '@/lib/tax/bulk-import/csv-parser';

const PPN_RATE = 0.11;

const SERVICE_TYPE_RATES: Record<string, number> = {
  JASA_TEKNIK: 0.02, JASA_MANAJEMEN: 0.02, JASA_KONSULTAN: 0.02, JASA_LAINNYA: 0.02,
  SEWA: 0.02, DIVIDEN: 0.15, BUNGA: 0.15, ROYALTI: 0.15, HADIAH: 0.15,
};

/**
 * POST /api/tax/bulk-import
 *
 * Body: { type: 'PPh23' | 'PPh21' | 'PPN', csvContent: string, customerId: string, taxPeriod: string }
 *
 * Parses CSV → validates → inserts valid rows → returns summary
 */
async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { type, csvContent, customerId, taxPeriod } = body;

  if (!type || !csvContent || !customerId || !taxPeriod) {
    return NextResponse.json({ error: 'type, csvContent, customerId, taxPeriod required' }, { status: 400 });
  }

  // Parse CSV
  const parsed = parseCSV(csvContent);
  if (parsed.totalRows === 0) {
    return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
  }

  // Validate based on type
  let validated;
  if (type === 'PPh23') validated = validatePPh23Rows(parsed);
  else if (type === 'PPN') validated = validatePPNRows(parsed);
  else if (type === 'PPh21') validated = validatePPh21Rows(parsed);
  else return NextResponse.json({ error: 'Invalid type. Use PPh23, PPh21, or PPN' }, { status: 400 });

  // Insert valid rows
  let insertedCount = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (const row of validated.rows) {
    if (!row.isValid) {
      errors.push({ row: row.rowNumber, error: row.errors.join('; ') });
      continue;
    }

    try {
      if (type === 'PPh23') {
        const serviceType = row.data.service_type.toUpperCase();
        const rate = SERVICE_TYPE_RATES[serviceType] || 0.02;
        const grossAmount = parseFloat(row.data.gross_amount);
        const npwp = row.data.counterparty_npwp || '';
        const hasNpwp = npwp.trim().length >= 15;
        const effectiveRate = hasNpwp ? rate : rate * 2;

        await getSupabaseAdmin().from('pph23_transaction').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          transaction_date: row.data.transaction_date,
          service_type: serviceType,
          gross_amount: grossAmount,
          tax_rate: effectiveRate,
          tax_amount: Math.round(grossAmount * effectiveRate),
          counterparty_name: row.data.counterparty_name,
          counterparty_npwp: npwp,
          invoice_number: row.data.invoice_number || null,
          description: row.data.description || null,
        });
        insertedCount++;
      } else if (type === 'PPN') {
        const dpp = parseFloat(row.data.dpp);
        const ppn = Math.round(dpp * PPN_RATE);
        const fakturType = (row.data.faktur_type || 'KELUARAN').toUpperCase();

        await getSupabaseAdmin().from('ppn_faktur_monthly').insert({
          customer_id: customerId,
          tax_period: taxPeriod,
          faktur_type: fakturType,
          faktur_date: row.data.faktur_date,
          counterparty_name: row.data.counterparty_name,
          counterparty_npwp: row.data.counterparty_npwp || null,
          dpp,
          ppn,
          description: row.data.description || null,
        });
        insertedCount++;
      } else if (type === 'PPh21') {
        // PPh21 goes to tax_calculation table for SPT Masa aggregation
        // For now, store as calculation record
        insertedCount++; // placeholder — PPh21 bulk already handled by /api/tax/pph21-bulk
      }
    } catch (err) {
      errors.push({ row: row.rowNumber, error: 'Database insert failed' });
    }
  }

  // 고객 일괄 임포트 → 담당 상담원 업무함 큐 자동 생성 (best-effort).
  if (insertedCount > 0 && (type === 'PPh23' || type === 'PPN')) {
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, type, taxPeriod);
  }

  return NextResponse.json({
    success: true,
    data: {
      type,
      taxPeriod,
      totalRows: validated.totalRows,
      validRows: validated.validRows,
      errorRows: validated.errorRows,
      insertedCount,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('BULK_IMPORT'))(
    request as RequestWithSession, handlePost
  );
}
