import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateEmployeeHrFlags } from '@/lib/operator/employee-hr-flags';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

/**
 * GET /api/operator/workqueue/[queueId]/employees
 *
 * 직원 인사 기록 검토 — 직원 마스터는 월 귀속이 아니라 고객 단위이므로
 * queue 행(PPh21)에서 customer 를 얻어 employee_payroll 전체 + 최근 인사
 * 변경 이력(employee_change_log)을 반환한다. PPh21 급여 검토 전 PTKP /
 * NPWP / NIK 정합성 확인용.
 */
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
    .select('id, customer_id, tax_period_month, tax_period_year, status')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const [{ data: employees }, { data: changes }] = await Promise.all([
    admin.from('employee_payroll')
      .select('id, employee_name, employee_number, employee_npwp, employee_nik, ptkp_category, hire_date, is_active, gross_salary, position, department')
      .eq('customer_id', q.customer_id)
      .order('is_active', { ascending: false })
      .order('employee_name', { ascending: true })
      .limit(500),
    admin.from('employee_change_log')
      .select('id, employee_id, section, field, old_value, new_value, changed_at')
      .eq('customer_id', q.customer_id)
      .order('changed_at', { ascending: false })
      .limit(10),
  ]);

  const rows = (employees ?? []).map(e => {
    const flags = evaluateEmployeeHrFlags({
      ptkpCategory: e.ptkp_category ?? null,
      npwp: e.employee_npwp ?? null,
      nik: e.employee_nik ?? null,
      grossSalary: Number(e.gross_salary ?? 0),
      hireDate: e.hire_date ?? null,
      isActive: e.is_active !== false,
    });
    return {
      id: e.id,
      name: e.employee_name,
      employeeNumber: e.employee_number ?? null,
      npwp: e.employee_npwp ?? null,
      nik: e.employee_nik ?? null,
      ptkp: e.ptkp_category ?? null,
      hireDate: e.hire_date ?? null,
      isActive: e.is_active !== false,
      grossSalary: Number(e.gross_salary ?? 0),
      position: e.position ?? null,
      department: e.department ?? null,
      flags,
    };
  });

  const nameById = new Map(rows.map(r => [r.id, r.name]));
  const changeLog = (changes ?? []).map(c => ({
    id: c.id,
    employeeName: nameById.get(c.employee_id) ?? '(삭제된 직원)',
    section: c.section,
    field: c.field,
    oldValue: c.old_value,
    newValue: c.new_value,
    changedAt: c.changed_at,
  }));

  const summary = {
    employeeCount: rows.length,
    activeCount: rows.filter(r => r.isActive).length,
    noNpwpCount: rows.filter(r => r.isActive && !r.npwp).length,
    issueCount: rows.filter(r => r.flags.level !== 'green').length,
  };

  return NextResponse.json({
    success: true,
    data: {
      queueId: q.id,
      customerId: q.customer_id,
      period: `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`,
      status: q.status,
      summary,
      rows,
      changeLog,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
