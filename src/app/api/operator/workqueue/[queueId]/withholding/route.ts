import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateWithholdingFlags } from '@/lib/operator/withholding-review-flags';

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

  const { data: txns } = await admin
    .from('pph23_transaction')
    .select('id, counterparty_id, counterparty_name, counterparty_npwp, tax_regime, transaction_date, description, income_type, service_type, gross_amount, tax_rate, tax_amount, invoice_document_id')
    .eq('customer_id', q.customer_id).eq('tax_period', period)
    .order('transaction_date', { ascending: true });

  const rows = (txns ?? []).map(t => {
    const hasInvoicePhoto = t.invoice_document_id != null;
    const flags = evaluateWithholdingFlags({
      counterpartyNpwp: t.counterparty_npwp ?? null,
      counterpartyId: t.counterparty_id ?? null,
      taxAmount: Number(t.tax_amount ?? 0),
      taxRate: Number(t.tax_rate ?? 0),
      hasInvoicePhoto,
    });
    return {
      id: t.id,
      regime: t.tax_regime === 'PPH4_2' ? 'PPH4_2' : 'PPH23',
      counterpartyName: t.counterparty_name ?? '—',
      counterpartyNpwp: t.counterparty_npwp ?? null,
      transactionDate: t.transaction_date ?? null,
      description: t.description ?? '',
      incomeType: t.income_type ?? t.service_type ?? '',
      grossAmount: Number(t.gross_amount ?? 0),
      taxRate: Number(t.tax_rate ?? 0),
      taxAmount: Number(t.tax_amount ?? 0),
      hasInvoicePhoto,
      flags,
    };
  });

  const summary = {
    txnCount: rows.length,
    totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
    totalTax: rows.reduce((s, r) => s + r.taxAmount, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red').length,
  };

  return NextResponse.json({
    success: true,
    data: { queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
