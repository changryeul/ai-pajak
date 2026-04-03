import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { PTKP_RATES } from '@/lib/tax/shared/constants';

interface YearData {
  year: number;
  grossIncome: number;
  netIncome: number;
  deductions: number;
  ptkp: number;
  taxableIncome: number;
  taxDue: number;
  taxWithheld: number;
  status: string;
  filingCount: number;
  employers: string[];
  effectiveRate: number;
}

/**
 * GET /api/reports/comparison?years=2025,2024,2023&customerId=xxx
 *
 * Multi-year tax comparison data
 */
async function handleComparison(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const yearsParam = url.searchParams.get('years') || '';
  const customerIdParam = url.searchParams.get('customerId');
  const { role, userId } = req.session;

  const years = yearsParam.split(',').map(Number).filter(y => y >= 2020 && y <= 2030);
  if (years.length === 0) {
    return NextResponse.json({ error: 'At least one valid year required' }, { status: 400 });
  }

  try {
    let customerId = customerIdParam;

    if (!customerId && role === 'CUSTOMER') {
      const { data: customer } = await getSupabaseAdmin()
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();
      customerId = customer?.id || null;
    }

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const yearDataList: YearData[] = [];

    for (const year of years) {
      // Fetch tax calculations for this year
      const { data: calculations } = await getSupabaseAdmin()
        .from('tax_calculation')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tax_year', year)
        .eq('tax_type', 'PPh21');

      // Fetch filings for this year
      const { data: filings } = await getSupabaseAdmin()
        .from('tax_filing')
        .select('id, tax_type, status, tax_data')
        .eq('customer_id', customerId)
        .eq('tax_year', year);

      let grossIncome = 0;
      let netIncome = 0;
      let deductions = 0;
      let taxDue = 0;
      let taxWithheld = 0;
      const employers: string[] = [];

      if (calculations && calculations.length > 0) {
        for (const calc of calculations) {
          const result = calc.calculation_result || {};
          const incomeData = calc.income_data || {};
          grossIncome += result.grossIncome || 0;
          netIncome += result.netIncome || 0;
          deductions += (result.positionCosts || 0) + (result.pensionContribution || 0);
          taxDue += result.taxDue || result.pphTerutang || 0;
          taxWithheld += result.calculatedTax || result.pphDipotong || 0;
          if (incomeData.employer_name) {
            employers.push(incomeData.employer_name);
          }
        }
      }

      // Also check filed SPT data
      if (filings) {
        for (const filing of filings) {
          const taxData = filing.tax_data as Record<string, unknown> | null;
          if (taxData?.summary) {
            const summary = taxData.summary as Record<string, number>;
            if (grossIncome === 0) grossIncome = summary.totalGrossIncome || 0;
            if (netIncome === 0) netIncome = summary.totalNetIncome || 0;
            if (taxDue === 0) taxDue = summary.taxDue || 0;
            if (taxWithheld === 0) taxWithheld = summary.totalTaxWithheld || 0;
          }
        }
      }

      const ptkp = PTKP_RATES['TK/0']; // Default, ideally from customer profile
      const taxableIncome = Math.max(0, netIncome - ptkp);
      const difference = taxDue - taxWithheld;
      const status = difference === 0 ? 'NIHIL' : difference > 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR';

      yearDataList.push({
        year,
        grossIncome,
        netIncome,
        deductions,
        ptkp,
        taxableIncome,
        taxDue,
        taxWithheld,
        status,
        filingCount: filings?.length || 0,
        employers,
        effectiveRate: grossIncome > 0 ? taxDue / grossIncome : 0,
      });
    }

    // Calculate changes
    const changes = yearDataList.length >= 2
      ? calculateChanges(yearDataList)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        years: yearDataList,
        changes,
        insights: generateInsights(yearDataList),
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Comparison report error');
    return NextResponse.json(
      { error: 'Failed to generate comparison' },
      { status: 500 }
    );
  }
}

function calculateChanges(years: YearData[]) {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  const changes: Array<{
    fromYear: number;
    toYear: number;
    grossIncomeChange: number;
    grossIncomeChangePercent: number;
    taxDueChange: number;
    taxDueChangePercent: number;
    effectiveRateChange: number;
  }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    changes.push({
      fromYear: prev.year,
      toYear: curr.year,
      grossIncomeChange: curr.grossIncome - prev.grossIncome,
      grossIncomeChangePercent: prev.grossIncome > 0 ? ((curr.grossIncome - prev.grossIncome) / prev.grossIncome) * 100 : 0,
      taxDueChange: curr.taxDue - prev.taxDue,
      taxDueChangePercent: prev.taxDue > 0 ? ((curr.taxDue - prev.taxDue) / prev.taxDue) * 100 : 0,
      effectiveRateChange: curr.effectiveRate - prev.effectiveRate,
    });
  }
  return changes;
}

function generateInsights(years: YearData[]): string[] {
  const insights: string[] = [];
  if (years.length < 2) return insights;

  const sorted = [...years].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (latest.grossIncome > previous.grossIncome) {
    const pct = ((latest.grossIncome - previous.grossIncome) / previous.grossIncome * 100).toFixed(1);
    insights.push(`Penghasilan bruto naik ${pct}% dari ${previous.year} ke ${latest.year}.`);
  } else if (latest.grossIncome < previous.grossIncome) {
    const pct = ((previous.grossIncome - latest.grossIncome) / previous.grossIncome * 100).toFixed(1);
    insights.push(`Penghasilan bruto turun ${pct}% dari ${previous.year} ke ${latest.year}.`);
  }

  if (latest.effectiveRate > previous.effectiveRate + 0.01) {
    insights.push(`Tarif efektif naik dari ${(previous.effectiveRate * 100).toFixed(1)}% ke ${(latest.effectiveRate * 100).toFixed(1)}%. Pertimbangkan optimalisasi pajak.`);
  }

  if (latest.status === 'LEBIH_BAYAR') {
    insights.push(`Tahun ${latest.year} ada lebih bayar. Pastikan mengajukan restitusi.`);
  }

  if (latest.employers.length > previous.employers.length) {
    insights.push(`Jumlah pemberi kerja bertambah (${previous.employers.length} → ${latest.employers.length}). Pastikan semua bukti potong tercakup.`);
  }

  return insights;
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleComparison);
}
