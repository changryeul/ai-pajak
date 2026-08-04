import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import type { PPh21Data } from '@/types';

interface EBupotItem {
  employeeName: string;
  employeeNpwp: string;
  employeeNik: string;
  ptkpCategory: string;
  buktiPotongNumber: string;
  taxYear: number;
  periodStart: string; // MM
  periodEnd: string; // MM
  grossIncome: number;
  positionCosts: number;
  pensionContribution: number;
  netIncome: number;
  ptkpAmount: number;
  taxableIncome: number;
  taxDue: number;
  taxWithheld: number;
  generatedAt: string;
}

/**
 * POST /api/tax/ebupot-bulk
 *
 * Generate bulk e-Bupot (Bukti Potong) 1721-A1 for all employees.
 * Used by corporate HRD to generate year-end withholding certificates.
 *
 * Input: { employees: PPh21Data[], taxYear: number, companyNpwp, companyName }
 * Output: { items: EBupotItem[], summary }
 */
async function handleBulkEbupot(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { employees, taxYear, companyNpwp, companyName } = body as {
      employees: (PPh21Data & { employee_nik?: string })[];
      taxYear: number;
      companyNpwp: string;
      companyName: string;
    };

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: 'employees array required' }, { status: 400 });
    }
    if (!taxYear || !companyNpwp) {
      return NextResponse.json({ error: 'taxYear and companyNpwp required' }, { status: 400 });
    }
    if (employees.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 employees per batch' }, { status: 400 });
    }

    const items: EBupotItem[] = [];
    let errorCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const calc = PPh21Calculator.calculateAnnual(emp);

        // Generate Bukti Potong number: 1.1-MM.YY-XXXXXXX
        const bpNumber = `1.1-12.${String(taxYear).slice(-2)}-${String(i + 1).padStart(7, '0')}`;

        items.push({
          employeeName: emp.employee_name,
          employeeNpwp: emp.employee_npwp,
          employeeNik: emp.employee_nik || '',
          ptkpCategory: emp.ptkp_category,
          buktiPotongNumber: bpNumber,
          taxYear,
          periodStart: emp.tax_period_start || '01',
          periodEnd: emp.tax_period_end || '12',
          grossIncome: calc.gross_income,
          positionCosts: Math.min(calc.gross_income * 0.05, 6_000_000),
          pensionContribution: (emp.jp_employee || 0) * 12,
          netIncome: calc.net_income,
          ptkpAmount: calc.ptkp,
          taxableIncome: calc.taxable_income,
          taxDue: calc.tax_amount,
          taxWithheld: calc.tax_amount,
          generatedAt: new Date().toISOString(),
        });
      } catch {
        errorCount++;
      }
    }

    // Generate CSV content
    const csvHeaders = 'No,Nama,NPWP,NIK,PTKP,No Bukti Potong,Tahun,Bruto,Biaya Jabatan,Iuran Pensiun,Neto,PTKP,PKP,PPh Terutang,PPh Dipotong\n';
    const csvRows = items.map((item, i) =>
      `${i + 1},"${item.employeeName}","${item.employeeNpwp}","${item.employeeNik}","${item.ptkpCategory}","${item.buktiPotongNumber}",${item.taxYear},${item.grossIncome},${item.positionCosts},${item.pensionContribution},${item.netIncome},${item.ptkpAmount},${item.taxableIncome},${item.taxDue},${item.taxWithheld}`
    ).join('\n');

    return NextResponse.json({
      success: true,
      data: {
        items,
        csv: csvHeaders + csvRows,
        summary: {
          companyName,
          companyNpwp,
          taxYear,
          totalEmployees: items.length,
          errorCount,
          totalGrossIncome: items.reduce((s, i) => s + i.grossIncome, 0),
          totalTaxWithheld: items.reduce((s, i) => s + i.taxWithheld, 0),
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk e-Bupot generation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleBulkEbupot);
}
