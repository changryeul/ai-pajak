import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

/**
 * POST /api/tax/transfer-pricing
 *
 * Arm's length analysis for related-party transactions, with PMK
 * 213/PMK.03/2016 threshold gating and a three-section TP documentation
 * template (Master File / Local File / Executive Summary).
 *
 * Thresholds (PMK 213/2016 Pasal 2):
 *   - Revenue ≥ IDR 50 billion  → Local File required
 *   - Revenue ≥ IDR 50 billion AND related-party tx ≥ IDR 20 billion (goods)
 *     or ≥ IDR 5 billion (services/interest/royalty) → Master + Local File
 *   - Group consolidated revenue ≥ IDR 11 trillion → CbCR
 */

type TxCategory = 'GOODS' | 'SERVICES' | 'ROYALTY' | 'INTEREST' | 'FINANCIAL';

interface IncomingTx {
  relatedParty: string;
  transactionType: string;
  category?: TxCategory;
  amount: number;
  marketPrice?: number;
  description: string;
  country?: string;
  functions?: string;
  assets?: string;
  risks?: string;
}

interface AnalyzedTx extends IncomingTx {
  marketPrice: number;
  deviation: number;
  isArmLength: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  adjustment: number;
}

const GOODS_THRESHOLD = 20_000_000_000;      // Rp 20 B (goods)
const OTHER_THRESHOLD = 5_000_000_000;       // Rp 5  B (services/royalty/interest/financial)
const REVENUE_THRESHOLD = 50_000_000_000;    // Rp 50 B (triggers Local File)
const CBCR_THRESHOLD = 11_000_000_000_000;   // Rp 11 T (triggers CbCR)

function riskFor(deviation: number, category: TxCategory | undefined): 'LOW' | 'MEDIUM' | 'HIGH' {
  const abs = Math.abs(deviation);
  // Intangibles (royalty) and interest get tighter tolerance
  const tight = category === 'ROYALTY' || category === 'INTEREST';
  if (abs > (tight ? 25 : 50)) return 'HIGH';
  if (abs > (tight ? 10 : 25)) return 'MEDIUM';
  return 'LOW';
}

async function handleTransferPricing(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      transactions,
      companyName,
      taxYear,
      annualRevenue,
      tpMethod,
      industry,
    } = body as {
      transactions: IncomingTx[];
      companyName: string;
      taxYear: number;
      annualRevenue?: number;
      tpMethod?: string;
      industry?: string;
    };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'transactions required' }, { status: 400 });
    }

    const analysis: AnalyzedTx[] = transactions.map((tx) => {
      const marketPrice = tx.marketPrice || tx.amount;
      const deviation = marketPrice > 0 ? ((tx.amount - marketPrice) / marketPrice) * 100 : 0;
      const risk = riskFor(deviation, tx.category);
      return {
        ...tx,
        category: tx.category || 'GOODS',
        marketPrice,
        deviation: Math.round(deviation * 100) / 100,
        isArmLength: risk === 'LOW',
        riskLevel: risk,
        adjustment: risk === 'LOW' ? 0 : Math.round(tx.amount - marketPrice),
      };
    });

    const totalAdjustment = analysis.reduce((s, a) => s + Math.abs(a.adjustment), 0);
    const riskyTransactions = analysis.filter((a) => !a.isArmLength);

    // PMK 213/2016 compliance check
    const goodsTotal = analysis
      .filter((a) => a.category === 'GOODS')
      .reduce((s, a) => s + a.amount, 0);
    const otherTotal = analysis
      .filter((a) => a.category !== 'GOODS')
      .reduce((s, a) => s + a.amount, 0);

    const revenue = annualRevenue || 0;
    const triggersLocalFile =
      revenue >= REVENUE_THRESHOLD ||
      goodsTotal >= GOODS_THRESHOLD ||
      otherTotal >= OTHER_THRESHOLD;
    const triggersMasterFile =
      revenue >= REVENUE_THRESHOLD &&
      (goodsTotal >= GOODS_THRESHOLD || otherTotal >= OTHER_THRESHOLD);
    const triggersCbCR = revenue >= CBCR_THRESHOLD;

    const compliance = {
      triggersLocalFile,
      triggersMasterFile,
      triggersCbCR,
      requiredDocs: [
        ...(triggersMasterFile ? ['Master File'] : []),
        ...(triggersLocalFile ? ['Local File'] : []),
        ...(triggersCbCR ? ['Country-by-Country Report'] : []),
      ],
      legalBasis: 'PMK 213/PMK.03/2016 Pasal 2 · UU PPh Pasal 18(3)',
    };

    // AI generates three sections. Falls back to deterministic template if
    // ANTHROPIC_API_KEY is missing so the endpoint still returns content.
    let masterFile = '';
    let localFile = '';
    let executiveSummary = '';

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && analysis.length > 0) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const prompt = `You are an Indonesian transfer pricing specialist. Generate TP documentation in Bahasa Indonesia per PMK 213/2016 for the following:

Perusahaan: ${companyName || '—'}
Tahun Pajak: ${taxYear || '—'}
Industri: ${industry || '—'}
Metode TP: ${tpMethod || 'CUP'}
Pendapatan Tahunan: ${annualRevenue ? `Rp ${annualRevenue.toLocaleString('id-ID')}` : 'tidak disebutkan'}
Transaksi afiliasi: ${analysis.length}
${analysis
  .map(
    (a) => `- [${a.category}] ${a.relatedParty} (${a.country || 'ID'}): ${a.transactionType}
  Nilai: Rp ${a.amount.toLocaleString('id-ID')} | Harga Pasar: Rp ${a.marketPrice.toLocaleString('id-ID')} | Deviasi: ${a.deviation}% | Risiko: ${a.riskLevel}
  Fungsi: ${a.functions || '—'} | Aset: ${a.assets || '—'} | Risiko Bisnis: ${a.risks || '—'}`,
  )
  .join('\n')}

Output format — respond with three sections separated by the exact markers below, NO extra commentary:

### MASTER_FILE
(Overview grup afiliasi: struktur organisasi, kegiatan bisnis, kebijakan TP grup, rantai nilai, aset tak berwujud. Maks 8 bullet.)

### LOCAL_FILE
(Analisis entitas lokal per transaksi: FAR analysis, metode TP + alasan, tested party, rentang arm's length, adjustment jika perlu. Maks 10 bullet.)

### SUMMARY
(Eksekutif summary 3-4 bullet + peringatan PMK 213 jika threshold terpenuhi.)`;
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1800,
          messages: [{ role: 'user', content: prompt }],
        });
        const full = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
        const mf = full.match(/### MASTER_FILE\s*([\s\S]*?)(?=### LOCAL_FILE|$)/);
        const lf = full.match(/### LOCAL_FILE\s*([\s\S]*?)(?=### SUMMARY|$)/);
        const sm = full.match(/### SUMMARY\s*([\s\S]*)/);
        masterFile = mf ? mf[1].trim() : '';
        localFile = lf ? lf[1].trim() : '';
        executiveSummary = sm ? sm[1].trim() : full.trim();
      } catch (err) {
        loggers.api.warn({ err }, 'TP: anthropic call failed, using template fallback');
      }
    }

    // Template fallback — deterministic content when AI unavailable
    if (!masterFile) {
      masterFile = `Grup: ${companyName || 'PT …'} (${industry || 'sektor tidak disebutkan'})
- Struktur kepemilikan dan entitas afiliasi perlu dijelaskan dalam diagram organisasi.
- Kebijakan harga transfer grup mengadopsi ${tpMethod || 'CUP'} sebagai metode utama.
- Rantai nilai, aset tak berwujud, dan kontrak material perlu dirangkum.`;
    }
    if (!localFile) {
      localFile = analysis
        .map(
          (a, i) =>
            `${i + 1}. ${a.relatedParty} — ${a.transactionType} (${a.category})
   Nilai: Rp ${a.amount.toLocaleString('id-ID')}, Deviasi: ${a.deviation}%, Risiko: ${a.riskLevel}
   FAR: ${a.functions || 'Belum dijelaskan'} / ${a.assets || '—'} / ${a.risks || '—'}`,
        )
        .join('\n');
    }
    if (!executiveSummary) {
      executiveSummary =
        `${analysis.length} transaksi afiliasi dianalisis. ${riskyTransactions.length} di luar arm's length dengan total adjustment potensial Rp ${totalAdjustment.toLocaleString('id-ID')}. ` +
        (compliance.requiredDocs.length
          ? `Dokumen wajib: ${compliance.requiredDocs.join(', ')}.`
          : 'Belum melewati ambang PMK 213/2016.');
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        summary: {
          totalTransactions: transactions.length,
          armLengthCount: analysis.filter((a) => a.isArmLength).length,
          adjustmentNeeded: riskyTransactions.length,
          totalAdjustment,
          byCategory: {
            GOODS: goodsTotal,
            NON_GOODS: otherTotal,
          },
        },
        compliance,
        documentation: {
          masterFile,
          localFile,
          executiveSummary,
        },
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'TP analysis failed');
    return NextResponse.json({ error: 'TP analysis failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    handleTransferPricing,
  );
}
