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
    .select('id, employee_id, period, working_days, absent_days, overtime_hours, total_gross, base_salary, overtime_pay, meal_allowance, transport_allowance, position_allowance, other_allowances, laptop_allowance, medical_allowance, tax_allowance, annual_leave_pay, thr, bonus, commission, severance_allowance, pkwt_compensation, bpjs_kesehatan, bpjs_ketenagakerjaan, jht_employee, jp_employee, loan_deduction, other_deductions, net_salary, bpjs_kes_company, jkk_company, jkm_company, jht_company, jp_company, ter_rate, pph21_tax, status, employee_name, employee_npwp, ptkp_category, operator_reviewed_at, operator_edits')
    .eq('customer_id', q.customer_id).eq('period', period);
  if (payslipError) {
    loggers.api.warn({ err: payslipError, queueId, customerId: q.customer_id, period }, 'monthly_payslip query failed');
  }

  const employeeIds = [...new Set((payslips ?? []).map(p => p.employee_id))];
  const empMap: Record<string, { employee_name: string; employee_npwp: string | null; ptkp_category: string;
    employee_nik: string | null; employee_number: string | null; position: string | null;
    department: string | null; employment_status: string | null; worker_type: string | null }> = {};
  if (employeeIds.length > 0) {
    const { data: emps } = await admin
      .from('employee_payroll')
      .select('id, employee_name, employee_npwp, ptkp_category, employee_nik, employee_number, position, department, employment_status, worker_type')
      .in('id', employeeIds);
    for (const e of emps ?? []) empMap[e.id] = e;
  }

  const rows = (payslips ?? []).map(p => {
    const emp = empMap[p.employee_id];
    // Prefer the employee_payroll master, fall back to the payslip's self-contained
    // fields (pre-sync payslips carry name/NPWP/PTKP inline — 2026-06-21).
    const name = emp?.employee_name ?? p.employee_name ?? '—';
    const npwp = emp?.employee_npwp ?? p.employee_npwp ?? null;
    const ptkp = normalizePtkpCategory(emp?.ptkp_category ?? p.ptkp_category ?? 'TK0');
    let flags = evaluatePph21EmployeeFlags({
      employeeNpwp: npwp,
      bpjsKesehatan: Number(p.bpjs_kesehatan ?? 0),
      bpjsKetenagakerjaan: Number(p.bpjs_ketenagakerjaan ?? 0),
      jhtEmployee: Number(p.jht_employee ?? 0),
      jpEmployee: Number(p.jp_employee ?? 0),
      // Gross-up(회사부담) 시 직원부담 0이어도 회사부담분이 채워짐 → BPJS 설정된 것으로 인정
      bpjsCompany: Number(p.bpjs_kes_company ?? 0) + Number(p.jkk_company ?? 0)
        + Number(p.jkm_company ?? 0) + Number(p.jht_company ?? 0) + Number(p.jp_company ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
    });
    // '저장 및 확인' 된 행은 완료(green) — 이슈 내용은 label 로 계속 노출 (요청 10)
    if (p.operator_reviewed_at) {
      flags = { ...flags, level: 'green' as const, label: flags.level === 'green' ? '확인 완료' : `확인됨 · ${flags.label}` };
    }
    return {
      payslipId: p.id,
      employeeId: p.employee_id,
      name,
      npwp,
      ptkp,
      terCategory: getTERCategory(ptkp),
      totalGross: Number(p.total_gross ?? 0),
      // BPJS 입력완료 판정 — 직원부담 + 회사부담(Gross-up) 합. 회사부담분이 있으면 입력완료.
      bpjs: Number(p.bpjs_kesehatan ?? 0) + Number(p.bpjs_ketenagakerjaan ?? 0)
        + Number(p.jht_employee ?? 0) + Number(p.jp_employee ?? 0)
        + Number(p.bpjs_kes_company ?? 0) + Number(p.jkk_company ?? 0) + Number(p.jkm_company ?? 0)
        + Number(p.jht_company ?? 0) + Number(p.jp_company ?? 0),
      thr: Number(p.thr ?? 0) + Number(p.bonus ?? 0),
      pph21: Number(p.pph21_tax ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
      // 직원 정보 (읽기 카드)
      employeeNumber: emp?.employee_number ?? null,
      nik: emp?.employee_nik ?? null,
      employmentStatus: emp?.employment_status ?? null,
      workerType: emp?.worker_type ?? null,
      position: emp?.position ?? null,
      department: emp?.department ?? null,
      // 근태
      workingDays: Number(p.working_days ?? 0),
      absentDays: Number(p.absent_days ?? 0),
      overtimeHours: Number(p.overtime_hours ?? 0),
      // 기본급 + 수당
      baseSalary: Number(p.base_salary ?? 0),
      overtimePay: Number(p.overtime_pay ?? 0),
      mealAllowance: Number(p.meal_allowance ?? 0),
      transportAllowance: Number(p.transport_allowance ?? 0),
      positionAllowance: Number(p.position_allowance ?? 0),
      otherAllowances: Number(p.other_allowances ?? 0),
      laptopAllowance: Number(p.laptop_allowance ?? 0),
      medicalAllowance: Number(p.medical_allowance ?? 0),
      taxAllowance: Number(p.tax_allowance ?? 0),
      annualLeavePay: Number(p.annual_leave_pay ?? 0),
      // 특수 지급
      severanceAllowance: Number(p.severance_allowance ?? 0),
      pkwtCompensation: Number(p.pkwt_compensation ?? 0),
      // 보너스
      bonusOnly: Number(p.bonus ?? 0),
      thrOnly: Number(p.thr ?? 0),
      commission: Number(p.commission ?? 0),
      // 공제
      bpjsKesehatan: Number(p.bpjs_kesehatan ?? 0),
      bpjsKetenagakerjaan: Number(p.bpjs_ketenagakerjaan ?? 0),
      jhtEmployee: Number(p.jht_employee ?? 0),
      jpEmployee: Number(p.jp_employee ?? 0),
      loanDeduction: Number(p.loan_deduction ?? 0),
      otherDeductions: Number(p.other_deductions ?? 0),
      // 자동 계산
      netSalary: Number(p.net_salary ?? 0),
      // 회사 부담 BPJS (자동)
      bpjsKesCompany: Number(p.bpjs_kes_company ?? 0),
      jkkCompany: Number(p.jkk_company ?? 0),
      jkmCompany: Number(p.jkm_company ?? 0),
      jhtCompany: Number(p.jht_company ?? 0),
      jpCompany: Number(p.jp_company ?? 0),
      reviewedAt: p.operator_reviewed_at ?? null,
      operatorEdits: (p.operator_edits as Record<string, unknown> | null) ?? null,
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
