import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateUmkmFlags } from '@/lib/operator/umkm-review-flags';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, status')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`; // YYYY-MM

  const { data: payments } = await admin
    .from('tax_monthly_payment')
    .select('id, tax_type, amount_due, amount_paid, penalty_amount, kode_billing, status, payment_deadline, reporting_deadline')
    .eq('customer_id', q.customer_id).eq('tax_period', period)
    .in('tax_type', ['PPh_FINAL', 'PPh25'])
    .order('tax_type', { ascending: true });

  const rows = (payments ?? []).map(p => {
    const amountDue = Number(p.amount_due ?? 0);
    const flags = evaluateUmkmFlags({ status: p.status ?? null, amountDue });
    return {
      id: p.id,
      taxType: p.tax_type === 'PPh25' ? 'PPh25' : 'PPh_FINAL',
      amountDue,
      amountPaid: Number(p.amount_paid ?? 0),
      penaltyAmount: Number(p.penalty_amount ?? 0),
      kodeBilling: p.kode_billing ?? null,
      paymentStatus: p.status ?? null,
      paymentDeadline: p.payment_deadline ?? null,
      reportingDeadline: p.reporting_deadline ?? null,
      flags,
    };
  });

  const summary = {
    recordCount: rows.length,
    totalDue: rows.reduce((s, r) => s + r.amountDue, 0),
    totalPaid: rows.reduce((s, r) => s + r.amountPaid, 0),
    totalPenalty: rows.reduce((s, r) => s + r.penaltyAmount, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red').length,
  };

  return NextResponse.json({
    success: true,
    data: { queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
