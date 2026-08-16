/**
 * 수정요청 #64 — 부가세 누적 미환급 잔액(carryover) + 이번달 납부액 산출.
 *
 * GET  : (customer, period) 의 저장된 opening_credit + 이번달 net(매출PPN−매입PPN) +
 *        계산된 payable/closing_credit 반환.
 * PUT  : { openingCredit } 저장 → 규칙대로 payable/closing_credit 재계산 후 UPSERT.
 *
 * 규칙: month_net>0 → payable=max(0, net−opening), closing=max(0, opening−net)
 *       month_net<=0 → payable=0, closing=opening+(−net)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

function compute(openingCredit: number, monthNet: number) {
  if (monthNet > 0) {
    return { payable: Math.max(0, monthNet - openingCredit), closingCredit: Math.max(0, openingCredit - monthNet) };
  }
  return { payable: 0, closingCredit: openingCredit + -monthNet };
}

async function auth(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

async function loadContext(queueId: string) {
  const admin = getSupabaseAdmin();
  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('customer_id, tax_period_month, tax_period_year')
    .eq('id', queueId).maybeSingle();
  if (!q) return null;
  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`;
  // 이번달 매출(KELUARAN) − 매입(MASUKAN) PPN
  const { data: fakturs } = await admin
    .from('ppn_faktur_monthly')
    .select('faktur_type, ppn')
    .eq('customer_id', q.customer_id).eq('tax_period', period);
  let out = 0, inp = 0;
  for (const f of fakturs ?? []) {
    if (f.faktur_type === 'MASUKAN') inp += Number(f.ppn ?? 0);
    else out += Number(f.ppn ?? 0);
  }
  const monthNet = out - inp;
  const { data: stored } = await admin
    .from('ppn_cumulative_balance')
    .select('opening_credit')
    .eq('customer_id', q.customer_id).eq('tax_period', period).maybeSingle();
  return { admin, customerId: q.customer_id, period, monthNet, salesPpn: out, purchasePpn: inp,
    openingCredit: Number(stored?.opening_credit ?? 0), hasStored: !!stored };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ queueId: string }> }) {
  const a = await auth(request); if (a.error) return a.error;
  const { queueId } = await ctx.params;
  const c = await loadContext(queueId);
  if (!c) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  const { payable, closingCredit } = compute(c.openingCredit, c.monthNet);
  return NextResponse.json({ success: true, data: {
    period: c.period, salesPpn: c.salesPpn, purchasePpn: c.purchasePpn, monthNet: c.monthNet,
    openingCredit: c.openingCredit, payable, closingCredit, saved: c.hasStored,
  } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ queueId: string }> }) {
  const a = await auth(request); if (a.error) return a.error;
  const parsed = z.object({ openingCredit: z.number().min(0) }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { queueId } = await ctx.params;
  const c = await loadContext(queueId);
  if (!c) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  const openingCredit = parsed.data.openingCredit;
  const { payable, closingCredit } = compute(openingCredit, c.monthNet);
  const { error } = await c.admin.from('ppn_cumulative_balance').upsert({
    customer_id: c.customerId, tax_period: c.period,
    opening_credit: openingCredit, month_net: c.monthNet, payable, closing_credit: closingCredit,
    updated_by: a.user!.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'customer_id,tax_period' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: {
    period: c.period, salesPpn: c.salesPpn, purchasePpn: c.purchasePpn, monthNet: c.monthNet,
    openingCredit, payable, closingCredit, saved: true,
  } });
}
