import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import type { PPh21Data, PPh21Calculation } from '@/types';

/**
 * Bulk PPh21 input shape — accepts BOTH legacy + JTC 24-column template.
 *
 * Legacy (kept for backward compat with E-Bupot bulk + early adopters):
 *   { employee_name, employee_npwp, ptkp_category, gross_salary,
 *     jht_employee, jp_employee, position_allowance, other_deductions }
 *
 * JTC (PMK 66/2023, monthly amounts):
 *   { employee_name, employee_npwp, employment_status: 1|2|3,
 *     ptkp_category: 'TK/0' | 'TK0' (both accepted),
 *     gender?, join_date?,
 *     gaji, tunjangan?, bonus_thr?, natura?, pinjaman_gaji?, potongan_gaji?,
 *     penambah?: { bpjs_kesehatan, jkk, jkm, jht, jp, jkp },   // 회사 부담 (store-only v1)
 *     pengurang?: { bpjs_kesehatan, jht, jp, jkp } }            // 직원 부담
 */
interface BulkEmployee {
  employee_name: string;
  employee_npwp?: string;
  employee_nik?: string;
  ptkp_category: string;
  // Legacy fields
  gross_salary?: number;
  jht_employee?: number;
  jp_employee?: number;
  position_allowance?: number;
  other_deductions?: number;
  // JTC fields
  employment_status?: 1 | 2 | 3;
  gender?: 'M' | 'F';
  join_date?: string;
  gaji?: number;
  tunjangan?: number;
  bonus_thr?: number;
  natura?: number;
  pinjaman_gaji?: number;
  potongan_gaji?: number;
  penambah?: {
    bpjs_kesehatan?: number;
    jkk?: number;
    jkm?: number;
    jht?: number;
    jp?: number;
    jkp?: number;
  };
  pengurang?: {
    bpjs_kesehatan?: number;
    jht?: number;
    jp?: number;
    jkp?: number;
  };
}

interface BulkResult {
  employee_name: string;
  employee_npwp?: string;
  ptkp_category: string;
  employment_status?: 1 | 2 | 3;
  calculation: PPh21Calculation;
  monthly_tax: number;
  effective_rate: number;
  /** Snapshot of the deduction split (also lives inside calculation). */
  deduction_breakdown?: PPh21Calculation['deduction_breakdown'];
  /** Soft warning (e.g. status 2/3 — fell back to simple calc in v1). */
  warning?: string;
  error?: string;
}

/** Convert 'TK/0' → 'TK0', leave 'TK0' alone. DB enum uses no-slash. */
function ptkpCanonical(raw: string): string {
  return raw.replace('/', '').toUpperCase();
}

/** Detect whether the row has JTC-specific fields supplied. */
function hasJtcFields(emp: BulkEmployee): boolean {
  if (emp.gaji !== undefined && emp.gaji !== null) return true;
  if (emp.tunjangan || emp.bonus_thr || emp.natura) return true;
  if (emp.pengurang) {
    const p = emp.pengurang;
    if (p.bpjs_kesehatan || p.jht || p.jp || p.jkp) return true;
  }
  return false;
}

/**
 * Normalize either-shape input to the calculator's PPh21Data. JTC fields
 * (when present) ride along inside `jtc_detail` so the calculator can
 * branch without contaminating legacy callers.
 */
function normalizeEmployee(emp: BulkEmployee): { data: PPh21Data; warning?: string } {
  const ptkpCode = ptkpCanonical(emp.ptkp_category) as PPh21Data['ptkp_category'];

  const status = emp.employment_status;
  const useJtc = hasJtcFields(emp);

  // Monthly basic salary: prefer JTC `gaji`, fall back to legacy `gross_salary`.
  const monthlySalary = emp.gaji ?? emp.gross_salary ?? 0;

  // JHT / JP — JTC pengurang.* takes precedence over legacy keys.
  const jht = emp.pengurang?.jht ?? emp.jht_employee ?? 0;
  const jp = emp.pengurang?.jp ?? emp.jp_employee ?? 0;

  // Status 2/3: store + simple calc + warning (PER-16/2016 별도 트랙).
  // Status 1 OR no status given: full JTC path if jtc fields present.
  const applyJtcDetail = useJtc && (status === undefined || status === 1);
  const warning =
    status === 2 || status === 3
      ? `Bentuk ketenagakerjaan ${status} — PER-16/2016 별도 계산 트랙 v2 예정. v1 에선 simple 계산 + store only.`
      : undefined;

  const data: PPh21Data = {
    employee_name: emp.employee_name,
    employee_npwp: emp.employee_npwp ?? '',
    employee_nik: emp.employee_nik ?? '',
    ptkp_category: ptkpCode,
    gross_salary: monthlySalary,
    jht_employee: jht,
    jp_employee: jp,
    position_allowance: emp.position_allowance ?? 0,
    other_deductions: emp.other_deductions ?? 0,
    tax_period_start: '01',
    tax_period_end: '12',
    ...(applyJtcDetail && {
      jtc_detail: {
        tunjangan: emp.tunjangan ?? 0,
        bonus_thr: emp.bonus_thr ?? 0,
        natura: emp.natura ?? 0,
        pengurang_bpjs_kesehatan: emp.pengurang?.bpjs_kesehatan ?? 0,
        pengurang_jkp: emp.pengurang?.jkp ?? 0,
      },
    }),
  };

  return { data, warning };
}

/**
 * POST /api/tax/pph21-bulk
 *
 * Calculate PPh 21 for multiple employees simultaneously.
 *
 * Accepts EITHER legacy 6-field shape OR JTC 24-column shape (mixed in the
 * same request is fine — each row decides on its own).
 *
 * Input:
 *   { employees: BulkEmployee[], period?: 'annual' | 'monthly' }
 * Output:
 *   { success, data: { results: BulkResult[], summary } }
 */
async function handleBulkCalc(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { employees, period = 'annual' } = body as {
      employees: BulkEmployee[];
      period?: 'annual' | 'monthly';
    };

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'employees array is required (min 1)' },
        { status: 400 }
      );
    }

    if (employees.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 employees per batch' },
        { status: 400 }
      );
    }

    const results: BulkResult[] = [];
    let totalGrossIncome = 0;
    let totalTaxAmount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const emp of employees) {
      try {
        const { data, warning } = normalizeEmployee(emp);

        const calc = period === 'monthly'
          ? PPh21Calculator.calculateMonthly(data)
          : PPh21Calculator.calculateAnnual(data);

        const monthlyTax = period === 'monthly'
          ? calc.tax_amount
          : Math.round(calc.tax_amount / 12);

        totalGrossIncome += calc.gross_income;
        totalTaxAmount += calc.tax_amount;
        if (warning) warningCount++;

        results.push({
          employee_name: emp.employee_name,
          employee_npwp: emp.employee_npwp,
          ptkp_category: emp.ptkp_category,
          employment_status: emp.employment_status,
          calculation: calc,
          deduction_breakdown: calc.deduction_breakdown,
          monthly_tax: monthlyTax,
          effective_rate: PPh21Calculator.getEffectiveTaxRate(calc.tax_amount, calc.gross_income),
          warning,
        });
      } catch (err) {
        errorCount++;
        results.push({
          employee_name: emp.employee_name,
          employee_npwp: emp.employee_npwp,
          ptkp_category: emp.ptkp_category,
          employment_status: emp.employment_status,
          calculation: {
            gross_income: 0,
            total_deductions: 0,
            net_income: 0,
            ptkp: 0,
            taxable_income: 0,
            tax_amount: 0,
            tax_breakdown: [],
          },
          monthly_tax: 0,
          effective_rate: 0,
          error: err instanceof Error ? err.message : 'Calculation failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          totalEmployees: employees.length,
          successCount: employees.length - errorCount,
          errorCount,
          warningCount,
          totalGrossIncome,
          totalTaxAmount,
          totalMonthlyTax: Math.round(totalTaxAmount / 12),
          averageEffectiveRate: totalGrossIncome > 0
            ? ((totalTaxAmount / totalGrossIncome) * 100)
            : 0,
          period,
        },
      },
    });
  } catch (error) {
    loggers.tax.error({ err: error }, 'Bulk PPh 21 calculation error');
    return NextResponse.json(
      { error: 'Bulk calculation failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleBulkCalc);
}
