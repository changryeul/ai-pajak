import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';
import { loggers } from '@/lib/logger';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import { normalizePtkpCategory } from '@/config/pph21-ter-rates';
import { loadRateOverrides } from '@/lib/tax/rate-provider';
import type { RequestWithSession } from '@/types/auth';
import type { PPh21Data } from '@/types';

/**
 * Monthly Payslip API
 * GET    — List payslips by period
 * POST   — Generate payslips for period (copy from employee master)
 * PUT    — Update single payslip with attendance/allowances/deductions
 * DELETE — Delete payslip
 */

// 2026-06-24: import 시점에도 PUT 과 동일한 계산을 적용할 수 있도록 helper
// 분리. 입력으로 payslip 의 모든 amount 필드 (snake_case) + period + ptkp 를
// 받아서 PPh 21 TER + BPJS company + Biaya Jabatan + net_salary 까지 계산.
export function computePayslipTotals(input: {
  base_salary?: number;
  overtime_pay?: number;
  meal_allowance?: number;
  transport_allowance?: number;
  position_allowance?: number;
  other_allowances?: number;
  laptop_allowance?: number;
  medical_allowance?: number;
  tax_allowance?: number;
  annual_leave_pay?: number;
  bonus?: number;
  thr?: number;
  commission?: number;
  severance_allowance?: number;
  pkwt_compensation?: number;
  bpjs_kesehatan?: number;
  bpjs_ketenagakerjaan?: number;
  jht_employee?: number;
  jp_employee?: number;
  loan_deduction?: number;
  other_deductions?: number;
  period: string;
  ptkp_category?: string | null;
  employee_npwp?: string | null;
}): {
  total_gross: number;
  total_deduction: number;
  base_salary_bpjs_kes: number;
  base_salary_bpjs_tk: number;
  bpjs_kes_company: number;
  jkk_company: number;
  jkm_company: number;
  jht_company: number;
  jp_company: number;
  personal_expense: number;
  taxable_income: number;
  pph21_tax: number;
  ter_rate: number;
  net_salary: number;
} {
  const totalGross =
    Number(input.base_salary || 0) +
    Number(input.overtime_pay || 0) +
    Number(input.meal_allowance || 0) +
    Number(input.transport_allowance || 0) +
    Number(input.position_allowance || 0) +
    Number(input.other_allowances || 0) +
    Number(input.laptop_allowance || 0) +
    Number(input.medical_allowance || 0) +
    Number(input.tax_allowance || 0) +
    Number(input.annual_leave_pay || 0) +
    Number(input.bonus || 0) +
    Number(input.thr || 0) +
    Number(input.commission || 0) +
    Number(input.severance_allowance || 0) +
    Number(input.pkwt_compensation || 0);

  const totalDeduction =
    Number(input.bpjs_kesehatan || 0) +
    Number(input.bpjs_ketenagakerjaan || 0) +
    Number(input.jht_employee || 0) +
    Number(input.jp_employee || 0) +
    Number(input.loan_deduction || 0) +
    Number(input.other_deductions || 0);

  // PPh 21 TER — PTKP status 정규화 (슬래시/공백/별칭 처리 + 미지값 방어)를
  // 공용 함수로 통일. import 경로와 동일 규칙 → 계산 일관성.
  const ptkpCategory = normalizePtkpCategory(input.ptkp_category);
  // NPWP 없는 직원은 Pasal 21(5a) 에 따라 20% 가산. payslip 레코드의 실제
  // employee_npwp 로 판정한다 (과거엔 has_npwp:true 하드코딩으로 가산이
  // 절대 적용되지 않아 무-NPWP 직원 세율이 20% 낮게 나오던 버그).
  const empNpwp = (input.employee_npwp ?? '').trim();
  const currentMonth = parseInt(input.period.split('-')[1]);
  const pphData: PPh21Data = {
    employee_name: '',
    employee_npwp: empNpwp,
    employee_nik: '',
    ptkp_category: ptkpCategory,
    gross_salary: totalGross,
    jht_employee: Number(input.jht_employee || 0),
    jp_employee: Number(input.jp_employee || 0),
    position_allowance: Number(input.position_allowance || 0),
    other_deductions: Number(input.other_deductions || 0),
    tax_period_start: `${input.period}-01`,
    tax_period_end: `${input.period}-30`,
    has_npwp: empNpwp.length > 0,
    month: currentMonth,
  };

  let pph21Tax = 0;
  let terRate = 0;
  try {
    const calc = PPh21Calculator.calculateMonthlyTER(pphData);
    pph21Tax = calc.tax_amount;
    terRate = calc.ter_rate;
  } catch (err) {
    // ptkp 보정으로 정상 입력에선 도달 불가. 도달했다면 세금 0 이 저장되므로
    // warn 이 아닌 error 로 올려 모니터링/Sentry 에 반드시 노출한다.
    loggers.api.error(
      { err, ptkpCategory, rawPtkp: input.ptkp_category, period: input.period },
      'PPh 21 TER calculation failed — payslip saved with tax=0, needs review',
    );
  }

  // BPJS company + Biaya Jabatan
  const BPJS_KES_CAP = 12_000_000;
  const BPJS_JP_CAP = 10_042_300;
  const baseForBpjs = Number(input.base_salary || 0);
  const bpjsKesBase = Math.min(baseForBpjs, BPJS_KES_CAP);
  const bpjsTkBase = Math.min(baseForBpjs, BPJS_JP_CAP);
  const bpjsKesCompany = Math.round(bpjsKesBase * 0.04);
  const jkkCompany = Math.round(bpjsTkBase * 0.0024);
  const jkmCompany = Math.round(bpjsTkBase * 0.003);
  const jhtCompany = Math.round(bpjsTkBase * 0.037);
  const jpCompany = Math.round(bpjsTkBase * 0.02);
  const personalExpense = Math.min(Math.round(totalGross * 0.05), 500_000);

  const taxableIncome = Math.max(totalGross - totalDeduction - personalExpense, 0);
  const netSalary = totalGross - totalDeduction - pph21Tax;

  return {
    total_gross: totalGross,
    total_deduction: totalDeduction,
    base_salary_bpjs_kes: bpjsKesBase,
    base_salary_bpjs_tk: bpjsTkBase,
    bpjs_kes_company: bpjsKesCompany,
    jkk_company: jkkCompany,
    jkm_company: jkmCompany,
    jht_company: jhtCompany,
    jp_company: jpCompany,
    personal_expense: personalExpense,
    taxable_income: taxableIncome,
    pph21_tax: pph21Tax,
    ter_rate: terRate,
    net_salary: netSalary,
  };
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId');
    const period = url.searchParams.get('period');

    if (!customerId || !period) {
      return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // employee_id 는 nullable (2026-06-21 정책 변경 — sync 전에는 마스터 없음).
    // payslip 자체의 employee_name/employee_npwp/ptkp_category 를 사용. FK join 은
    // sync 후의 보조 정보 (employment_status, gross_salary).
    const { data, error } = await admin
      .from('monthly_payslip')
      .select(`
        *,
        employee:employee_id(
          id, gross_salary, employment_status,
          employee_number, employee_nik, employee_npwp,
          worker_type, position, department, ptkp_category,
          hire_date, resign_date
        )
      `)
      .eq('customer_id', customerId)
      .eq('period', period)
      .order('employee_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Summary
    const summary = {
      totalEmployees: (data || []).length,
      totalGross: (data || []).reduce((s, p) => s + Number(p.total_gross || 0), 0),
      totalDeduction: (data || []).reduce((s, p) => s + Number(p.total_deduction || 0), 0),
      totalPph21: (data || []).reduce((s, p) => s + Number(p.pph21_tax || 0), 0),
      totalNet: (data || []).reduce((s, p) => s + Number(p.net_salary || 0), 0),
    };

    return NextResponse.json({ success: true, data: data || [], summary });
  } catch (error) {
    loggers.api.error({ err: error }, 'Payslip GET error');
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// 2026-06-21: 기존 "generate payslips from master" 흐름 제거.
// 새 흐름은 월별 급여 자료 xlsx 업로드 (`/api/tax/employees/import`) 로 일원화.
// POST 는 이제 "최종 제출" — 해당 월 모든 DRAFT 행을 SUBMITTED 로 flag.
async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const { customerId, period, action } = await req.json();

    if (!customerId || !period || action !== 'submit') {
      return NextResponse.json({ error: 'customerId, period, action=submit required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { count, error } = await admin
      .from('monthly_payslip')
      .update({ status: 'SUBMITTED' }, { count: 'exact' })
      .eq('customer_id', customerId)
      .eq('period', period)
      .eq('status', 'DRAFT');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2026-06-21: 최종 제출 시 운영팀에 자동 신고 요청 (spt_masa_submission_request 행).
    // PPh23/PPh4(2) 와 동일 패턴. 사용자는 신고 이력에서 "처리 대기" 행으로 즉시 확인 가능.
    // tax_filing 행 직접 생성은 Hard Rule #3 (consultant_id NOT NULL) 위반이라 운영팀이
    // 처리 완료 시 생성한다.
    const { error: reqErr } = await admin
      .from('spt_masa_submission_request')
      .upsert({
        customer_id: customerId,
        tax_type: 'PPh21',
        tax_period: period,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
        requested_by_user_id: req.session.userId,
        thread_id: null,
        processed_at: null,
        filing_id: null,
      }, { onConflict: 'customer_id,tax_type,tax_period' });
    if (reqErr) {
      loggers.api.warn({ err: reqErr.message, customerId, period }, 'spt_masa_submission_request upsert failed');
    }

    loggers.api.info({ customerId, period, submitted: count ?? 0 }, 'Payslips submitted');

    // 고객 급여명세 제출 → 담당 상담원 업무함에 PPh21 큐 자동 노출 (best-effort).
    await ensureQueueForActivity(admin, customerId, 'PPh21', period);

    return NextResponse.json({
      success: true,
      submitted: count ?? 0,
      message: `${count ?? 0} payslips submitted`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Payslip POST error');
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}

// Update payslip with attendance/allowances, auto-calculate PPh 21
async function handlePut(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Warm DB rate overrides so computePayslipTotals picks up any admin-set
    // PTKP / bracket / surcharge changes (falls back to TS constants if none).
    await loadRateOverrides();

    const admin = getSupabaseAdmin();

    // employee_id 가 null 일 수 있어 employee join 대신 payslip 자체의 ptkp_category 를 1차 사용.
    const { data: current } = await admin
      .from('monthly_payslip')
      .select('*, employee:employee_id(ptkp_category)')
      .eq('id', id)
      .single();

    // SUBMITTED 행은 수정 불가
    if (current?.status === 'SUBMITTED') {
      return NextResponse.json({ error: 'Cannot edit submitted payslip' }, { status: 409 });
    }

    if (!current) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Merge updates + ptkp fallback (sync 후엔 employee join 에서, sync 전엔 payslip 자체에서)
    const merged = { ...current, ...updates };
    const totals = computePayslipTotals({
      ...merged,
      period: current.period,
      ptkp_category: current.ptkp_category || current.employee?.ptkp_category || 'TK0',
    });

    // Update with calculated values
    const { data: updated, error: updateError } = await admin
      .from('monthly_payslip')
      .update({
        ...updates,
        ...totals,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    loggers.api.error({ err: error }, 'Payslip PUT error');
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('monthly_payslip').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    loggers.api.error({ err: error }, 'Payslip DELETE error');
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PAYSLIP_SUBMIT'))(request as RequestWithSession, handlePost);
}

export async function PUT(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PAYSLIP_UPDATE'))(request as RequestWithSession, handlePut);
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PAYSLIP_DELETE'))(request as RequestWithSession, handleDelete);
}
