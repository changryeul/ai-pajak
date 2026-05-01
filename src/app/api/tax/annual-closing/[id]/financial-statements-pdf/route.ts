import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { generateFinancialStatementsPdf } from '@/lib/tax/closing-statements/pdf-generator';
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

  const data = (session.data ?? {}) as SessionData;
  const sales = Number(data.annualRevenue ?? 0);
  const cogs = Number(data.cogs ?? 0);
  const salary = Number(data.salary ?? 0);
  const opex = Number(data.opex ?? 0);
  const petty = Number(data.petty ?? 0);
  const deprec = Number(data.deprec ?? 0);
  const netIncome = sales - cogs - salary - opex - petty - deprec;

  // BS approximations consistent with the wizard preview.
  const totalAssets = Math.round(netIncome + 690_000_000);
  const cash = Math.round(sales * 0.45);
  const ar = Math.round(sales * 0.08);
  const inv = Math.round(sales * 0.06);
  const fa = Math.max(0, totalAssets - cash - ar - inv);
  const loan = 95_000_000;
  const capital = 180_000_000;
  const surplus = 500_000_000;
  const retained = Math.max(0, totalAssets - loan - capital - surplus);

  try {
    const pdf = await generateFinancialStatementsPdf({
      customer: {
        name: data.companyName || customer?.company_name || customer?.full_name || '-',
        npwp: data.npwp || customer?.npwp || '-',
        address: customer?.address ?? undefined,
      },
      fiscalYear: Number(data.fiscalYear ?? session.fiscal_year),
      closingType: session.closing_type,
      pl: { sales, cogs, salary, opex, petty, deprec, netIncome },
      bs: { cash, ar, inventory: inv, fa, totalAssets, loan, capital, surplus, retained, totalLE: totalAssets },
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="financial-statements-${session.fiscal_year}-${session.closing_type}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'closing-statements pdf failed');
    return NextResponse.json({ success: false, error: 'PDF generation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_STATEMENTS_PDF'))(
    request as RequestWithSession,
    (r) => handle(r, id)
  );
}
