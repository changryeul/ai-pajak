import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/reports/benchmarking?industry=RETAIL&revenue=1000000000
 *
 * Compare client's tax metrics against industry averages.
 */

// Industry benchmark data (based on DJP statistics)
const BENCHMARKS: Record<string, { avgEffectiveRate: number; avgDeductionRatio: number; avgGrossMargin: number }> = {
  RETAIL: { avgEffectiveRate: 0.8, avgDeductionRatio: 12, avgGrossMargin: 25 },
  MANUFACTURING: { avgEffectiveRate: 1.2, avgDeductionRatio: 15, avgGrossMargin: 30 },
  SERVICES: { avgEffectiveRate: 2.5, avgDeductionRatio: 20, avgGrossMargin: 45 },
  TECHNOLOGY: { avgEffectiveRate: 3.0, avgDeductionRatio: 25, avgGrossMargin: 60 },
  FNB: { avgEffectiveRate: 0.5, avgDeductionRatio: 10, avgGrossMargin: 40 },
  CONSTRUCTION: { avgEffectiveRate: 1.5, avgDeductionRatio: 18, avgGrossMargin: 20 },
  TRADING: { avgEffectiveRate: 0.6, avgDeductionRatio: 8, avgGrossMargin: 15 },
  PROFESSIONAL: { avgEffectiveRate: 4.0, avgDeductionRatio: 30, avgGrossMargin: 70 },
};

async function handleBenchmark(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const industry = url.searchParams.get('industry') || 'RETAIL';
  const revenue = parseInt(url.searchParams.get('revenue') || '0');
  const effectiveRate = parseFloat(url.searchParams.get('effectiveRate') || '0');
  const deductionRatio = parseFloat(url.searchParams.get('deductionRatio') || '0');

  const benchmark = BENCHMARKS[industry.toUpperCase()] || BENCHMARKS.RETAIL;

  const comparison = {
    effectiveRate: {
      yours: effectiveRate,
      industry: benchmark.avgEffectiveRate,
      status: effectiveRate < benchmark.avgEffectiveRate * 0.5 ? 'BELOW' :
              effectiveRate > benchmark.avgEffectiveRate * 1.5 ? 'ABOVE' : 'NORMAL',
    },
    deductionRatio: {
      yours: deductionRatio,
      industry: benchmark.avgDeductionRatio,
      status: deductionRatio > benchmark.avgDeductionRatio * 1.5 ? 'HIGH' : 'NORMAL',
    },
  };

  return NextResponse.json({
    success: true,
    data: {
      industry,
      benchmark,
      comparison,
      availableIndustries: Object.keys(BENCHMARKS),
      insight: comparison.effectiveRate.status === 'BELOW'
        ? 'Tarif efektif Anda di bawah rata-rata industri. Pastikan semua penghasilan sudah dilaporkan.'
        : comparison.effectiveRate.status === 'ABOVE'
          ? 'Tarif efektif Anda di atas rata-rata. Pertimbangkan optimalisasi pajak.'
          : 'Tarif efektif Anda sejalan dengan rata-rata industri.',
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth)(request as RequestWithSession, handleBenchmark);
}
