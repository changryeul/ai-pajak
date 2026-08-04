/**
 * Shared Tax Utility Functions
 *
 * Common calculation and formatting utilities used across SPT forms
 */

import { TAX_BRACKETS, PTKP_RATES, PTKP_DESCRIPTIONS, SPT_DEADLINES, CORPORATE_TAX } from './constants';
import type { PTKPStatus, TaxStatus } from './types';

// ============================================================================
// TAX CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate progressive tax based on taxable income (PKP)
 * Used for individual income tax (PPh 21)
 *
 * @param taxableIncome - Penghasilan Kena Pajak (PKP)
 * @returns Tax amount rounded to nearest Rupiah
 */
export function calculateProgressiveTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;
  let previousLimit = 0;

  for (const bracket of TAX_BRACKETS) {
    const bracketAmount = Math.min(remaining, bracket.limit - previousLimit);
    if (bracketAmount <= 0) break;

    tax += bracketAmount * bracket.rate;
    remaining -= bracketAmount;
    previousLimit = bracket.limit;
  }

  return Math.round(tax);
}

/**
 * Calculate corporate tax
 *
 * @param taxableIncome - Corporate taxable income
 * @param grossRevenue - Gross revenue (to determine SME status)
 * @returns Tax amount
 */
export function calculateCorporateTax(taxableIncome: number, grossRevenue?: number): number {
  if (taxableIncome <= 0) return 0;

  // Check if qualifies for SME rate
  if (grossRevenue && grossRevenue < CORPORATE_TAX.SME_THRESHOLD) {
    // SME can use reduced rate on portion proportional to threshold
    const smePortionLimit = (CORPORATE_TAX.SME_THRESHOLD / grossRevenue) * taxableIncome;
    const smePortion = Math.min(taxableIncome, smePortionLimit);
    const regularPortion = taxableIncome - smePortion;

    return Math.round(
      smePortion * CORPORATE_TAX.SME_RATE +
      regularPortion * CORPORATE_TAX.STANDARD_RATE
    );
  }

  return Math.round(taxableIncome * CORPORATE_TAX.STANDARD_RATE);
}

/**
 * Get tax bracket details for a given income
 */
export function getTaxBracketDetails(taxableIncome: number): Array<{
  bracket: number;
  rate: number;
  amount: number;
  tax: number;
}> {
  if (taxableIncome <= 0) return [];

  const details: Array<{
    bracket: number;
    rate: number;
    amount: number;
    tax: number;
  }> = [];

  let remaining = taxableIncome;
  let previousLimit = 0;

  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i];
    const bracketAmount = Math.min(remaining, bracket.limit - previousLimit);
    if (bracketAmount <= 0) break;

    details.push({
      bracket: i + 1,
      rate: bracket.rate,
      amount: bracketAmount,
      tax: Math.round(bracketAmount * bracket.rate),
    });

    remaining -= bracketAmount;
    previousLimit = bracket.limit;
  }

  return details;
}

/**
 * Calculate tax status from tax due and tax withheld
 */
export function calculateTaxStatus(taxDue: number, taxWithheld: number): {
  status: TaxStatus;
  taxPayable: number;
  taxRefund: number;
} {
  const difference = taxDue - taxWithheld;

  if (difference === 0) {
    return { status: 'NIHIL', taxPayable: 0, taxRefund: 0 };
  } else if (difference > 0) {
    return { status: 'KURANG_BAYAR', taxPayable: difference, taxRefund: 0 };
  } else {
    return { status: 'LEBIH_BAYAR', taxPayable: 0, taxRefund: -difference };
  }
}

// ============================================================================
// PTKP UTILITIES
// ============================================================================

/**
 * Get PTKP amount for a given status
 */
export function getPTKPAmount(status: PTKPStatus): number {
  return PTKP_RATES[status];
}

/**
 * Get PTKP description in Indonesian
 */
export function getPTKPDescription(status: PTKPStatus): string {
  return PTKP_DESCRIPTIONS[status];
}

/**
 * Parse PTKP status from separate components
 */
export function buildPTKPStatus(params: {
  isMarried: boolean;
  spouseIncomeJoint?: boolean;
  dependents: number;
}): PTKPStatus {
  const { isMarried, spouseIncomeJoint, dependents } = params;
  const deps = Math.min(Math.max(0, dependents), 3); // 0-3 only

  if (!isMarried) {
    return `TK/${deps}` as PTKPStatus;
  } else if (spouseIncomeJoint) {
    return `K/I/${deps}` as PTKPStatus;
  } else {
    return `K/${deps}` as PTKPStatus;
  }
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get SPT submission deadline for a tax year
 */
export function getSPTDeadline(taxYear: number, isCorparate = false): Date {
  const deadline = isCorparate ? SPT_DEADLINES.CORPORATE : SPT_DEADLINES.INDIVIDUAL;
  return new Date(taxYear + 1, deadline.month - 1, deadline.day);
}

/**
 * Check if SPT submission is late
 */
export function isSPTLate(taxYear: number, submissionDate: Date, isCorporate = false): boolean {
  const deadline = getSPTDeadline(taxYear, isCorporate);
  return submissionDate > deadline;
}

/**
 * Calculate late filing penalty days
 */
export function calculateLateFilingDays(taxYear: number, submissionDate: Date, isCorporate = false): number {
  const deadline = getSPTDeadline(taxYear, isCorporate);
  if (submissionDate <= deadline) return 0;

  const diffMs = submissionDate.getTime() - deadline.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with Indonesian thousand separator
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount));
}

/**
 * Format percentage
 */
export function formatPercentage(rate: number, decimals = 0): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/**
 * Format date in Indonesian format (DD-MM-YYYY)
 */
export function formatDateID(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date in long Indonesian format (DD Month YYYY)
 */
export function formatDateLongID(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate position costs (Biaya Jabatan)
 * Max 5% of gross income or Rp 6M/year (Rp 500K/month)
 */
export function calculatePositionCosts(grossIncome: number, months = 12): number {
  const percentage = grossIncome * 0.05;
  const maxAnnual = 500_000 * months; // Rp 500K per month
  return Math.min(percentage, maxAnnual);
}

/**
 * Calculate net income from gross income and deductions
 */
export function calculateNetIncome(
  grossIncome: number,
  positionCosts: number,
  pensionContribution: number
): number {
  return grossIncome - positionCosts - pensionContribution;
}

/**
 * Round to nearest thousand (common in Indonesian tax)
 */
export function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

/**
 * Round down to nearest thousand (floor)
 */
export function floorToThousand(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}
