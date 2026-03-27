import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/tax/transfer-pricing
 *
 * Transfer pricing analysis for related-party transactions.
 * Analyzes arm's length pricing and generates TP documentation.
 */
async function handleTransferPricing(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { transactions, companyName, taxYear } = body as {
      transactions: Array<{
        relatedParty: string;
        transactionType: string;
        amount: number;
        marketPrice?: number;
        description: string;
      }>;
      companyName: string;
      taxYear: number;
    };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'transactions required' }, { status: 400 });
    }

    // Analyze each transaction
    const analysis = transactions.map((tx) => {
      const marketPrice = tx.marketPrice || tx.amount;
      const deviation = marketPrice > 0 ? ((tx.amount - marketPrice) / marketPrice) * 100 : 0;
      const isArmLength = Math.abs(deviation) <= 25; // 25% tolerance

      return {
        ...tx,
        marketPrice,
        deviation: Math.round(deviation * 100) / 100,
        isArmLength,
        riskLevel: Math.abs(deviation) > 50 ? 'HIGH' : Math.abs(deviation) > 25 ? 'MEDIUM' : 'LOW',
        adjustment: isArmLength ? 0 : Math.round(tx.amount - marketPrice),
      };
    });

    const totalAdjustment = analysis.reduce((s, a) => s + Math.abs(a.adjustment), 0);
    const riskyTransactions = analysis.filter(a => !a.isArmLength);

    // AI documentation
    let documentation = '';
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const anthropic = new Anthropic({ apiKey });
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: `Buat ringkasan TP Documentation dalam bahasa Indonesia untuk:
Perusahaan: ${companyName}, Tahun: ${taxYear}
Transaksi afiliasi:
${analysis.map(a => `- ${a.relatedParty}: ${a.transactionType} Rp ${a.amount.toLocaleString('id-ID')} (deviasi ${a.deviation}%)`).join('\n')}

Sertakan: analisis arm's length, metode TP yang disarankan, dan rekomendasi.` }],
        });
        const c = res.content[0];
        documentation = c.type === 'text' ? c.text : '';
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        summary: {
          totalTransactions: transactions.length,
          armLengthCount: analysis.filter(a => a.isArmLength).length,
          adjustmentNeeded: riskyTransactions.length,
          totalAdjustment,
        },
        documentation,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'TP analysis failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleTransferPricing);
}
