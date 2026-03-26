/**
 * AI Filing Validator
 *
 * Validates SPT data before submission by detecting anomalies,
 * missing data, calculation errors, and compliance risks.
 */

import Anthropic from '@anthropic-ai/sdk';
import { PTKP_RATES, TAX_BRACKETS, POSITION_COST, PENSION_CONTRIBUTION } from '@/lib/tax/shared/constants';
import type { PTKPStatus, IncomeSource1721A1 } from '@/lib/tax/shared/types';

export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type CheckCategory =
  | 'IDENTITY'
  | 'CALCULATION'
  | 'COMPLETENESS'
  | 'ANOMALY'
  | 'COMPLIANCE'
  | 'DEADLINE';

export interface ValidationIssue {
  id: string;
  severity: Severity;
  category: CheckCategory;
  title: string;
  description: string;
  field?: string;
  expectedValue?: string;
  actualValue?: string;
  suggestion?: string;
}

export interface FilingValidationInput {
  sptType: '1770SS' | '1770S' | '1770' | '1771';
  taxYear: number;
  ptkpStatus: PTKPStatus;
  taxpayer: {
    npwp?: string;
    nik?: string;
    name?: string;
    address?: string;
  };
  incomeSources: IncomeSource1721A1[];
  summary: {
    totalGrossIncome: number;
    totalDeductions: number;
    totalNetIncome: number;
    ptkpAmount: number;
    taxableIncome: number;
    taxDue: number;
    totalTaxWithheld: number;
    taxPayable: number;
    taxRefund: number;
    status: string;
  };
}

export interface FilingValidationResult {
  isValid: boolean;
  score: number; // 0-100, overall filing quality
  issues: ValidationIssue[];
  counts: { errors: number; warnings: number; infos: number };
  aiSummary?: string;
}

/**
 * Run all validation checks
 */
export async function validateFiling(input: FilingValidationInput): Promise<FilingValidationResult> {
  const issues: ValidationIssue[] = [];

  // Run rule-based checks
  issues.push(...checkIdentity(input));
  issues.push(...checkCompleteness(input));
  issues.push(...checkCalculations(input));
  issues.push(...checkAnomalies(input));
  issues.push(...checkCompliance(input));
  issues.push(...checkDeadline(input));

  const counts = {
    errors: issues.filter(i => i.severity === 'ERROR').length,
    warnings: issues.filter(i => i.severity === 'WARNING').length,
    infos: issues.filter(i => i.severity === 'INFO').length,
  };

  // Calculate score
  const score = Math.max(0, 100 - (counts.errors * 20) - (counts.warnings * 5) - (counts.infos * 1));
  const isValid = counts.errors === 0;

  // Get AI summary
  let aiSummary: string | undefined;
  try {
    aiSummary = await getAISummary(input, issues);
  } catch {
    // AI summary is optional
  }

  return { isValid, score, issues, counts, aiSummary };
}

// ========================================
// Rule-based validation checks
// ========================================

function checkIdentity(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { taxpayer } = input;

  if (!taxpayer.npwp) {
    issues.push({
      id: 'id-npwp-missing',
      severity: 'ERROR',
      category: 'IDENTITY',
      title: 'NPWP tidak diisi',
      description: 'NPWP wajib pajak harus diisi untuk pelaporan SPT.',
      field: 'taxpayer.npwp',
      suggestion: 'Lengkapi NPWP di profil wajib pajak.',
    });
  } else if (!/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/.test(taxpayer.npwp)) {
    issues.push({
      id: 'id-npwp-format',
      severity: 'ERROR',
      category: 'IDENTITY',
      title: 'Format NPWP tidak valid',
      description: `NPWP "${taxpayer.npwp}" tidak sesuai format XX.XXX.XXX.X-XXX.XXX.`,
      field: 'taxpayer.npwp',
      actualValue: taxpayer.npwp,
      suggestion: 'Periksa kembali 15 digit NPWP.',
    });
  }

  if (!taxpayer.nik) {
    issues.push({
      id: 'id-nik-missing',
      severity: 'WARNING',
      category: 'IDENTITY',
      title: 'NIK tidak diisi',
      description: 'NIK (16 digit) disarankan untuk diisi agar data lebih lengkap.',
      field: 'taxpayer.nik',
    });
  } else if (!/^\d{16}$/.test(taxpayer.nik)) {
    issues.push({
      id: 'id-nik-format',
      severity: 'WARNING',
      category: 'IDENTITY',
      title: 'Format NIK tidak valid',
      description: 'NIK harus 16 digit angka.',
      field: 'taxpayer.nik',
      actualValue: taxpayer.nik,
    });
  }

  if (!taxpayer.name) {
    issues.push({
      id: 'id-name-missing',
      severity: 'ERROR',
      category: 'IDENTITY',
      title: 'Nama wajib pajak kosong',
      description: 'Nama wajib pajak harus diisi.',
      field: 'taxpayer.name',
    });
  }

  return issues;
}

function checkCompleteness(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.incomeSources.length === 0) {
    issues.push({
      id: 'comp-no-income',
      severity: 'ERROR',
      category: 'COMPLETENESS',
      title: 'Tidak ada sumber penghasilan',
      description: 'SPT harus memiliki minimal satu sumber penghasilan.',
      suggestion: 'Upload bukti potong 1721-A1 atau tambahkan data penghasilan.',
    });
    return issues;
  }

  for (let i = 0; i < input.incomeSources.length; i++) {
    const src = input.incomeSources[i];
    const label = src.employerName || `Sumber #${i + 1}`;

    if (!src.employerNpwp) {
      issues.push({
        id: `comp-employer-npwp-${i}`,
        severity: 'WARNING',
        category: 'COMPLETENESS',
        title: `NPWP pemberi kerja kosong - ${label}`,
        description: 'NPWP pemberi kerja sebaiknya diisi untuk kelengkapan bukti potong.',
        field: `incomeSources[${i}].employerNpwp`,
      });
    }

    if (!src.buktiPotongNumber) {
      issues.push({
        id: `comp-bp-number-${i}`,
        severity: 'WARNING',
        category: 'COMPLETENESS',
        title: `Nomor bukti potong kosong - ${label}`,
        description: 'Nomor bukti potong diperlukan sebagai referensi pelaporan.',
        field: `incomeSources[${i}].buktiPotongNumber`,
      });
    }

    if (src.grossIncome <= 0) {
      issues.push({
        id: `comp-gross-zero-${i}`,
        severity: 'ERROR',
        category: 'COMPLETENESS',
        title: `Penghasilan bruto nol atau negatif - ${label}`,
        description: `Penghasilan bruto: Rp ${src.grossIncome.toLocaleString('id-ID')}. Nilai ini tidak valid.`,
        field: `incomeSources[${i}].grossIncome`,
        actualValue: src.grossIncome.toString(),
      });
    }

    // Check period completeness
    const startMonth = parseInt(src.periodStart);
    const endMonth = parseInt(src.periodEnd);
    if (startMonth > 1 || endMonth < 12) {
      issues.push({
        id: `comp-partial-period-${i}`,
        severity: 'INFO',
        category: 'COMPLETENESS',
        title: `Masa kerja tidak penuh - ${label}`,
        description: `Periode: bulan ${src.periodStart} s.d. ${src.periodEnd}. Pastikan ini benar jika karyawan tidak bekerja setahun penuh.`,
        field: `incomeSources[${i}].periodStart`,
      });
    }
  }

  return issues;
}

function checkCalculations(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { summary, ptkpStatus, incomeSources } = input;

  // Recalculate totals
  const recalcGross = incomeSources.reduce((s, i) => s + i.grossIncome, 0);
  const recalcNet = incomeSources.reduce((s, i) => s + i.netIncome, 0);
  const recalcWithheld = incomeSources.reduce((s, i) => s + i.taxWithheld, 0);

  // Check gross income total
  if (Math.abs(recalcGross - summary.totalGrossIncome) > 1000) {
    issues.push({
      id: 'calc-gross-mismatch',
      severity: 'ERROR',
      category: 'CALCULATION',
      title: 'Total penghasilan bruto tidak sesuai',
      description: `Penjumlahan penghasilan bruto (Rp ${recalcGross.toLocaleString('id-ID')}) berbeda dengan total di SPT (Rp ${summary.totalGrossIncome.toLocaleString('id-ID')}).`,
      expectedValue: recalcGross.toLocaleString('id-ID'),
      actualValue: summary.totalGrossIncome.toLocaleString('id-ID'),
    });
  }

  // Check net income total
  if (Math.abs(recalcNet - summary.totalNetIncome) > 1000) {
    issues.push({
      id: 'calc-net-mismatch',
      severity: 'WARNING',
      category: 'CALCULATION',
      title: 'Total penghasilan neto tidak sesuai',
      description: `Penjumlahan neto (Rp ${recalcNet.toLocaleString('id-ID')}) berbeda dengan total SPT (Rp ${summary.totalNetIncome.toLocaleString('id-ID')}).`,
      expectedValue: recalcNet.toLocaleString('id-ID'),
      actualValue: summary.totalNetIncome.toLocaleString('id-ID'),
    });
  }

  // Check PTKP amount
  const expectedPtkp = PTKP_RATES[ptkpStatus];
  if (Math.abs(summary.ptkpAmount - expectedPtkp) > 0) {
    issues.push({
      id: 'calc-ptkp-mismatch',
      severity: 'ERROR',
      category: 'CALCULATION',
      title: 'PTKP tidak sesuai dengan status',
      description: `PTKP untuk ${ptkpStatus} seharusnya Rp ${expectedPtkp.toLocaleString('id-ID')}, tetapi di SPT Rp ${summary.ptkpAmount.toLocaleString('id-ID')}.`,
      expectedValue: expectedPtkp.toLocaleString('id-ID'),
      actualValue: summary.ptkpAmount.toLocaleString('id-ID'),
    });
  }

  // Check PKP = Net - PTKP
  const expectedPkp = Math.max(0, summary.totalNetIncome - expectedPtkp);
  if (Math.abs(summary.taxableIncome - expectedPkp) > 1000) {
    issues.push({
      id: 'calc-pkp-mismatch',
      severity: 'ERROR',
      category: 'CALCULATION',
      title: 'PKP (Penghasilan Kena Pajak) tidak sesuai',
      description: `PKP seharusnya Rp ${expectedPkp.toLocaleString('id-ID')} (Neto - PTKP), tetapi di SPT Rp ${summary.taxableIncome.toLocaleString('id-ID')}.`,
      expectedValue: expectedPkp.toLocaleString('id-ID'),
      actualValue: summary.taxableIncome.toLocaleString('id-ID'),
    });
  }

  // Check progressive tax calculation
  const expectedTax = calculateProgressiveTax(expectedPkp);
  if (Math.abs(summary.taxDue - expectedTax) > 1000) {
    issues.push({
      id: 'calc-tax-mismatch',
      severity: 'ERROR',
      category: 'CALCULATION',
      title: 'PPh terutang tidak sesuai perhitungan',
      description: `PPh terutang seharusnya Rp ${expectedTax.toLocaleString('id-ID')}, tetapi di SPT Rp ${summary.taxDue.toLocaleString('id-ID')}.`,
      expectedValue: expectedTax.toLocaleString('id-ID'),
      actualValue: summary.taxDue.toLocaleString('id-ID'),
    });
  }

  // Check withheld total
  if (Math.abs(recalcWithheld - summary.totalTaxWithheld) > 1000) {
    issues.push({
      id: 'calc-withheld-mismatch',
      severity: 'WARNING',
      category: 'CALCULATION',
      title: 'Total PPh dipotong tidak sesuai',
      description: `Penjumlahan PPh dipotong (Rp ${recalcWithheld.toLocaleString('id-ID')}) berbeda dengan total SPT (Rp ${summary.totalTaxWithheld.toLocaleString('id-ID')}).`,
      expectedValue: recalcWithheld.toLocaleString('id-ID'),
      actualValue: summary.totalTaxWithheld.toLocaleString('id-ID'),
    });
  }

  // Check position costs per income source
  for (let i = 0; i < incomeSources.length; i++) {
    const src = incomeSources[i];
    const maxPosn = Math.min(src.grossIncome * POSITION_COST.MAX_PERCENTAGE, POSITION_COST.MAX_ANNUAL);
    if (src.positionCosts > maxPosn + 1000) {
      issues.push({
        id: `calc-position-cost-${i}`,
        severity: 'WARNING',
        category: 'CALCULATION',
        title: `Biaya jabatan melebihi batas - ${src.employerName || `#${i + 1}`}`,
        description: `Biaya jabatan Rp ${src.positionCosts.toLocaleString('id-ID')} melebihi maks Rp ${maxPosn.toLocaleString('id-ID')} (5% bruto atau Rp 6 juta).`,
        expectedValue: `≤ ${maxPosn.toLocaleString('id-ID')}`,
        actualValue: src.positionCosts.toLocaleString('id-ID'),
      });
    }
  }

  return issues;
}

function checkAnomalies(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { summary, incomeSources } = input;

  // Effective tax rate check
  if (summary.totalGrossIncome > 0) {
    const effectiveRate = summary.taxDue / summary.totalGrossIncome;
    if (effectiveRate > 0.30) {
      issues.push({
        id: 'anom-high-rate',
        severity: 'WARNING',
        category: 'ANOMALY',
        title: 'Tarif efektif sangat tinggi',
        description: `Tarif efektif pajak ${(effectiveRate * 100).toFixed(1)}% tergolong tinggi. Pastikan PTKP dan pengurangan sudah benar.`,
        actualValue: `${(effectiveRate * 100).toFixed(1)}%`,
      });
    }
  }

  // Very high income for 1770SS
  if (input.sptType === '1770SS' && summary.totalGrossIncome > 60_000_000) {
    issues.push({
      id: 'anom-wrong-form',
      severity: 'WARNING',
      category: 'ANOMALY',
      title: 'Penghasilan melebihi batas SPT 1770 SS',
      description: `Penghasilan bruto Rp ${summary.totalGrossIncome.toLocaleString('id-ID')} melebihi Rp 60 juta. Pertimbangkan menggunakan SPT 1770 S.`,
      suggestion: 'Gunakan formulir SPT 1770 S untuk penghasilan > Rp 60 juta.',
    });
  }

  // Multiple employers check
  if (incomeSources.length > 1) {
    issues.push({
      id: 'anom-multi-employer',
      severity: 'INFO',
      category: 'ANOMALY',
      title: `${incomeSources.length} pemberi kerja terdeteksi`,
      description: 'Dengan lebih dari satu pemberi kerja, pastikan semua bukti potong sudah tercakup dan perhitungan PPh mempertimbangkan penggabungan penghasilan.',
    });
  }

  // Large refund check
  if (summary.taxRefund > summary.taxDue * 0.5 && summary.taxRefund > 5_000_000) {
    issues.push({
      id: 'anom-large-refund',
      severity: 'INFO',
      category: 'ANOMALY',
      title: 'Lebih bayar cukup besar',
      description: `Lebih bayar Rp ${summary.taxRefund.toLocaleString('id-ID')} (${((summary.taxRefund / summary.totalTaxWithheld) * 100).toFixed(0)}% dari PPh dipotong). Pastikan data penghasilan dan potongan sudah benar karena bisa memicu pemeriksaan.`,
    });
  }

  // Duplicate employer check
  const npwps = incomeSources.map(s => s.employerNpwp).filter(Boolean);
  const dupes = npwps.filter((v, i, a) => a.indexOf(v) !== i);
  if (dupes.length > 0) {
    issues.push({
      id: 'anom-duplicate-employer',
      severity: 'WARNING',
      category: 'ANOMALY',
      title: 'NPWP pemberi kerja duplikat',
      description: `NPWP ${dupes[0]} muncul lebih dari sekali. Pastikan tidak ada bukti potong ganda.`,
    });
  }

  return issues;
}

function checkCompliance(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if net income < gross (sanity)
  for (let i = 0; i < input.incomeSources.length; i++) {
    const src = input.incomeSources[i];
    if (src.netIncome > src.grossIncome) {
      issues.push({
        id: `compl-net-gt-gross-${i}`,
        severity: 'ERROR',
        category: 'COMPLIANCE',
        title: `Neto > Bruto - ${src.employerName || `#${i + 1}`}`,
        description: `Penghasilan neto (Rp ${src.netIncome.toLocaleString('id-ID')}) lebih besar dari bruto (Rp ${src.grossIncome.toLocaleString('id-ID')}). Ini tidak mungkin.`,
      });
    }
  }

  // Tax withheld should not exceed tax due significantly per source
  for (let i = 0; i < input.incomeSources.length; i++) {
    const src = input.incomeSources[i];
    if (src.taxWithheld > src.grossIncome * 0.35) {
      issues.push({
        id: `compl-over-withhold-${i}`,
        severity: 'WARNING',
        category: 'COMPLIANCE',
        title: `PPh dipotong sangat tinggi - ${src.employerName || `#${i + 1}`}`,
        description: `PPh dipotong (Rp ${src.taxWithheld.toLocaleString('id-ID')}) melebihi 35% dari bruto. Periksa kembali bukti potong.`,
      });
    }
  }

  return issues;
}

function checkDeadline(input: FilingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const now = new Date();
  const deadlineYear = input.taxYear + 1;

  // Individual SPT deadline: March 31
  const deadline = new Date(deadlineYear, 2, 31); // March 31

  if (now > deadline) {
    const daysLate = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    issues.push({
      id: 'deadline-late',
      severity: 'WARNING',
      category: 'DEADLINE',
      title: 'Melewati batas waktu pelaporan',
      description: `Batas pelaporan SPT ${input.taxYear} adalah 31 Maret ${deadlineYear}. Anda terlambat ${daysLate} hari. Denda keterlambatan Rp 100.000.`,
      suggestion: 'Segera laporkan untuk menghindari sanksi tambahan.',
    });
  } else {
    const daysLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 14) {
      issues.push({
        id: 'deadline-soon',
        severity: 'INFO',
        category: 'DEADLINE',
        title: `${daysLeft} hari lagi menuju batas waktu`,
        description: `Batas pelaporan SPT ${input.taxYear}: 31 Maret ${deadlineYear}. Segera selesaikan pelaporan.`,
      });
    }
  }

  return issues;
}

// ========================================
// Helpers
// ========================================

function calculateProgressiveTax(pkp: number): number {
  if (pkp <= 0) return 0;
  let tax = 0;
  let remaining = pkp;
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

async function getAISummary(input: FilingValidationInput, issues: ValidationIssue[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const errors = issues.filter(i => i.severity === 'ERROR');
  const warnings = issues.filter(i => i.severity === 'WARNING');

  if (errors.length === 0 && warnings.length === 0) {
    return 'SPT Anda terlihat baik! Tidak ditemukan kesalahan atau anomali yang signifikan. Silakan periksa kembali sebelum submit.';
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Anda adalah validator SPT pajak Indonesia. Berikan ringkasan singkat (2-3 kalimat) dalam bahasa Indonesia tentang masalah yang ditemukan.

SPT ${input.sptType} Tahun ${input.taxYear}:
- Bruto: Rp ${input.summary.totalGrossIncome.toLocaleString('id-ID')}
- PPh Terutang: Rp ${input.summary.taxDue.toLocaleString('id-ID')}
- Status: ${input.summary.status}

Masalah ditemukan:
${errors.map(e => `[ERROR] ${e.title}: ${e.description}`).join('\n')}
${warnings.map(w => `[WARNING] ${w.title}: ${w.description}`).join('\n')}

Berikan saran prioritas tindakan.`,
    }],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
}
