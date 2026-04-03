import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { AnnualAggregator } from '@/lib/tax/annual-aggregator';

/**
 * POST /api/tax/annual-simulation
 *
 * Calculates projected annual tax based on year-to-date monthly filings.
 * Projects remaining months using average of last 3 months.
 */
async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { customerId, taxYear } = body;

  if (!customerId || !taxYear) {
    return NextResponse.json({ error: 'customerId and taxYear required' }, { status: 400 });
  }

  try {
    const annual = await AnnualAggregator.aggregate(customerId, taxYear);
    const currentMonth = new Date().getMonth() + 1;
    const monthsElapsed = taxYear < new Date().getFullYear() ? 12 : currentMonth;
    const monthsRemaining = 12 - monthsElapsed;

    // Calculate monthly averages from PPh21
    const pph21Months = annual.pph21.monthlyBreakdown;
    const recentMonths = pph21Months.slice(-3);
    const avgMonthlyGross = recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.grossIncome, 0) / recentMonths.length
      : 0;
    const avgMonthlyTax = recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.taxWithheld, 0) / recentMonths.length
      : 0;

    // Project full year
    const projectedAnnualGross = annual.pph21.totalGross + (avgMonthlyGross * monthsRemaining);
    const projectedAnnualTax = annual.pph21.totalWithheld + (avgMonthlyTax * monthsRemaining);

    // PPh23 projection
    const pph23MonthlyAvg = annual.pph23.transactionCount > 0
      ? annual.pph23.totalWithheld / Math.max(monthsElapsed, 1)
      : 0;
    const projectedPPh23 = annual.pph23.totalWithheld + (pph23MonthlyAvg * monthsRemaining);

    // Total projected credits
    const projectedTotalCredits = projectedAnnualTax + projectedPPh23 + annual.pph22.totalWithheld + annual.pph25.totalInstallments;

    return NextResponse.json({
      success: true,
      data: {
        taxYear,
        monthsElapsed,
        monthsRemaining,

        // Year-to-date actual
        ytd: {
          pph21Gross: annual.pph21.totalGross,
          pph21Withheld: annual.pph21.totalWithheld,
          pph23Withheld: annual.pph23.totalWithheld,
          pph22Withheld: annual.pph22.totalWithheld,
          pph25Installments: annual.pph25.totalInstallments,
          totalCredits: annual.totalTaxCredits,
        },

        // Projected full year
        projected: {
          annualGross: Math.round(projectedAnnualGross),
          annualPPh21: Math.round(projectedAnnualTax),
          annualPPh23: Math.round(projectedPPh23),
          totalCredits: Math.round(projectedTotalCredits),
        },

        // Monthly breakdown for chart
        monthlyBreakdown: Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const period = `${taxYear}-${String(m).padStart(2, '0')}`;
          const actual = pph21Months.find(p => p.period === period);
          return {
            month: m,
            period,
            grossIncome: actual?.grossIncome || (m > monthsElapsed ? Math.round(avgMonthlyGross) : 0),
            taxWithheld: actual?.taxWithheld || (m > monthsElapsed ? Math.round(avgMonthlyTax) : 0),
            isProjected: m > monthsElapsed,
          };
        }),

        // Data source info
        dataSource: annual.dataSource,
        monthsWithData: annual.monthsWithData,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost);
}
