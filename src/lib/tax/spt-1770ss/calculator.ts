/**
 * SPT 1770 SS Calculator
 *
 * Calculates annual tax return data from Form 1721-A1 income sources
 */

import type {
  SPT1770SSData,
  SPT1770SSSummary,
  IncomeSource1721A1,
  TaxpayerData,
  PTKPStatus,
} from './types';
import {
  PTKP_RATES,
  calculateProgressiveTax as sharedCalculateProgressiveTax,
  formatRupiah as sharedFormatRupiah,
  formatNumber as sharedFormatNumber,
  getPTKPDescription as sharedGetPTKPDescription,
} from '../shared';
import { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

/**
 * Calculate SPT 1770 SS from Form 1721-A1 data
 */
export function calculateSPT1770SS(params: {
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;
  taxYear: number;
  incomeSources: IncomeSource1721A1[];
  correctionNumber?: number;
}): SPT1770SSData {
  const { taxpayer, ptkpStatus, taxYear, incomeSources, correctionNumber = 0 } = params;

  // Calculate summary
  const summary = calculateSummary(incomeSources, ptkpStatus);

  return {
    taxYear,
    correctionNumber,
    submissionDate: new Date(),
    taxpayer,
    ptkpStatus,
    incomeSources,
    summary,
  };
}

/**
 * Calculate SPT summary from income sources
 */
export function calculateSummary(
  incomeSources: IncomeSource1721A1[],
  ptkpStatus: PTKPStatus
): SPT1770SSSummary {
  // Aggregate income from all sources
  let totalGrossIncome = 0;
  let totalDeductions = 0;
  let totalNetIncome = 0;
  let totalTaxWithheld = 0;

  for (const source of incomeSources) {
    totalGrossIncome += source.grossIncome;
    totalDeductions += source.positionCosts + source.pensionContribution;
    totalNetIncome += source.netIncome;
    totalTaxWithheld += source.taxWithheld;
  }

  // Get PTKP amount based on status
  const ptkpAmount = PTKP_RATES[ptkpStatus];

  // Calculate taxable income (PKP)
  // PKP = Net Income - PTKP (minimum 0)
  const taxableIncome = Math.max(0, totalNetIncome - ptkpAmount);

  // Calculate tax due using progressive rates
  const taxDue = calculateProgressiveTax(taxableIncome);

  // Calculate tax payable/refund
  const difference = taxDue - totalTaxWithheld;
  const taxPayable = Math.max(0, difference);
  const taxRefund = Math.max(0, -difference);

  // Determine status
  let status: 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR';
  if (difference === 0) {
    status = 'NIHIL';
  } else if (difference > 0) {
    status = 'KURANG_BAYAR';
  } else {
    status = 'LEBIH_BAYAR';
  }

  return {
    totalGrossIncome,
    totalDeductions,
    totalNetIncome,
    ptkpAmount,
    taxableIncome,
    taxDue,
    totalTaxWithheld,
    taxPayable,
    taxRefund,
    status,
  };
}

/**
 * Calculate progressive tax based on PKP
 * @deprecated Use calculateProgressiveTax from '../shared' instead
 */
export function calculateProgressiveTax(taxableIncome: number): number {
  return sharedCalculateProgressiveTax(taxableIncome);
}

/**
 * Convert Form 1721-A1 OCR data to IncomeSource
 */
export function convertOCRToIncomeSource(
  ocrData: Form1721A1Data,
  taxYear: number
): IncomeSource1721A1 {
  return {
    employerNpwp: ocrData.employerNpwp || '',
    employerName: ocrData.employerName || '',
    periodStart: ocrData.masaPajakAwal || '01',
    periodEnd: ocrData.masaPajakAkhir || '12',
    taxYear: ocrData.tahunPajak || taxYear,
    grossIncome: ocrData.penghasilanBruto || 0,
    positionCosts: ocrData.biayaJabatan || 0,
    pensionContribution: ocrData.iuranPensiun || 0,
    netIncome: ocrData.penghasilanNeto || 0,
    ptkpAmount: ocrData.ptkp || 0,
    taxableIncome: ocrData.pkp || 0,
    taxDue: ocrData.pphTerutang || 0,
    taxWithheld: ocrData.pphDipotong || 0,
    buktiPotongNumber: ocrData.nomorBuktiPotong,
    buktiPotongDate: ocrData.tanggalBuktiPotong,
  };
}

/**
 * Validate SPT 1770 SS data
 */
export function validateSPT1770SS(data: SPT1770SSData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate taxpayer info
  if (!data.taxpayer.npwp) {
    errors.push('NPWP wajib pajak tidak boleh kosong');
  } else if (!/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/.test(data.taxpayer.npwp)) {
    errors.push('Format NPWP tidak valid');
  }

  if (!data.taxpayer.name) {
    errors.push('Nama wajib pajak tidak boleh kosong');
  }

  // Validate tax year
  const currentYear = new Date().getFullYear();
  if (data.taxYear > currentYear) {
    errors.push('Tahun pajak tidak boleh lebih dari tahun berjalan');
  }
  if (data.taxYear < 2020) {
    warnings.push('Tahun pajak terlalu lama, pastikan data sudah benar');
  }

  // Validate income sources
  if (data.incomeSources.length === 0) {
    errors.push('Minimal harus ada satu sumber penghasilan');
  }

  for (let i = 0; i < data.incomeSources.length; i++) {
    const source = data.incomeSources[i];

    if (!source.employerNpwp) {
      warnings.push(`Sumber penghasilan ${i + 1}: NPWP pemberi kerja kosong`);
    }

    if (source.grossIncome <= 0) {
      warnings.push(`Sumber penghasilan ${i + 1}: Penghasilan bruto tidak valid`);
    }

    // Validate position costs (max 5% of gross or Rp 6M)
    const maxPositionCosts = Math.min(source.grossIncome * 0.05, 6_000_000);
    if (source.positionCosts > maxPositionCosts) {
      warnings.push(
        `Sumber penghasilan ${i + 1}: Biaya jabatan melebihi batas maksimum`
      );
    }
  }

  // Validate calculations
  const recalculatedSummary = calculateSummary(data.incomeSources, data.ptkpStatus);

  if (Math.abs(recalculatedSummary.taxDue - data.summary.taxDue) > 1000) {
    warnings.push('PPh terutang tidak sesuai dengan perhitungan ulang');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get PTKP description
 * @deprecated Use getPTKPDescription from '../shared' instead
 */
export function getPTKPDescription(status: PTKPStatus): string {
  return sharedGetPTKPDescription(status);
}

/**
 * Format currency in Indonesian Rupiah
 * @deprecated Use formatRupiah from '../shared' instead
 */
export function formatRupiah(amount: number): string {
  return sharedFormatRupiah(amount);
}

/**
 * Format number with Indonesian thousand separator
 * @deprecated Use formatNumber from '../shared' instead
 */
export function formatNumber(amount: number): string {
  return sharedFormatNumber(amount);
}
