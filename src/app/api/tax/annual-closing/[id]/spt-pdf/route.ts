import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { generateSptSummaryPdf } from '@/lib/tax/closing-statements/spt-summary-pdf';
import type { RequestWithSession } from '@/types/auth';

interface SessionData {
  companyName?: string;
  npwp?: string;
  fiscalYear?: number;
  annualRevenue?: number;
  cogs?: number;
  salary?: number;
  opex?: number;
  petty?: number;
  deprec?: number;
  pph22?: number;
  pph23?: number;
  pph24?: number;
  pph25?: number;
}

async function handle(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data: session } = await sb
    .from('tax_closing_session')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!session || session.customer_id !== customerId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data: customer } = await sb
    .from('customer')
    .select('full_name, company_name, npwp, address')
    .eq('id', customerId)
    .single();

  const { data: adjustments } = await sb
    .from('closing_adjustment_entry')
    .select('direction, amount')
    .eq('session_id', sessionId);

  const data = (session.data ?? {}) as SessionData;
  const sales = Number(data.annualRevenue ?? 0);
  const cogs = Number(data.cogs ?? 0);
  const salary = Number(data.salary ?? 0);
  const opex = Number(data.opex ?? 0);
  const petty = Number(data.petty ?? 0);
  const deprec = Number(data.deprec ?? 0);
  const accountingIncome = sales - cogs - salary - opex - petty - deprec;

  const positiveSum = (adjustments ?? [])
    .filter((e) => e.direction === 'POSITIVE')
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const negativeSum = (adjustments ?? [])
    .filter((e) => e.direction === 'NEGATIVE')
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const pkp = Math.max(0, accountingIncome + positiveSum - negativeSum);

  const eligibleSme = sales > 0 && sales < 50_000_000_000;
  let pphBadan = 0;
  if (pkp > 0) {
    if (eligibleSme && sales > 0) {
      const discountedShare = Math.min(sales, 4_800_000_000) / sales;
      pphBadan = Math.round(pkp * discountedShare * 0.22 * 0.5 + pkp * (1 - discountedShare) * 0.22);
    } else {
      pphBadan = Math.round(pkp * 0.22);
    }
  }

  const pph22 = Number(data.pph22 ?? 0);
  const pph23 = Number(data.pph23 ?? 0);
  const pph24 = Number(data.pph24 ?? 0);
  const pph25 = Number(data.pph25 ?? 0);
  const settlement = pphBadan - (pph22 + pph23 + pph24 + pph25);
  const nextYearMonthlyPph25 = Math.round(Math.max(0, pphBadan - pph22 - pph23 - pph24) / 12);

  try {
    const pdf = await generateSptSummaryPdf({
      customer: {
        name: data.companyName || customer?.company_name || customer?.full_name || '-',
        npwp: data.npwp || customer?.npwp || '-',
        address: customer?.address ?? undefined,
      },
      fiscalYear: Number(data.fiscalYear ?? session.fiscal_year),
      closingType: session.closing_type,
      pl: { sales, cogs, salary, opex, petty, deprec, netIncome: accountingIncome },
      pkp,
      pphBadan,
      finalTaxRate: session.closing_type === 'UMKM' ? 0.005 : undefined,
      finalTax: session.closing_type === 'UMKM' ? Math.round(sales * 0.005) : undefined,
      smeDiscount: session.closing_type === 'PPH25' ? eligibleSme : undefined,
      credits: session.closing_type === 'PPH25' ? { pph22, pph23, pph24, pph25 } : undefined,
      settlement: session.closing_type === 'PPH25' ? settlement : undefined,
      nextYearMonthlyPph25: session.closing_type === 'PPH25' ? nextYearMonthlyPph25 : undefined,
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="spt-${session.fiscal_year}-${session.closing_type}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'spt-summary pdf failed');
    return NextResponse.json({ success: false, error: 'PDF generation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_SPT_PDF'))(
    request as RequestWithSession,
    (r) => handle(r, id)
  );
}
