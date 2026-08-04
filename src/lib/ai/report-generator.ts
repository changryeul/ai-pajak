/**
 * AI Report Generator
 *
 * Generates comprehensive tax analysis reports for consultants.
 * Uses AI to create narrative summaries and actionable insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import { loggers } from '@/lib/logger';

export interface ReportInput {
  customer: {
    name: string;
    npwp?: string;
    nik?: string;
    address?: string;
  };
  taxYear: number;
  ptkpStatus: PTKPStatus;
  incomeSources: Array<{
    employerName: string;
    employerNpwp?: string;
    grossIncome: number;
    netIncome: number;
    taxWithheld: number;
    periodStart: string;
    periodEnd: string;
  }>;
  filingHistory?: Array<{
    taxType: string;
    taxYear: number;
    status: string;
    filedAt?: string;
  }>;
  language: 'id' | 'en' | 'ko';
}

export interface GeneratedReport {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
  metadata: {
    taxYear: number;
    customerName: string;
    generatedBy: string;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

/**
 * Generate a comprehensive client tax report
 */
export async function generateClientReport(input: ReportInput): Promise<GeneratedReport> {
  const totalGross = input.incomeSources.reduce((s, i) => s + i.grossIncome, 0);
  const totalNet = input.incomeSources.reduce((s, i) => s + i.netIncome, 0);
  const totalWithheld = input.incomeSources.reduce((s, i) => s + i.taxWithheld, 0);
  const ptkp = PTKP_RATES[input.ptkpStatus];
  const pkp = Math.max(0, totalNet - ptkp);
  const taxDue = calculateTax(pkp);
  const difference = taxDue - totalWithheld;

  // Build data sections
  const sections: ReportSection[] = [];

  // Section 1: Client Profile
  sections.push({
    id: 'profile',
    title: 'Profil Wajib Pajak',
    content: '',
    data: {
      name: input.customer.name,
      npwp: input.customer.npwp || '-',
      nik: input.customer.nik || '-',
      address: input.customer.address || '-',
      ptkpStatus: input.ptkpStatus,
      ptkpAmount: ptkp,
      taxYear: input.taxYear,
    },
  });

  // Section 2: Income Summary
  sections.push({
    id: 'income',
    title: 'Ringkasan Penghasilan',
    content: '',
    data: {
      sources: input.incomeSources.map((s) => ({
        employer: s.employerName,
        npwp: s.employerNpwp || '-',
        period: `${s.periodStart}-${s.periodEnd}`,
        gross: s.grossIncome,
        net: s.netIncome,
        withheld: s.taxWithheld,
      })),
      totalGross,
      totalNet,
      totalDeductions: totalGross - totalNet,
      totalWithheld,
    },
  });

  // Section 3: Tax Calculation
  sections.push({
    id: 'calculation',
    title: 'Perhitungan Pajak',
    content: '',
    data: {
      totalNetIncome: totalNet,
      ptkp,
      ptkpStatus: input.ptkpStatus,
      pkp,
      taxDue,
      totalWithheld,
      difference,
      status: difference === 0 ? 'NIHIL' : difference > 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR',
      effectiveRate: totalGross > 0 ? ((taxDue / totalGross) * 100).toFixed(2) + '%' : '0%',
    },
  });

  // Section 4: Filing Status
  if (input.filingHistory && input.filingHistory.length > 0) {
    sections.push({
      id: 'filing',
      title: 'Riwayat Pelaporan',
      content: '',
      data: {
        history: input.filingHistory,
      },
    });
  }

  // Section 5: AI Analysis
  const aiAnalysis = await generateAIAnalysis(input, {
    totalGross,
    totalNet,
    totalWithheld,
    ptkp,
    pkp,
    taxDue,
    difference,
  });

  sections.push({
    id: 'analysis',
    title: 'Analisis & Rekomendasi',
    content: aiAnalysis,
  });

  return {
    title: `Laporan Analisis Pajak - ${input.customer.name} - Tahun ${input.taxYear}`,
    generatedAt: new Date().toISOString(),
    sections,
    metadata: {
      taxYear: input.taxYear,
      customerName: input.customer.name,
      generatedBy: 'AI Pajak Report Generator',
    },
  };
}

async function generateAIAnalysis(
  input: ReportInput,
  calc: {
    totalGross: number;
    totalNet: number;
    totalWithheld: number;
    ptkp: number;
    pkp: number;
    taxDue: number;
    difference: number;
  }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateFallbackAnalysis(input, calc);
  }

  const langInstructions: Record<string, string> = {
    id: 'Tulis dalam Bahasa Indonesia yang formal dan profesional.',
    en: 'Write in professional English.',
    ko: '전문적인 한국어로 작성해주세요.',
  };

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Anda adalah konsultan pajak senior Indonesia. Buat laporan analisis pajak komprehensif untuk klien.

${langInstructions[input.language] || langInstructions.id}

DATA KLIEN:
- Nama: ${input.customer.name}
- NPWP: ${input.customer.npwp || 'Tidak tersedia'}
- Status PTKP: ${input.ptkpStatus}
- Tahun Pajak: ${input.taxYear}
- Jumlah Pemberi Kerja: ${input.incomeSources.length}

DATA KEUANGAN:
- Total Penghasilan Bruto: Rp ${calc.totalGross.toLocaleString('id-ID')}
- Total Penghasilan Neto: Rp ${calc.totalNet.toLocaleString('id-ID')}
- PTKP: Rp ${calc.ptkp.toLocaleString('id-ID')}
- PKP: Rp ${calc.pkp.toLocaleString('id-ID')}
- PPh Terutang: Rp ${calc.taxDue.toLocaleString('id-ID')}
- PPh Dipotong: Rp ${calc.totalWithheld.toLocaleString('id-ID')}
- Selisih: Rp ${Math.abs(calc.difference).toLocaleString('id-ID')} (${calc.difference > 0 ? 'Kurang Bayar' : calc.difference < 0 ? 'Lebih Bayar' : 'Nihil'})
- Tarif Efektif: ${calc.totalGross > 0 ? ((calc.taxDue / calc.totalGross) * 100).toFixed(2) : 0}%

DETAIL PENGHASILAN:
${input.incomeSources.map((s, i) => `${i + 1}. ${s.employerName} - Bruto: Rp ${s.grossIncome.toLocaleString('id-ID')}, PPh: Rp ${s.taxWithheld.toLocaleString('id-ID')}, Periode: ${s.periodStart}-${s.periodEnd}`).join('\n')}

Buat laporan dengan format:

## 1. Ringkasan Eksekutif
(2-3 paragraf tentang kondisi perpajakan klien secara keseluruhan)

## 2. Analisis Penghasilan
(Analisis sumber penghasilan, distribusi, dan tren)

## 3. Analisis Kepatuhan
(Status kepatuhan, apakah ada risiko, deadline)

## 4. Peluang Optimalisasi
(Strategi legal untuk optimalisasi pajak, minimal 3 poin)

## 5. Rekomendasi Tindakan
(Langkah konkret yang harus diambil, dalam format checklist)

## 6. Catatan untuk Konsultan
(Hal-hal yang perlu diperhatikan oleh konsultan pajak)

Gunakan data aktual dalam analisis. Jangan membuat data yang tidak ada.`,
      }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  } catch (error) {
    loggers.api.error({ err: error }, 'AI report generation error');
    return generateFallbackAnalysis(input, calc);
  }
}

function generateFallbackAnalysis(
  input: ReportInput,
  calc: { totalGross: number; totalNet: number; totalWithheld: number; ptkp: number; pkp: number; taxDue: number; difference: number }
): string {
  const status = calc.difference === 0 ? 'NIHIL' : calc.difference > 0 ? 'Kurang Bayar' : 'Lebih Bayar';
  const effectiveRate = calc.totalGross > 0 ? ((calc.taxDue / calc.totalGross) * 100).toFixed(2) : '0';

  return `## 1. Ringkasan Eksekutif

${input.customer.name} memiliki total penghasilan bruto sebesar Rp ${calc.totalGross.toLocaleString('id-ID')} dari ${input.incomeSources.length} pemberi kerja untuk tahun pajak ${input.taxYear}. Dengan status PTKP ${input.ptkpStatus}, PPh terutang sebesar Rp ${calc.taxDue.toLocaleString('id-ID')} dengan tarif efektif ${effectiveRate}%.

Status SPT: **${status}** ${calc.difference !== 0 ? `sebesar Rp ${Math.abs(calc.difference).toLocaleString('id-ID')}` : ''}.

## 2. Analisis Penghasilan

${input.incomeSources.map((s, _i) => `- **${s.employerName}**: Bruto Rp ${s.grossIncome.toLocaleString('id-ID')}, PPh dipotong Rp ${s.taxWithheld.toLocaleString('id-ID')}`).join('\n')}

## 3. Rekomendasi Tindakan

- [ ] Verifikasi seluruh bukti potong 1721-A1
- [ ] Pastikan status PTKP (${input.ptkpStatus}) sesuai kondisi terkini
- [ ] ${calc.difference > 0 ? 'Bayar kekurangan PPh sebelum batas waktu' : calc.difference < 0 ? 'Ajukan restitusi/lebih bayar melalui SPT' : 'Laporkan SPT tepat waktu'}
- [ ] Simpan semua bukti potong dan dokumen pendukung

*Laporan ini dibuat secara otomatis. Silakan konsultasikan dengan konsultan pajak untuk keputusan final.*`;
}

function calculateTax(pkp: number): number {
  if (pkp <= 0) return 0;
  const brackets = [
    { limit: 60_000_000, rate: 0.05 },
    { limit: 250_000_000, rate: 0.15 },
    { limit: 500_000_000, rate: 0.25 },
    { limit: 5_000_000_000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];
  let tax = 0, remaining = pkp, prev = 0;
  for (const b of brackets) {
    const t = Math.min(remaining, b.limit - prev);
    if (t <= 0) break;
    tax += t * b.rate;
    remaining -= t;
    prev = b.limit;
  }
  return Math.round(tax);
}
