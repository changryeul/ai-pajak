// src/app/api/operator/workqueue/[queueId]/pph21/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluatePph21EmployeeFlags } from '@/lib/operator/pph21-review-flags';
import { getTERCategory, normalizePtkpCategory } from '@/config/pph21-ter-rates';
import { loggers } from '@/lib/logger';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: allRoles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const role = allRoles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, status')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  if (q.tax_type !== 'PPh21') {
    return NextResponse.json({ error: 'Not a PPh21 queue item' }, { status: 404 });
  }

  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`; // YYYY-MM

  const { data: payslips, error: payslipError } = await admin
    .from('monthly_payslip')
    .select('id, employee_id, period, total_gross, thr, bonus, bpjs_kesehatan, bpjs_ketenagakerjaan, ter_rate, pph21_tax, status')
    .eq('customer_id', q.customer_id).eq('period', period);
  if (payslipError) {
    loggers.api.warn({ err: payslipError, queueId, customerId: q.customer_id, period }, 'monthly_payslip query failed');
  }

  const employeeIds = [...new Set((payslips ?? []).map(p => p.employee_id))];
  const empMap: Record<string, { employee_name: string; employee_npwp: string | null; ptkp_category: string }> = {};
  if (employeeIds.length > 0) {
    const { data: emps } = await admin
      .from('employee_payroll')
      .select('id, employee_name, employee_npwp, ptkp_category')
      .in('id', employeeIds);
    for (const e of emps ?? []) empMap[e.id] = e;
  }

  const rows = (payslips ?? []).map(p => {
    const emp = empMap[p.employee_id];
    const ptkp = normalizePtkpCategory(emp?.ptkp_category ?? 'TK0');
    const flags = evaluatePph21EmployeeFlags({
      employeeNpwp: emp?.employee_npwp ?? null,
      bpjsKesehatan: Number(p.bpjs_kesehatan ?? 0),
      bpjsKetenagakerjaan: Number(p.bpjs_ketenagakerjaan ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
    });
    return {
      payslipId: p.id,
      employeeId: p.employee_id,
      name: emp?.employee_name ?? '—',
      npwp: emp?.employee_npwp ?? null,
      ptkp,
      terCategory: getTERCategory(ptkp),
      totalGross: Number(p.total_gross ?? 0),
      bpjs: Number(p.bpjs_kesehatan ?? 0) + Number(p.bpjs_ketenagakerjaan ?? 0),
      thr: Number(p.thr ?? 0) + Number(p.bonus ?? 0),
      pph21: Number(p.pph21_tax ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
      flags,
    };
  });

  const summary = {
    employeeCount: rows.length,
    totalGross: rows.reduce((s, r) => s + r.totalGross, 0),
    totalPph21: rows.reduce((s, r) => s + r.pph21, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red' || r.flags.level === 'amber').length,
  };

  return NextResponse.json({
    success: true,
    data: { queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
