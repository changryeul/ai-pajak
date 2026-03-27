/**
 * AI Tax Savings Advisor
 *
 * Analyzes taxpayer data and provides personalized tax-saving recommendations
 * based on Indonesian tax regulations (UU HPP, PMK, PP).
 */

import Anthropic from '@anthropic-ai/sdk';
import { PTKP_RATES, TAX_BRACKETS, POSITION_COST, PENSION_CONTRIBUTION } from '@/lib/tax/shared/constants';
import type { PTKPStatus, IncomeSource1721A1 } from '@/lib/tax/shared/types';

export interface TaxSavingsInput {
  // Taxpayer profile
  ptkpStatus: PTKPStatus;
  taxYear: number;
  isMarried: boolean;
  dependents: number;
  spouseHasIncome: boolean;

  // Income data
  incomeSources: IncomeSource1721A1[];
  otherIncome?: {
    interest?: number;
    dividends?: number;
    rental?: number;
    capitalGains?: number;
    freelance?: number;
  };

  // Existing deductions
  deductions?: {
    positionCosts: number;
    pensionContribution: number;
    zakat?: number;
    donations?: number;
    bpjsKetenagakerjaan?: number;
    bpjsKesehatan?: number;
  };

  // Additional context
  hasBusinessIncome?: boolean;
  businessRevenue?: number;
}

export interface TaxSavingsRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  potentialSavings: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  legalBasis: string;
  actionItems: string[];
}

export type RecommendationCategory =
  | 'PTKP_OPTIMIZATION'
  | 'DEDUCTION_OPTIMIZATION'
  | 'INCOME_SPLITTING'
  | 'TAX_CREDIT'
  | 'INVESTMENT'
  | 'BUSINESS_STRUCTURE'
  | 'COMPLIANCE';

export interface TaxSavingsResult {
  currentTax: number;
  optimizedTax: number;
  totalPotentialSavings: number;
  effectiveRate: {
    current: number;
    optimized: number;
  };
  recommendations: TaxSavingsRecommendation[];
  summary: string;
  disclaimer: string;
}

/**
 * Calculate progressive tax
 */
function calculateTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const bracket of TAX_BRACKETS) {
    const taxable = Math.min(remaining, bracket.limit - prevLimit);
    if (taxable <= 0) break;
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }
  return Math.round(tax);
}

/**
 * Generate rule-based tax savings recommendations
 */
export function analyzeRuleBased(input: TaxSavingsInput): TaxSavingsRecommendation[] {
  const recommendations: TaxSavingsRecommendation[] = [];
  const totalGross = input.incomeSources.reduce((s, i) => s + i.grossIncome, 0);
  const totalNet = input.incomeSources.reduce((s, i) => s + i.netIncome, 0);
  const ptkp = PTKP_RATES[input.ptkpStatus];
  const pkp = Math.max(0, totalNet - ptkp);
  const currentTax = calculateTax(pkp);

  // 1. PTKP Optimization - Marriage status
  if (!input.isMarried && input.ptkpStatus.startsWith('TK')) {
    const marriedPtkp = PTKP_RATES['K/0'];
    const savings = calculateTax(Math.max(0, totalNet - ptkp)) -
      calculateTax(Math.max(0, totalNet - marriedPtkp));
    if (savings > 0) {
      recommendations.push({
        id: 'ptkp-marriage',
        category: 'PTKP_OPTIMIZATION',
        title: 'Status Pernikahan - PTKP K/0',
        description: `Jika Anda menikah, PTKP meningkat dari Rp ${formatM(ptkp)} menjadi Rp ${formatM(marriedPtkp)}, mengurangi PKP sebesar Rp ${formatM(marriedPtkp - ptkp)}.`,
        potentialSavings: savings,
        difficulty: 'HARD',
        legalBasis: 'Pasal 7 UU PPh, PMK 101/PMK.010/2016',
        actionItems: [
          'Pastikan status pernikahan terdaftar di KTP',
          'Laporkan perubahan status ke kantor pajak',
          'Update PTKP di bukti potong 1721-A1',
        ],
      });
    }
  }

  // 2. PTKP Optimization - Dependents
  const currentDependents = parseInt(input.ptkpStatus.split('/').pop() || '0');
  if (currentDependents < 3 && input.dependents > currentDependents) {
    const newDependents = Math.min(input.dependents, 3);
    const prefix = input.ptkpStatus.split('/')[0];
    const newStatus = `${prefix}/${newDependents}` as PTKPStatus;
    if (PTKP_RATES[newStatus]) {
      const newPtkp = PTKP_RATES[newStatus];
      const savings = calculateTax(pkp) - calculateTax(Math.max(0, totalNet - newPtkp));
      if (savings > 0) {
        recommendations.push({
          id: 'ptkp-dependents',
          category: 'PTKP_OPTIMIZATION',
          title: `Tambah Tanggungan (${currentDependents} → ${newDependents})`,
          description: `Anda memiliki ${input.dependents} tanggungan tetapi PTKP tercatat ${currentDependents}. Menambah tanggungan di PTKP meningkatkan pengurangan sebesar Rp ${formatM((newDependents - currentDependents) * 4_500_000)}/tanggungan.`,
          potentialSavings: savings,
          difficulty: 'EASY',
          legalBasis: 'Pasal 7 ayat (1) UU PPh',
          actionItems: [
            'Kumpulkan KTP/akta kelahiran tanggungan',
            'Ajukan perubahan data PTKP ke pemberi kerja',
            'Tanggungan: anak, orang tua, mertua yang tidak berpenghasilan',
          ],
        });
      }
    }
  }

  // 3. PTKP Optimization - Spouse income combination (K/I)
  if (input.isMarried && input.spouseHasIncome && !input.ptkpStatus.startsWith('K/I')) {
    const currentDeps = parseInt(input.ptkpStatus.split('/').pop() || '0');
    const kiStatus = `K/I/${currentDeps}` as PTKPStatus;
    if (PTKP_RATES[kiStatus]) {
      const kiPtkp = PTKP_RATES[kiStatus];
      const additionalPtkp = kiPtkp - ptkp;
      recommendations.push({
        id: 'ptkp-spouse-combine',
        category: 'INCOME_SPLITTING',
        title: 'Gabungkan Penghasilan Istri (K/I)',
        description: `Jika penghasilan istri digabung, PTKP meningkat Rp ${formatM(additionalPtkp)} menjadi Rp ${formatM(kiPtkp)}. Bermanfaat jika total penghasilan gabungan masih di bracket pajak rendah.`,
        potentialSavings: Math.round(additionalPtkp * 0.05),
        difficulty: 'MEDIUM',
        legalBasis: 'Pasal 8 ayat (1) UU PPh',
        actionItems: [
          'Hitung apakah penggabungan menguntungkan',
          'Bandingkan pajak terpisah vs gabungan',
          'Ajukan permohonan penggabungan NPWP ke KPP',
        ],
      });
    }
  }

  // 4. Position Costs Optimization
  const totalPositionCosts = input.deductions?.positionCosts || 0;
  const maxPositionCosts = Math.min(totalGross * POSITION_COST.MAX_PERCENTAGE, POSITION_COST.MAX_ANNUAL);
  if (totalPositionCosts < maxPositionCosts * 0.9) {
    const additionalDeduction = maxPositionCosts - totalPositionCosts;
    const savings = Math.round(additionalDeduction * getMarginRate(pkp));
    if (savings > 100_000) {
      recommendations.push({
        id: 'position-costs',
        category: 'DEDUCTION_OPTIMIZATION',
        title: 'Biaya Jabatan Belum Maksimal',
        description: `Biaya jabatan Anda Rp ${formatM(totalPositionCosts)} dari maksimal Rp ${formatM(maxPositionCosts)} (5% dari bruto, maks Rp 6 juta/tahun). Pastikan pemberi kerja menghitung biaya jabatan dengan benar.`,
        potentialSavings: savings,
        difficulty: 'EASY',
        legalBasis: 'Pasal 21 ayat (3) UU PPh, PMK 250/2008',
        actionItems: [
          'Periksa bukti potong 1721-A1 apakah biaya jabatan sudah benar',
          'Konfirmasi dengan HRD/pemberi kerja',
        ],
      });
    }
  }

  // 5. Pension Contribution
  const totalPension = input.deductions?.pensionContribution || 0;
  if (totalPension < PENSION_CONTRIBUTION.MAX_ANNUAL * 0.9) {
    recommendations.push({
      id: 'pension',
      category: 'DEDUCTION_OPTIMIZATION',
      title: 'Iuran Pensiun / BPJS Ketenagakerjaan',
      description: `Iuran pensiun yang dibayar karyawan dapat mengurangi penghasilan bruto, maksimal Rp ${formatM(PENSION_CONTRIBUTION.MAX_ANNUAL)}/tahun. Pastikan kontribusi BPJS Ketenagakerjaan (JHT) dan dana pensiun sudah diperhitungkan.`,
      potentialSavings: Math.round((PENSION_CONTRIBUTION.MAX_ANNUAL - totalPension) * getMarginRate(pkp)),
      difficulty: 'EASY',
      legalBasis: 'Pasal 21 ayat (3) UU PPh',
      actionItems: [
        'Cek potongan BPJS Ketenagakerjaan di slip gaji',
        'Pertimbangkan ikut program Dana Pensiun Lembaga Keuangan (DPLK)',
        'Iuran DPLK yang dibayar sendiri bisa jadi pengurang',
      ],
    });
  }

  // 6. Zakat Deduction
  if (!input.deductions?.zakat && totalGross > 60_000_000) {
    const estimatedZakat = Math.round(totalNet * 0.025);
    const savings = Math.round(estimatedZakat * getMarginRate(pkp));
    recommendations.push({
      id: 'zakat',
      category: 'DEDUCTION_OPTIMIZATION',
      title: 'Zakat sebagai Pengurang Penghasilan',
      description: `Zakat yang dibayar ke badan amil zakat yang disahkan pemerintah dapat mengurangi penghasilan kena pajak. Estimasi zakat 2.5% dari penghasilan neto: Rp ${formatM(estimatedZakat)}.`,
      potentialSavings: savings,
      difficulty: 'EASY',
      legalBasis: 'Pasal 9 ayat (1) huruf g UU PPh, PP 60/2010',
      actionItems: [
        'Bayar zakat melalui BAZNAS atau LAZ yang terdaftar',
        'Simpan bukti pembayaran zakat',
        'Laporkan di SPT Tahunan sebagai pengurang',
      ],
    });
  }

  // 7. UMKM Final Tax (PP 55/2022)
  if (input.hasBusinessIncome && input.businessRevenue && input.businessRevenue <= 4_800_000_000) {
    const umkmTax = Math.round(Math.max(0, input.businessRevenue - 500_000_000) * 0.005);
    if (currentTax > umkmTax) {
      recommendations.push({
        id: 'umkm-final',
        category: 'BUSINESS_STRUCTURE',
        title: 'Manfaatkan PPh Final UMKM 0.5%',
        description: `Omzet usaha Rp ${formatM(input.businessRevenue)} di bawah Rp 4.8 miliar. Anda bisa menggunakan tarif PPh Final 0.5% dengan pembebasan Rp 500 juta pertama. Pajak: Rp ${formatM(umkmTax)} vs tarif progresif Rp ${formatM(currentTax)}.`,
        potentialSavings: currentTax - umkmTax,
        difficulty: 'MEDIUM',
        legalBasis: 'PP 55 Tahun 2022',
        actionItems: [
          'Daftar sebagai WP UMKM di KPP',
          'Bayar PPh Final 0.5% setiap bulan',
          'Berlaku maks 7 tahun untuk WP Orang Pribadi',
        ],
      });
    }
  }

  // 8. Tax Credit Review
  const totalWithheld = input.incomeSources.reduce((s, i) => s + i.taxWithheld, 0);
  if (totalWithheld > currentTax * 1.1) {
    recommendations.push({
      id: 'overpaid-tax',
      category: 'TAX_CREDIT',
      title: 'Kelebihan Bayar Pajak - Ajukan Restitusi',
      description: `PPh yang dipotong (Rp ${formatM(totalWithheld)}) melebihi PPh terutang (Rp ${formatM(currentTax)}). Anda berhak atas restitusi/pengembalian sebesar Rp ${formatM(totalWithheld - currentTax)}.`,
      potentialSavings: totalWithheld - currentTax,
      difficulty: 'MEDIUM',
      legalBasis: 'Pasal 28 UU KUP',
      actionItems: [
        'Ajukan restitusi melalui SPT Tahunan',
        'Siapkan bukti potong lengkap',
        'Proses restitusi memakan waktu 3-12 bulan',
      ],
    });
  }

  // 9. BPJS Kesehatan
  if (!input.deductions?.bpjsKesehatan) {
    recommendations.push({
      id: 'bpjs-kesehatan',
      category: 'DEDUCTION_OPTIMIZATION',
      title: 'Premi BPJS Kesehatan',
      description: 'Premi BPJS Kesehatan yang dibayar karyawan merupakan pengurang penghasilan bruto dalam perhitungan PPh 21. Pastikan ini sudah diperhitungkan oleh pemberi kerja.',
      potentialSavings: Math.round(totalGross * 0.01 * getMarginRate(pkp)),
      difficulty: 'EASY',
      legalBasis: 'PMK 250/PMK.03/2008, SE-16/PJ/2016',
      actionItems: [
        'Cek apakah potongan BPJS sudah masuk perhitungan PPh',
        'Koordinasi dengan HRD',
      ],
    });
  }

  return recommendations.filter(r => r.potentialSavings > 0)
    .sort((a, b) => b.potentialSavings - a.potentialSavings);
}

/**
 * Get AI-enhanced analysis using Claude
 */
export async function analyzeWithAI(
  input: TaxSavingsInput,
  ruleBasedRecommendations: TaxSavingsRecommendation[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return 'Analisis AI tidak tersedia. Silakan lihat rekomendasi di atas.';
  }

  const anthropic = new Anthropic({ apiKey });
  const totalGross = input.incomeSources.reduce((s, i) => s + i.grossIncome, 0);
  const totalNet = input.incomeSources.reduce((s, i) => s + i.netIncome, 0);
  const ptkp = PTKP_RATES[input.ptkpStatus];
  const pkp = Math.max(0, totalNet - ptkp);
  const currentTax = calculateTax(pkp);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Anda adalah konsultan pajak Indonesia berpengalaman. Berikan ringkasan analisis pajak dalam bahasa Indonesia.

Data Wajib Pajak:
- Status PTKP: ${input.ptkpStatus}
- Penghasilan Bruto: Rp ${totalGross.toLocaleString('id-ID')}
- Penghasilan Neto: Rp ${totalNet.toLocaleString('id-ID')}
- PTKP: Rp ${ptkp.toLocaleString('id-ID')}
- PKP: Rp ${pkp.toLocaleString('id-ID')}
- PPh Terutang: Rp ${currentTax.toLocaleString('id-ID')}
- Jumlah Pemberi Kerja: ${input.incomeSources.length}
- Menikah: ${input.isMarried ? 'Ya' : 'Tidak'}
- Tanggungan: ${input.dependents}
- Usaha: ${input.hasBusinessIncome ? 'Ya' : 'Tidak'}

Rekomendasi yang sudah ditemukan:
${ruleBasedRecommendations.map(r => `- ${r.title}: potensi hemat Rp ${r.potentialSavings.toLocaleString('id-ID')}`).join('\n')}

Berikan ringkasan 2-3 paragraf tentang:
1. Kondisi perpajakan saat ini
2. Prioritas tindakan yang harus dilakukan
3. Tips tambahan yang belum tercakup di rekomendasi

Gunakan bahasa yang mudah dipahami. Jangan ulangi detail rekomendasi yang sudah ada.`,
    }],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
}

/**
 * Full tax savings analysis
 */
export async function analyzeTaxSavings(input: TaxSavingsInput): Promise<TaxSavingsResult> {
  const totalGross = input.incomeSources.reduce((s, i) => s + i.grossIncome, 0);
  const totalNet = input.incomeSources.reduce((s, i) => s + i.netIncome, 0);
  const ptkp = PTKP_RATES[input.ptkpStatus];
  const pkp = Math.max(0, totalNet - ptkp);
  const currentTax = calculateTax(pkp);

  // Rule-based recommendations
  const recommendations = analyzeRuleBased(input);
  const totalPotentialSavings = recommendations.reduce((s, r) => s + r.potentialSavings, 0);
  const optimizedTax = Math.max(0, currentTax - totalPotentialSavings);

  // AI-enhanced summary
  let summary: string;
  try {
    summary = await analyzeWithAI(input, recommendations);
  } catch {
    summary = `Berdasarkan analisis data perpajakan Anda, ditemukan ${recommendations.length} peluang penghematan pajak dengan total potensi penghematan Rp ${totalPotentialSavings.toLocaleString('id-ID')}. Silakan tinjau setiap rekomendasi dan konsultasikan dengan konsultan pajak untuk implementasi.`;
  }

  return {
    currentTax,
    optimizedTax,
    totalPotentialSavings,
    effectiveRate: {
      current: totalGross > 0 ? currentTax / totalGross : 0,
      optimized: totalGross > 0 ? optimizedTax / totalGross : 0,
    },
    recommendations,
    summary,
    disclaimer: 'Rekomendasi ini bersifat informatif dan tidak menggantikan konsultasi dengan konsultan pajak profesional. Implementasi strategi pajak harus sesuai dengan peraturan yang berlaku.',
  };
}

// Helpers
function formatM(amount: number): string {
  return amount.toLocaleString('id-ID');
}

function getMarginRate(pkp: number): number {
  if (pkp <= 0) return 0;
  if (pkp <= 60_000_000) return 0.05;
  if (pkp <= 250_000_000) return 0.15;
  if (pkp <= 500_000_000) return 0.25;
  if (pkp <= 5_000_000_000) return 0.30;
  return 0.35;
}
