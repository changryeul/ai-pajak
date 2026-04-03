import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import type { PPh21Data, PPh21Calculation } from '@/types';

interface BulkEmployee {
  employee_name: string;
  employee_npwp?: string;
  employee_nik?: string;
  ptkp_category: string;
  gross_salary: number;
  jht_employee?: number;
  jp_employee?: number;
  position_allowance?: number;
  other_deductions?: number;
}

interface BulkResult {
  employee_name: string;
  employee_npwp?: string;
  ptkp_category: string;
  calculation: PPh21Calculation;
  monthly_tax: number;
  effective_rate: number;
  error?: string;
}

/**
 * POST /api/tax/pph21-bulk
 *
 * Calculate PPh 21 for multiple employees simultaneously
 *
 * Input: { employees: BulkEmployee[], period?: 'annual' | 'monthly' }
 * Output: { results: BulkResult[], summary }
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

    for (const emp of employees) {
      try {
        const data: PPh21Data = {
          employee_name: emp.employee_name,
          employee_npwp: emp.employee_npwp || '',
          employee_nik: emp.employee_nik || '',
          ptkp_category: emp.ptkp_category as PPh21Data['ptkp_category'],
          gross_salary: emp.gross_salary,
          jht_employee: emp.jht_employee || 0,
          jp_employee: emp.jp_employee || 0,
          position_allowance: emp.position_allowance || 0,
          other_deductions: emp.other_deductions || 0,
          tax_period_start: '01',
          tax_period_end: '12',
        };

        const calc = period === 'monthly'
          ? PPh21Calculator.calculateMonthly(data)
          : PPh21Calculator.calculateAnnual(data);

        const monthlyTax = period === 'monthly'
          ? calc.tax_amount
          : Math.round(calc.tax_amount / 12);

        totalGrossIncome += calc.gross_income;
        totalTaxAmount += calc.tax_amount;

        results.push({
          employee_name: emp.employee_name,
          employee_npwp: emp.employee_npwp,
          ptkp_category: emp.ptkp_category,
          calculation: calc,
          monthly_tax: monthlyTax,
          effective_rate: PPh21Calculator.getEffectiveTaxRate(calc.tax_amount, calc.gross_income),
        });
      } catch (err) {
        errorCount++;
        results.push({
          employee_name: emp.employee_name,
          employee_npwp: emp.employee_npwp,
          ptkp_category: emp.ptkp_category,
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
