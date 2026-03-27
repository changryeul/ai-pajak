import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';

/**
 * POST /api/reports/cashflow-forecast
 *
 * AI-based cash flow forecasting with tax reserve recommendations.
 */
async function handleForecast(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { monthlyRevenue, monthlyExpenses, taxRate = 0.005, months = 6, growthRate = 0 } = body;

    if (!monthlyRevenue) {
      return NextResponse.json({ error: 'monthlyRevenue required' }, { status: 400 });
    }

    const forecast = Array.from({ length: months }, (_, i) => {
      const month = i + 1;
      const growth = Math.pow(1 + growthRate / 100, month);
      const revenue = Math.round(monthlyRevenue * growth);
      const expenses = Math.round((monthlyExpenses || monthlyRevenue * 0.6) * growth);
      const netIncome = revenue - expenses;
      const taxReserve = Math.round(revenue * taxRate);
      const freeCashFlow = netIncome - taxReserve;

      return {
        month,
        label: `Bulan ${month}`,
        revenue,
        expenses,
        netIncome,
        taxReserve,
        freeCashFlow,
        cumulativeTaxReserve: 0, // Calculated below
      };
    });

    // Calculate cumulative
    let cumTax = 0;
    for (const f of forecast) {
      cumTax += f.taxReserve;
      f.cumulativeTaxReserve = cumTax;
    }

    const summary = {
      totalRevenue: forecast.reduce((s, f) => s + f.revenue, 0),
      totalExpenses: forecast.reduce((s, f) => s + f.expenses, 0),
      totalTaxReserve: cumTax,
      totalFreeCashFlow: forecast.reduce((s, f) => s + f.freeCashFlow, 0),
      avgMonthlyTax: Math.round(cumTax / months),
      recommendation: cumTax > 5_000_000
        ? `Siapkan rekening terpisah untuk pajak. Sisihkan Rp ${Math.round(cumTax / months).toLocaleString('id-ID')}/bulan.`
        : 'Pajak bulanan relatif kecil. Pastikan pembayaran tepat waktu setiap tanggal 15.',
    };

    return NextResponse.json({ success: true, data: { forecast, summary } });
  } catch {
    return NextResponse.json({ error: 'Forecast failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleForecast);
}
