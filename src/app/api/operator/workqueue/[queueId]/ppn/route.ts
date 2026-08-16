import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluatePpnFlags } from '@/lib/operator/ppn-review-flags';

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

  // 수정요청 48·49 — Coretax 접속용 고객 자격증명 (ID + 비밀번호 힌트만; 원문 PW 미저장)
  const { data: cust } = await admin
    .from('customer')
    .select('coretax_id, coretax_password_hint')
    .eq('id', q.customer_id).maybeSingle();

  const { data: fakturs } = await admin
    .from('ppn_faktur_monthly')
    .select('id, faktur_type, faktur_number, faktur_date, counterparty_name, counterparty_npwp, dpp, dpp_nilai_lain, ppn, is_luxury, recon_status, operator_reviewed_at, operator_edits')
    .eq('customer_id', q.customer_id).eq('tax_period', period)
    .order('faktur_type', { ascending: true })
    .order('faktur_date', { ascending: true });

  const rows = (fakturs ?? []).map(f => {
    let flags = evaluatePpnFlags({
      reconStatus: f.recon_status ?? null,
      fakturNumber: f.faktur_number ?? null,
      counterpartyNpwp: f.counterparty_npwp ?? null,
    });
    if (f.operator_reviewed_at) {
      flags = { ...flags, level: 'green' as const, label: flags.level === 'green' ? '확인 완료' : `확인됨 · ${flags.label}` };
    }
    return {
      id: f.id,
      fakturType: f.faktur_type === 'MASUKAN' ? 'MASUKAN' : 'KELUARAN',
      fakturNumber: f.faktur_number ?? null,
      fakturDate: f.faktur_date ?? null,
      counterpartyName: f.counterparty_name ?? '—',
      counterpartyNpwp: f.counterparty_npwp ?? null,
      dpp: Number(f.dpp ?? 0),
      dppNilaiLain: Number(f.dpp_nilai_lain ?? 0),
      ppn: Number(f.ppn ?? 0),
      isLuxury: !!f.is_luxury,
      reconStatus: f.recon_status ?? null,
      reviewedAt: f.operator_reviewed_at ?? null,
      operatorEdits: (f.operator_edits as Record<string, unknown> | null) ?? null,
      flags,
    };
  });

  const summary = {
    fakturCount: rows.length,
    totalDpp: rows.reduce((s, r) => s + r.dpp, 0),
    totalPpn: rows.reduce((s, r) => s + r.ppn, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red').length,
  };

  return NextResponse.json({
    success: true,
    data: {
      queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows,
      coretax: { id: cust?.coretax_id ?? null, hint: cust?.coretax_password_hint ?? null },
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
