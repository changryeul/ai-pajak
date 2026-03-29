import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { PTKP_RATES, TAX_BRACKETS } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/tax/predict
 *
 * Predictive tax planning - simulate quarterly/annual tax based on current data
 */
async function handlePredict(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, currentMonthlyIncome, ptkpStatus = 'TK/0', taxYear, growthRate = 0 } = body;

    if (!currentMonthlyIncome || !taxYear) {
      return NextResponse.json({ error: 'currentMonthlyIncome and taxYear required' }, { status: 400 });
    }

    const ptkp = PTKP_RATES[ptkpStatus as PTKPStatus] || PTKP_RATES['TK/0'];

    // Simulate quarterly projections
    const quarters = [1, 2, 3, 4].map((q) => {
      const months = q * 3;
      const rate = 1 + (growthRate / 100 / 12);
      let cumulativeGross = 0;
      for (let m = 1; m <= months; m++) {
        cumulativeGross += currentMonthlyIncome * Math.pow(rate, m - 1);
      }
      const annualizedGross = (cumulativeGross / months) * 12;
      const positionCost = Math.min(annualizedGross * 0.05, 6_000_000);
      const netIncome = annualizedGross - positionCost;
      const pkp = Math.max(0, netIncome - ptkp);
      const taxDue = calcTax(pkp);

      return {
        quarter: `Q${q}`,
        monthsElapsed: months,
        cumulativeGross: Math.round(cumulativeGross),
        projectedAnnualGross: Math.round(annualizedGross),
        projectedTaxDue: Math.round(taxDue),
        projectedMonthlyTax: Math.round(taxDue / 12),
        effectiveRate: annualizedGross > 0 ? (taxDue / annualizedGross * 100) : 0,
      };
    });

    // Scenario comparison
    const scenarios = [
      { name: 'Tanpa Kenaikan', growth: 0 },
      { name: 'Kenaikan 5%', growth: 5 },
      { name: 'Kenaikan 10%', growth: 10 },
      { name: 'Kenaikan 20%', growth: 20 },
    ].map((s) => {
      const annualGross = currentMonthlyIncome * 12 * (1 + s.growth / 100);
      const posCost = Math.min(annualGross * 0.05, 6_000_000);
      const net = annualGross - posCost;
      const pkp = Math.max(0, net - ptkp);
      const tax = calcTax(pkp);
      return {
        scenario: s.name,
        growthRate: s.growth,
        annualGross: Math.round(annualGross),
        taxDue: Math.round(tax),
        monthlyTax: Math.round(tax / 12),
        effectiveRate: annualGross > 0 ? (tax / annualGross * 100) : 0,
      };
    });

    // Tax bracket analysis
    const annualGross = currentMonthlyIncome * 12;
    const posCost = Math.min(annualGross * 0.05, 6_000_000);
    const currentPkp = Math.max(0, annualGross - posCost - ptkp);
    const currentBracket = TAX_BRACKETS.find((b, i) => {
      const prevLimit = i > 0 ? TAX_BRACKETS[i - 1].limit : 0;
      return currentPkp > prevLimit && currentPkp <= b.limit;
    });
    const nextBracketIdx = TAX_BRACKETS.findIndex(b => b.limit > currentPkp);
    const nextBracket = nextBracketIdx >= 0 ? TAX_BRACKETS[nextBracketIdx] : null;
    const roomToNextBracket = nextBracket ? nextBracket.limit - currentPkp : 0;

    // AI insights
    let aiInsights = '';
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const anthropic = new Anthropic({ apiKey });
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{ role: 'user', content: `Berikan 3 tips perencanaan pajak singkat dalam bahasa Indonesia untuk WP dengan:
- Penghasilan bulanan: Rp ${currentMonthlyIncome.toLocaleString('id-ID')}
- PKP saat ini: Rp ${currentPkp.toLocaleString('id-ID')}
- Bracket saat ini: ${currentBracket?.rate ? (currentBracket.rate * 100) + '%' : '-'}
- Ruang ke bracket berikutnya: Rp ${roomToNextBracket.toLocaleString('id-ID')}
- PTKP: ${ptkpStatus}
Format: bullet points, masing-masing 1 kalimat.` }],
        });
        const c = res.content[0];
        aiInsights = c.type === 'text' ? c.text : '';
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: {
        quarters,
        scenarios,
        bracketAnalysis: {
          currentPkp,
          currentBracketRate: currentBracket?.rate ? currentBracket.rate * 100 : 0,
          nextBracketRate: nextBracket?.rate ? nextBracket.rate * 100 : null,
          roomToNextBracket,
          incomeToReachNextBracket: roomToNextBracket > 0 ? Math.round(roomToNextBracket / 12) : 0,
        },
        aiInsights,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Prediction failed' }, { status: 500 });
  }
}

function calcTax(pkp: number): number {
  if (pkp <= 0) return 0;
  let tax = 0, remaining = pkp, prev = 0;
  for (const b of TAX_BRACKETS) {
    const t = Math.min(remaining, b.limit - prev);
    if (t <= 0) break;
    tax += t * b.rate;
    remaining -= t;
    prev = b.limit;
  }
  return Math.round(tax);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePredict);
}
