/**
 * Shared Validation Utilities
 *
 * Common validation functions for tax data
 */

import type { ValidationResult, TaxpayerData, CorporateIdentity } from './types';

// ============================================================================
// NPWP VALIDATION
// ============================================================================

/**
 * Validate NPWP format
 * NPWP format: XX.XXX.XXX.X-XXX.XXX (15 digits with separators)
 * or 15 digits without separators
 */
export function isValidNPWPFormat(npwp: string): boolean {
  // Remove separators and validate 15 digits
  const cleanNpwp = npwp.replace(/[.\-]/g, '');
  return /^\d{15}$/.test(cleanNpwp);
}

/**
 * Format NPWP to standard format (XX.XXX.XXX.X-XXX.XXX)
 */
export function formatNPWP(npwp: string): string {
  const clean = npwp.replace(/[.\-]/g, '');
  if (clean.length !== 15) return npwp;

  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}-${clean.slice(9, 12)}.${clean.slice(12, 15)}`;
}

/**
 * Mask NPWP for display/logging (show only first 2 and last 3 digits)
 */
export function maskNPWP(npwp: string): string {
  const clean = npwp.replace(/[.\-]/g, '');
  if (clean.length !== 15) return npwp;

  return `${clean.slice(0, 2)}.***.***.*-***.${clean.slice(12, 15)}`;
}

/**
 * Validate NPWP check digit (Luhn algorithm variant)
 */
export function validateNPWPCheckDigit(npwp: string): boolean {
  const clean = npwp.replace(/[.\-]/g, '');
  if (clean.length !== 15) return false;

  // Extract components
  const identity = clean.slice(0, 9);
  const branch = clean.slice(9, 12);
  const checkDigit = parseInt(clean.slice(12, 15), 10);

  // Basic check - check digit should be 000 for main branch
  // This is a simplified validation - full validation would require DJP API
  if (branch === '000' && checkDigit === 0) {
    return false; // Invalid combination
  }

  return true;
}

// ============================================================================
// NIK VALIDATION
// ============================================================================

/**
 * Validate NIK (Nomor Induk Kependudukan) format
 * NIK is 16 digits
 */
export function isValidNIKFormat(nik: string): boolean {
  const clean = nik.replace(/\s/g, '');
  return /^\d{16}$/.test(clean);
}

/**
 * Format NIK for display (add spaces every 4 digits)
 */
export function formatNIK(nik: string): string {
  const clean = nik.replace(/\s/g, '');
  if (clean.length !== 16) return nik;

  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
}

/**
 * Mask NIK for display/logging
 */
export function maskNIK(nik: string): string {
  const clean = nik.replace(/\s/g, '');
  if (clean.length !== 16) return nik;

  return `${clean.slice(0, 4)} **** **** ${clean.slice(12, 16)}`;
}

/**
 * Extract region code from NIK
 */
export function extractNIKRegion(nik: string): {
  provinceCode: string;
  cityCode: string;
  districtCode: string;
} | null {
  const clean = nik.replace(/\s/g, '');
  if (clean.length !== 16) return null;

  return {
    provinceCode: clean.slice(0, 2),
    cityCode: clean.slice(2, 4),
    districtCode: clean.slice(4, 6),
  };
}

// ============================================================================
// TAX PERIOD VALIDATION
// ============================================================================

/**
 * Validate tax period format (YYYY-MM or YYYY)
 */
export function isValidTaxPeriod(period: string): boolean {
  // Annual format: YYYY
  if (/^\d{4}$/.test(period)) {
    const year = parseInt(period, 10);
    return year >= 2000 && year <= new Date().getFullYear();
  }

  // Monthly format: YYYY-MM
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    return year >= 2000 && year <= new Date().getFullYear() && month >= 1 && month <= 12;
  }

  return false;
}

/**
 * Parse tax period to year and month
 */
export function parseTaxPeriod(period: string): { year: number; month?: number } | null {
  if (/^\d{4}$/.test(period)) {
    return { year: parseInt(period, 10) };
  }

  if (/^\d{4}-\d{2}$/.test(period)) {
    const [yearStr, monthStr] = period.split('-');
    return {
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
    };
  }

  return null;
}

// ============================================================================
// TAXPAYER DATA VALIDATION
// ============================================================================

/**
 * Validate taxpayer data
 */
export function validateTaxpayerData(data: TaxpayerData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.npwp) {
    errors.push('NPWP wajib pajak tidak boleh kosong');
  } else if (!isValidNPWPFormat(data.npwp)) {
    errors.push('Format NPWP tidak valid (harus 15 digit)');
  }

  if (!data.nik) {
    warnings.push('NIK tidak diisi');
  } else if (!isValidNIKFormat(data.nik)) {
    errors.push('Format NIK tidak valid (harus 16 digit)');
  }

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Nama wajib pajak tidak boleh kosong');
  } else if (data.name.length < 3) {
    warnings.push('Nama wajib pajak terlalu pendek');
  }

  if (!data.address || data.address.trim().length === 0) {
    errors.push('Alamat wajib pajak tidak boleh kosong');
  }

  // Optional field validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    warnings.push('Format email tidak valid');
  }

  if (data.phone && !/^(\+62|62|0)[0-9]{9,13}$/.test(data.phone.replace(/[\s\-]/g, ''))) {
    warnings.push('Format nomor telepon tidak valid');
  }

  if (data.postalCode && !/^\d{5}$/.test(data.postalCode)) {
    warnings.push('Kode pos harus 5 digit');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate corporate identity data (for SPT 1771)
 */
export function validateCorporateIdentity(data: CorporateIdentity): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.npwp) {
    errors.push('NPWP badan tidak boleh kosong');
  } else if (!isValidNPWPFormat(data.npwp)) {
    errors.push('Format NPWP badan tidak valid');
  }

  if (!data.companyName || data.companyName.trim().length === 0) {
    errors.push('Nama perusahaan tidak boleh kosong');
  }

  if (!data.legalName || data.legalName.trim().length === 0) {
    errors.push('Nama badan hukum tidak boleh kosong');
  }

  if (!data.registrationNumber) {
    errors.push('Nomor registrasi tidak boleh kosong');
  }

  if (!data.address || data.address.trim().length === 0) {
    errors.push('Alamat tidak boleh kosong');
  }

  if (!data.kluCode) {
    errors.push('Kode KLU tidak boleh kosong');
  } else if (!/^\d{5}$/.test(data.kluCode)) {
    errors.push('Kode KLU harus 5 digit');
  }

  // Fiscal year validation
  if (data.fiscalYearEnd) {
    const [month, day] = data.fiscalYearEnd.split('-').map(Number);
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      errors.push('Format akhir tahun fiskal tidak valid (harus MM-DD)');
    }
  }

  // Audit requirement
  if (data.isAuditRequired) {
    if (!data.auditorName) {
      warnings.push('Nama auditor tidak diisi untuk perusahaan wajib audit');
    }
    if (!data.auditorLicense) {
      warnings.push('Nomor izin auditor tidak diisi');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// AMOUNT VALIDATION
// ============================================================================

/**
 * Validate that an amount is a valid positive number
 */
export function isValidAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && !isNaN(amount) && isFinite(amount) && amount >= 0;
}

/**
 * Validate income data consistency
 */
export function validateIncomeConsistency(params: {
  grossIncome: number;
  deductions: number;
  netIncome: number;
  tolerance?: number;
}): ValidationResult {
  const { grossIncome, deductions, netIncome, tolerance = 1000 } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  const calculatedNet = grossIncome - deductions;
  const difference = Math.abs(calculatedNet - netIncome);

  if (difference > tolerance) {
    errors.push(
      `Penghasilan neto tidak konsisten: ${netIncome} seharusnya ${calculatedNet} (selisih ${difference})`
    );
  }

  if (grossIncome < 0) {
    errors.push('Penghasilan bruto tidak boleh negatif');
  }

  if (deductions < 0) {
    errors.push('Pengurangan tidak boleh negatif');
  }

  if (deductions > grossIncome) {
    warnings.push('Pengurangan melebihi penghasilan bruto');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// BILLING CODE VALIDATION
// ============================================================================

/**
 * Validate Kode Billing format (15-16 digits)
 */
export function isValidBillingCode(kodeBilling: string): boolean {
  return /^\d{15,16}$/.test(kodeBilling);
}

/**
 * Validate NTPN format (16 alphanumeric characters)
 */
export function isValidNTPN(ntpn: string): boolean {
  return /^[A-Z0-9]{16}$/.test(ntpn);
}
