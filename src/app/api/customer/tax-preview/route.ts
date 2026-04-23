import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import { calculateProgressiveTax } from '@/lib/tax/shared/tax-utils';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/customer/tax-preview
 *
 * Returns a lightweight estimation card data used on /my-profile:
 *   - bruto: A1 gross + additional income from the most recent annual draft
 *   - ptkpAmount: PTKP lookup from customer.ptkp_status
 *   - pkp: max(0, bruto - ptkp)
 *   - estimatedTax: progressive tax on pkp
 *
 * Returns zeros if no draft exists yet.
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('id, ptkp_status')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const ptkpStatus = (customer.ptkp_status as PTKPStatus) || 'TK/0';
    const ptkpAmount = PTKP_RATES[ptkpStatus] ?? PTKP_RATES['TK/0'];

    const { data: filings } = await admin
      .from('tax_filing')
      .select('id, tax_type, tax_data, tax_year, created_at')
      .eq('customer_id', customer.id)
      .in('tax_type', ['SPT_TAHUNAN'])
      .order('created_at', { ascending: false })
      .limit(1);

    let bruto = 0;
    let sourceYear: number | null = null;
    if (filings && filings.length > 0) {
      const f = filings[0];
      sourceYear = f.tax_year ?? null;
      const td = (f.tax_data || {}) as Record<string, unknown>;
      const grossIncome = typeof td.grossIncome === 'number' ? td.grossIncome : 0;
      const additional = Array.isArray(td.additionalIncome)
        ? (td.additionalIncome as Array<{ amount?: number }>).reduce(
            (sum, row) => sum + (typeof row?.amount === 'number' ? row.amount : 0),
            0,
          )
        : 0;
      bruto = grossIncome + additional;
    }

    const pkp = Math.max(0, bruto - ptkpAmount);
    const estimatedTax = calculateProgressiveTax(pkp);

    return Response.json({
      success: true,
      data: {
        bruto,
        ptkpStatus,
        ptkpAmount,
        pkp,
        estimatedTax,
        sourceYear,
        hasDraft: bruto > 0,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Tax preview fetch failed');
    return Response.json({ error: 'Failed to fetch tax preview' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleGet);
}
