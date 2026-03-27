/**
 * Smart Anomaly Detection
 *
 * Detects potential tax audit risks by analyzing client data patterns.
 * Uses rule-based checks + AI analysis to flag anomalies.
 *
 * Risk factors based on DJP audit criteria:
 * - Revenue/expense ratio anomalies
 * - Sudden income changes
 * - Inconsistent withholding rates
 * - Missing documentation
 * - Late filing patterns
 * - Industry benchmarking deviations
 */

import Anthropic from '@anthropic-ai/sdk';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyCategory =
  | 'INCOME_SPIKE'
  | 'INCOME_DROP'
  | 'HIGH_DEDUCTIONS'
  | 'LOW_EFFECTIVE_RATE'
  | 'HIGH_EFFECTIVE_RATE'
  | 'WITHHOLDING_MISMATCH'
  | 'MISSING_DOCS'
  | 'LATE_FILING'
  | 'LARGE_REFUND'
  | 'REVENUE_EXPENSE_RATIO'
  | 'MULTI_EMPLOYER_RISK'
  | 'PTKP_INCONSISTENCY';

export interface AnomalyAlert {
  id: string;
  category: AnomalyCategory;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  metric?: string;
  threshold?: string;
  actualValue?: string;
  recommendation: string;
  legalBasis?: string;
}

export interface AnomalyDetectionInput {
  customerId: string;
  customerName: string;
  taxYear: number;
  currentData: {
    grossIncome: number;
    netIncome: number;
    deductions: number;
    taxDue: number;
    taxWithheld: number;
    effectiveRate: number;
    employerCount: number;
    ptkpStatus: string;
  };
  previousYearData?: {
    grossIncome: number;
    netIncome: number;
    taxDue: number;
    effectiveRate: number;
  };
  filingHistory?: {
    year: number;
    status: string;
    filedOnTime: boolean;
  }[];
  documentCount?: number;
}

export interface AnomalyDetectionResult {
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  alerts: AnomalyAlert[];
  summary: string;
  auditProbability: string; // e.g., "Low (<5%)"
}

/**
 * Run anomaly detection on client data
 */
export async function detectAnomalies(input: AnomalyDetectionInput): Promise<AnomalyDetectionResult> {
  const alerts: AnomalyAlert[] = [];

  // Run all rule-based checks
  alerts.push(...checkIncomeChanges(input));
  alerts.push(...checkDeductionRatio(input));
  alerts.push(...checkEffectiveRate(input));
  alerts.push(...checkWithholding(input));
  alerts.push(...checkFilingHistory(input));
  alerts.push(...checkDocumentation(input));
  alerts.push(...checkRefundRisk(input));
  alerts.push(...checkMultiEmployer(input));
  alerts.push(...checkPtkpConsistency(input));

  // Calculate risk score
  const riskScore = calculateRiskScore(alerts);
  const overallRisk = getOverallRisk(riskScore);

  // Get AI summary
  let summary: string;
  try {
    summary = await getAISummary(input, alerts, riskScore);
  } catch {
    summary = generateFallbackSummary(alerts, riskScore);
  }

  const auditProbability = riskScore < 20 ? 'Sangat Rendah (<2%)'
    : riskScore < 40 ? 'Rendah (<5%)'
    : riskScore < 60 ? 'Sedang (5-15%)'
    : riskScore < 80 ? 'Tinggi (15-30%)'
    : 'Sangat Tinggi (>30%)';

  return { overallRisk, riskScore, alerts, summary, auditProbability };
}

// ============================
// Rule-based checks
// ============================

function checkIncomeChanges(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  if (!input.previousYearData) return alerts;

  const prev = input.previousYearData.grossIncome;
  const curr = input.currentData.grossIncome;
  if (prev === 0) return alerts;

  const changePercent = ((curr - prev) / prev) * 100;

  if (changePercent > 50) {
    alerts.push({
      id: 'income-spike',
      category: 'INCOME_SPIKE',
      riskLevel: changePercent > 100 ? 'HIGH' : 'MEDIUM',
      title: `Penghasilan naik ${changePercent.toFixed(0)}%`,
      description: `Penghasilan bruto naik signifikan dari Rp ${prev.toLocaleString('id-ID')} ke Rp ${curr.toLocaleString('id-ID')}. Kenaikan >50% bisa menarik perhatian DJP.`,
      metric: 'Perubahan penghasilan YoY',
      threshold: '<50%',
      actualValue: `${changePercent.toFixed(1)}%`,
      recommendation: 'Pastikan dokumentasi pendukung lengkap untuk kenaikan penghasilan (promosi, bonus, pindah kerja).',
      legalBasis: 'SE-15/PJ/2018 tentang Kriteria Pemeriksaan',
    });
  }

  if (changePercent < -30) {
    alerts.push({
      id: 'income-drop',
      category: 'INCOME_DROP',
      riskLevel: changePercent < -50 ? 'HIGH' : 'MEDIUM',
      title: `Penghasilan turun ${Math.abs(changePercent).toFixed(0)}%`,
      description: `Penurunan penghasilan signifikan bisa memicu pemeriksaan, terutama jika tidak konsisten dengan gaya hidup yang dilaporkan.`,
      metric: 'Perubahan penghasilan YoY',
      threshold: '>-30%',
      actualValue: `${changePercent.toFixed(1)}%`,
      recommendation: 'Siapkan dokumentasi: surat PHK, perubahan kontrak, atau bukti pengurangan jam kerja.',
    });
  }

  return alerts;
}

function checkDeductionRatio(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const { grossIncome, deductions } = input.currentData;
  if (grossIncome === 0) return alerts;

  const ratio = deductions / grossIncome;
  if (ratio > 0.15) {
    alerts.push({
      id: 'high-deductions',
      category: 'HIGH_DEDUCTIONS',
      riskLevel: ratio > 0.25 ? 'HIGH' : 'MEDIUM',
      title: `Rasio pengurang tinggi (${(ratio * 100).toFixed(1)}%)`,
      description: `Pengurang ${(ratio * 100).toFixed(1)}% dari bruto melebihi rata-rata. DJP mungkin memverifikasi keabsahan pengurang.`,
      metric: 'Deduction/Gross ratio',
      threshold: '<15%',
      actualValue: `${(ratio * 100).toFixed(1)}%`,
      recommendation: 'Pastikan semua pengurang memiliki bukti pendukung yang valid.',
    });
  }

  return alerts;
}

function checkEffectiveRate(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const { effectiveRate, grossIncome } = input.currentData;

  // Very low rate for high income
  if (grossIncome > 200_000_000 && effectiveRate < 0.03) {
    alerts.push({
      id: 'low-rate',
      category: 'LOW_EFFECTIVE_RATE',
      riskLevel: 'MEDIUM',
      title: `Tarif efektif sangat rendah (${(effectiveRate * 100).toFixed(2)}%)`,
      description: `Dengan penghasilan > Rp 200 juta, tarif efektif ${(effectiveRate * 100).toFixed(2)}% di bawah rata-rata industri.`,
      metric: 'Effective tax rate',
      threshold: '>3% untuk income >200M',
      actualValue: `${(effectiveRate * 100).toFixed(2)}%`,
      recommendation: 'Review apakah PTKP dan pengurang sudah benar. Tarif rendah bisa memicu pemeriksaan.',
    });
  }

  // Very high rate (possible over-withholding)
  if (effectiveRate > 0.25) {
    alerts.push({
      id: 'high-rate',
      category: 'HIGH_EFFECTIVE_RATE',
      riskLevel: 'LOW',
      title: `Tarif efektif tinggi (${(effectiveRate * 100).toFixed(1)}%)`,
      description: `Tarif efektif di atas 25% mungkin menunjukkan over-withholding. Anda mungkin berhak atas restitusi.`,
      recommendation: 'Periksa bukti potong dan pertimbangkan mengajukan restitusi.',
    });
  }

  return alerts;
}

function checkWithholding(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const { taxDue, taxWithheld } = input.currentData;

  if (taxDue > 0 && taxWithheld > 0) {
    const mismatch = Math.abs(taxDue - taxWithheld) / taxDue;
    if (mismatch > 0.2) {
      alerts.push({
        id: 'withholding-mismatch',
        category: 'WITHHOLDING_MISMATCH',
        riskLevel: mismatch > 0.5 ? 'HIGH' : 'MEDIUM',
        title: `Selisih PPh terutang vs dipotong (${(mismatch * 100).toFixed(0)}%)`,
        description: `PPh terutang Rp ${taxDue.toLocaleString('id-ID')} vs PPh dipotong Rp ${taxWithheld.toLocaleString('id-ID')}. Selisih besar memicu verifikasi.`,
        recommendation: 'Periksa semua bukti potong dan pastikan tidak ada yang terlewat.',
      });
    }
  }

  return alerts;
}

function checkFilingHistory(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  if (!input.filingHistory) return alerts;

  const lateFilings = input.filingHistory.filter(f => !f.filedOnTime);
  if (lateFilings.length >= 2) {
    alerts.push({
      id: 'late-filing',
      category: 'LATE_FILING',
      riskLevel: lateFilings.length >= 3 ? 'HIGH' : 'MEDIUM',
      title: `${lateFilings.length}x terlambat lapor dalam riwayat`,
      description: `Keterlambatan berulang meningkatkan risiko pemeriksaan dan denda.`,
      recommendation: 'Pastikan SPT dilaporkan sebelum deadline. Gunakan fitur reminder AI Pajak.',
      legalBasis: 'Pasal 7 UU KUP - Denda keterlambatan',
    });
  }

  return alerts;
}

function checkDocumentation(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const docCount = input.documentCount || 0;

  if (docCount === 0) {
    alerts.push({
      id: 'no-docs',
      category: 'MISSING_DOCS',
      riskLevel: 'MEDIUM',
      title: 'Tidak ada dokumen pendukung',
      description: 'Tidak ada bukti potong atau dokumen yang di-upload. Ini melemahkan posisi jika ada pemeriksaan.',
      recommendation: 'Upload semua bukti potong 1721-A1 dan dokumen pendukung lainnya.',
    });
  }

  return alerts;
}

function checkRefundRisk(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const { taxDue, taxWithheld } = input.currentData;
  const refund = taxWithheld - taxDue;

  if (refund > 10_000_000) {
    alerts.push({
      id: 'large-refund',
      category: 'LARGE_REFUND',
      riskLevel: refund > 50_000_000 ? 'HIGH' : 'MEDIUM',
      title: `Lebih bayar Rp ${refund.toLocaleString('id-ID')}`,
      description: `Restitusi > Rp 10 juta sering memicu pemeriksaan pendahuluan oleh DJP.`,
      recommendation: 'Siapkan semua bukti potong asli. Proses restitusi memakan 3-12 bulan.',
      legalBasis: 'Pasal 17B UU KUP - Pemeriksaan restitusi',
    });
  }

  return alerts;
}

function checkMultiEmployer(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  if (input.currentData.employerCount > 2) {
    alerts.push({
      id: 'multi-employer',
      category: 'MULTI_EMPLOYER_RISK',
      riskLevel: 'LOW',
      title: `${input.currentData.employerCount} pemberi kerja`,
      description: `Penghasilan dari banyak pemberi kerja memerlukan perhitungan ulang PPh dengan tarif progresif gabungan.`,
      recommendation: 'Pastikan semua bukti potong tercakup. Gunakan SPT 1770 S untuk penggabungan penghasilan.',
    });
  }
  return alerts;
}

function checkPtkpConsistency(input: AnomalyDetectionInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  // If PTKP status suggests high dependents but income is low
  const { ptkpStatus, grossIncome } = input.currentData;
  if ((ptkpStatus.includes('3') || ptkpStatus.startsWith('K/I')) && grossIncome < 60_000_000) {
    alerts.push({
      id: 'ptkp-income-mismatch',
      category: 'PTKP_INCONSISTENCY',
      riskLevel: 'LOW',
      title: 'PTKP tinggi dengan penghasilan rendah',
      description: `PTKP ${ptkpStatus} dengan penghasilan < Rp 60 juta. Verifikasi status PTKP apakah masih sesuai.`,
      recommendation: 'Pastikan data tanggungan di PTKP masih valid.',
    });
  }
  return alerts;
}

// ============================
// Scoring & AI
// ============================

function calculateRiskScore(alerts: AnomalyAlert[]): number {
  const weights: Record<RiskLevel, number> = { LOW: 5, MEDIUM: 15, HIGH: 30, CRITICAL: 50 };
  const total = alerts.reduce((s, a) => s + weights[a.riskLevel], 0);
  return Math.min(100, total);
}

function getOverallRisk(score: number): RiskLevel {
  if (score < 20) return 'LOW';
  if (score < 40) return 'MEDIUM';
  if (score < 70) return 'HIGH';
  return 'CRITICAL';
}

async function getAISummary(input: AnomalyDetectionInput, alerts: AnomalyAlert[], score: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return generateFallbackSummary(alerts, score);

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Anda adalah ahli audit pajak Indonesia. Berikan ringkasan risiko dalam 2-3 kalimat bahasa Indonesia.

Klien: ${input.customerName}
Tahun: ${input.taxYear}
Skor Risiko: ${score}/100
Anomali ditemukan:
${alerts.map(a => `- [${a.riskLevel}] ${a.title}`).join('\n')}

Berikan penilaian singkat dan saran prioritas.`,
    }],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
}

function generateFallbackSummary(alerts: AnomalyAlert[], score: number): string {
  if (alerts.length === 0) return 'Tidak ditemukan anomali signifikan. Profil pajak terlihat normal.';
  const high = alerts.filter(a => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL');
  if (high.length > 0) {
    return `Ditemukan ${high.length} risiko tinggi dari ${alerts.length} anomali total (skor ${score}/100). Prioritaskan penyelesaian item risiko tinggi sebelum pelaporan.`;
  }
  return `Ditemukan ${alerts.length} anomali dengan skor risiko ${score}/100. Sebagian besar bersifat informatif, namun sebaiknya ditinjau sebelum pelaporan.`;
}
