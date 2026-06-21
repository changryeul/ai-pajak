import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import type { RequestWithSession } from '@/types/auth';
import type { PPh21Data } from '@/types';
import type { PTKPCategory } from '@/config/constants';

/**
 * Monthly Payslip API
 * GET    — List payslips by period
 * POST   — Generate payslips for period (copy from employee master)
 * PUT    — Update single payslip with attendance/allowances/deductions
 * DELETE — Delete payslip
 */

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
        employee:employee_id(id, gross_salary, employment_status)
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

    loggers.api.info({ customerId, period, submitted: count ?? 0 }, 'Payslips submitted');
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

    // Merge updates
    const merged = { ...current, ...updates };

    // Calculate totals
    const totalGross =
      Number(merged.base_salary || 0) +
      Number(merged.overtime_pay || 0) +
      Number(merged.meal_allowance || 0) +
      Number(merged.transport_allowance || 0) +
      Number(merged.position_allowance || 0) +
      Number(merged.other_allowances || 0) +
      Number(merged.laptop_allowance || 0) +
      Number(merged.medical_allowance || 0) +
      Number(merged.tax_allowance || 0) +
      Number(merged.annual_leave_pay || 0) +
      Number(merged.bonus || 0) +
      Number(merged.thr || 0) +
      Number(merged.commission || 0) +
      Number(merged.severance_allowance || 0) +
      Number(merged.pkwt_compensation || 0);

    const totalDeduction =
      Number(merged.bpjs_kesehatan || 0) +
      Number(merged.bpjs_ketenagakerjaan || 0) +
      Number(merged.jht_employee || 0) +
      Number(merged.jp_employee || 0) +
      Number(merged.loan_deduction || 0) +
      Number(merged.other_deductions || 0);

    // Calculate PPh 21 using TER method
    const ptkpCategory = (current.ptkp_category || current.employee?.ptkp_category || 'TK0') as PTKPCategory;
    const currentMonth = parseInt(current.period.split('-')[1]);

    const pphData: PPh21Data = {
      employee_name: '',
      employee_npwp: '',
      employee_nik: '',
      ptkp_category: ptkpCategory,
      gross_salary: totalGross,
      jht_employee: Number(merged.jht_employee || 0),
      jp_employee: Number(merged.jp_employee || 0),
      position_allowance: Number(merged.position_allowance || 0),
      other_deductions: Number(merged.other_deductions || 0),
      tax_period_start: `${current.period}-01`,
      tax_period_end: `${current.period}-30`,
      has_npwp: true,
      month: currentMonth,
    };

    let pph21Tax = 0;
    let terRate = 0;
    try {
      const calc = PPh21Calculator.calculateMonthlyTER(pphData);
      pph21Tax = calc.tax_amount;
      terRate = calc.ter_rate;
    } catch (err) {
      loggers.api.warn({ err, ptkpCategory }, 'PPh 21 TER calculation fallback');
    }

    // Recalculate employer-paid BPJS + Biaya Jabatan based on merged base_salary
    const BPJS_KES_CAP = 12_000_000;
    const BPJS_JP_CAP = 10_042_300;
    const baseForBpjs = Number(merged.base_salary || 0);
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

    // Update with calculated values
    const { data: updated, error: updateError } = await admin
      .from('monthly_payslip')
      .update({
        ...updates,
        base_salary_bpjs_kes: bpjsKesBase,
        base_salary_bpjs_tk: bpjsTkBase,
        bpjs_kes_company: bpjsKesCompany,
        jkk_company: jkkCompany,
        jkm_company: jkmCompany,
        jht_company: jhtCompany,
        jp_company: jpCompany,
        personal_expense: personalExpense,
        total_gross: totalGross,
        total_deduction: totalDeduction,
        taxable_income: taxableIncome,
        pph21_tax: pph21Tax,
        ter_rate: terRate,
        net_salary: netSalary,
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
