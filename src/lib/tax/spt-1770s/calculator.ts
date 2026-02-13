/**
 * SPT 1770 S Calculator
 *
 * Calculates annual tax return for individuals with:
 * - Annual gross income >= Rp 60 million, OR
 * - Multiple sources of employment income
 */

import type {
  SPT1770SData,
  SPT1770SSummary,
  SPT1770SOtherIncome,
  SPT1770STaxCredits,
  SPT1770SFinalTaxIncome,
  SPT1770SEligibility,
  TaxBracketBreakdown,
  SpouseIncomeData,
} from './types';
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  ValidationResult,
  TaxStatus,
  AssetDeclaration,
  LiabilityDeclaration,
} from '../shared/types';
import {
  PTKP_RATES,
  calculateProgressiveTax,
  getTaxBracketDetails,
  calculateTaxStatus,
  getPTKPAmount,
  getPTKPDescription,
  formatRupiah,
  formatNumber,
} from '../shared';

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate SPT 1770 S from input data
 */
export function calculateSPT1770S(params: {
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;
  taxYear: number;
  employmentIncome: IncomeSource1721A1[];
  otherIncome?: Partial<SPT1770SOtherIncome>;
  finalTaxIncome?: Partial<SPT1770SFinalTaxIncome>;
  taxCredits?: Partial<SPT1770STaxCredits>;
  spouseIncome?: SpouseIncomeData;
  assets?: AssetDeclaration[];
  liabilities?: LiabilityDeclaration[];
  correctionNumber?: number;
}): SPT1770SData {
  const {
    taxpayer,
    ptkpStatus,
    taxYear,
    employmentIncome,
    otherIncome,
    finalTaxIncome,
    taxCredits,
    spouseIncome,
    assets,
    liabilities,
    correctionNumber = 0,
  } = params;

  // Calculate normalized other income
  const normalizedOtherIncome = normalizeOtherIncome(otherIncome);

  // Calculate normalized final tax income
  const normalizedFinalTaxIncome = normalizeFinalTaxIncome(finalTaxIncome);

  // Calculate normalized tax credits
  const normalizedTaxCredits = normalizeTaxCredits(taxCredits, employmentIncome);

  // Calculate summary
  const summary = calculateSummary({
    employmentIncome,
    otherIncome: normalizedOtherIncome,
    taxCredits: normalizedTaxCredits,
    ptkpStatus,
    spouseIncome,
  });

  return {
    taxYear,
    correctionNumber,
    submissionDate: new Date(),
    taxpayer,
    ptkpStatus,
    employmentIncome,
    otherIncome: normalizedOtherIncome,
    finalTaxIncome: normalizedFinalTaxIncome,
    taxCredits: normalizedTaxCredits,
    summary,
    assets,
    liabilities,
    spouseIncome,
  };
}

/**
 * Calculate SPT summary
 */
export function calculateSummary(params: {
  employmentIncome: IncomeSource1721A1[];
  otherIncome: SPT1770SOtherIncome;
  taxCredits: SPT1770STaxCredits;
  ptkpStatus: PTKPStatus;
  spouseIncome?: SpouseIncomeData;
}): SPT1770SSummary {
  const { employmentIncome, otherIncome, taxCredits, ptkpStatus, spouseIncome } = params;

  // Part A: Calculate employment income totals
  let totalEmploymentGrossIncome = 0;
  let totalEmploymentDeductions = 0;
  let totalEmploymentNetIncome = 0;

  for (const source of employmentIncome) {
    totalEmploymentGrossIncome += source.grossIncome;
    totalEmploymentDeductions += source.positionCosts + source.pensionContribution;
    totalEmploymentNetIncome += source.netIncome;
  }

  // Part B: Other income total
  const totalOtherIncome = otherIncome.totalOtherIncome;

  // Part C: Spouse income (if joint filing)
  const spouseNetIncome =
    spouseIncome?.isJointFiling ? spouseIncome.netIncome : 0;

  // Part D: Total net income
  const totalNetIncome = totalEmploymentNetIncome + totalOtherIncome + spouseNetIncome;

  // Part E: PTKP and PKP
  const ptkpAmount = getPTKPAmount(ptkpStatus);
  const taxableIncome = Math.max(0, totalNetIncome - ptkpAmount);

  // Part F: Calculate tax due
  const taxDue = calculateProgressiveTax(taxableIncome);

  // Calculate tax on foreign income for PPh 24 credit limit
  const foreignIncome = otherIncome.foreignIncome || [];
  const totalForeignIncome = foreignIncome.reduce(
    (sum, fi) => sum + fi.incomeInIDR,
    0
  );
  const taxOnForeignIncome =
    totalForeignIncome > 0 && taxableIncome > 0
      ? Math.round((totalForeignIncome / taxableIncome) * taxDue)
      : 0;

  const totalTaxBeforeCredits = taxDue;

  // Part G: Calculate tax credits with PPh 24 limit
  const totalForeignTaxPaid = foreignIncome.reduce(
    (sum, fi) => sum + fi.foreignTaxPaid,
    0
  );
  const pph24Credit = Math.min(taxCredits.pph24ForeignTaxCredit, taxOnForeignIncome);

  const totalTaxCredits =
    taxCredits.pph21Withheld +
    taxCredits.pph22Withheld +
    taxCredits.pph23Withheld +
    pph24Credit +
    taxCredits.pph25Installments +
    taxCredits.stpPayments;

  // Part H: Calculate net tax
  const { status, taxPayable, taxRefund } = calculateTaxStatus(
    totalTaxBeforeCredits,
    totalTaxCredits
  );

  // Generate tax breakdown
  const taxBreakdown = generateTaxBreakdown(taxableIncome);

  return {
    totalEmploymentGrossIncome,
    totalEmploymentDeductions,
    totalEmploymentNetIncome,
    totalOtherIncome,
    spouseNetIncome,
    totalNetIncome,
    ptkpAmount,
    taxableIncome,
    taxDue,
    taxOnForeignIncome,
    totalTaxBeforeCredits,
    totalTaxCredits,
    pph24Credit,
    taxPayable,
    taxRefund,
    status,
    taxBreakdown,
  };
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize other income with defaults
 */
function normalizeOtherIncome(
  input?: Partial<SPT1770SOtherIncome>
): SPT1770SOtherIncome {
  const otherIncome: SPT1770SOtherIncome = {
    interestFromBank: input?.interestFromBank || 0,
    dividends: input?.dividends || 0,
    rental: input?.rental || 0,
    royalties: input?.royalties || 0,
    capitalGains: input?.capitalGains || 0,
    prizes: input?.prizes || 0,
    otherIncome: input?.otherIncome || 0,
    foreignIncome: input?.foreignIncome || [],
    totalOtherIncome: 0,
  };

  // Calculate foreign income total
  const foreignIncomeTotal = (otherIncome.foreignIncome || []).reduce(
    (sum, fi) => sum + fi.incomeInIDR,
    0
  );

  // Calculate total
  otherIncome.totalOtherIncome =
    otherIncome.interestFromBank +
    otherIncome.dividends +
    otherIncome.rental +
    otherIncome.royalties +
    otherIncome.capitalGains +
    otherIncome.prizes +
    otherIncome.otherIncome +
    foreignIncomeTotal;

  return otherIncome;
}

/**
 * Normalize final tax income with defaults
 */
function normalizeFinalTaxIncome(
  input?: Partial<SPT1770SFinalTaxIncome>
): SPT1770SFinalTaxIncome {
  const finalTaxIncome: SPT1770SFinalTaxIncome = {
    bankInterest: input?.bankInterest || 0,
    bankInterestTax: input?.bankInterestTax || 0,
    depositInterest: input?.depositInterest || 0,
    depositInterestTax: input?.depositInterestTax || 0,
    stockDividend: input?.stockDividend || 0,
    stockDividendTax: input?.stockDividendTax || 0,
    propertyRental: input?.propertyRental || 0,
    propertyRentalTax: input?.propertyRentalTax || 0,
    landBuildingSale: input?.landBuildingSale || 0,
    landBuildingSaleTax: input?.landBuildingSaleTax || 0,
    umkmIncome: input?.umkmIncome || 0,
    umkmTax: input?.umkmTax || 0,
    otherFinalIncome: input?.otherFinalIncome || 0,
    otherFinalTax: input?.otherFinalTax || 0,
    totalFinalIncome: 0,
    totalFinalTax: 0,
  };

  // Calculate totals
  finalTaxIncome.totalFinalIncome =
    finalTaxIncome.bankInterest +
    finalTaxIncome.depositInterest +
    finalTaxIncome.stockDividend +
    finalTaxIncome.propertyRental +
    finalTaxIncome.landBuildingSale +
    finalTaxIncome.umkmIncome +
    finalTaxIncome.otherFinalIncome;

  finalTaxIncome.totalFinalTax =
    finalTaxIncome.bankInterestTax +
    finalTaxIncome.depositInterestTax +
    finalTaxIncome.stockDividendTax +
    finalTaxIncome.propertyRentalTax +
    finalTaxIncome.landBuildingSaleTax +
    finalTaxIncome.umkmTax +
    finalTaxIncome.otherFinalTax;

  return finalTaxIncome;
}

/**
 * Normalize tax credits with defaults
 */
function normalizeTaxCredits(
  input?: Partial<SPT1770STaxCredits>,
  employmentIncome?: IncomeSource1721A1[]
): SPT1770STaxCredits {
  // Calculate PPh 21 from employment income if not provided
  const pph21FromEmployment = employmentIncome?.reduce(
    (sum, source) => sum + source.taxWithheld,
    0
  ) || 0;

  const taxCredits: SPT1770STaxCredits = {
    pph21Withheld: input?.pph21Withheld ?? pph21FromEmployment,
    pph22Withheld: input?.pph22Withheld || 0,
    pph23Withheld: input?.pph23Withheld || 0,
    pph24ForeignTaxCredit: input?.pph24ForeignTaxCredit || 0,
    pph25Installments: input?.pph25Installments || 0,
    stpPayments: input?.stpPayments || 0,
    totalTaxCredits: 0,
  };

  // Calculate total
  taxCredits.totalTaxCredits =
    taxCredits.pph21Withheld +
    taxCredits.pph22Withheld +
    taxCredits.pph23Withheld +
    taxCredits.pph24ForeignTaxCredit +
    taxCredits.pph25Installments +
    taxCredits.stpPayments;

  return taxCredits;
}

// ============================================================================
// TAX BREAKDOWN
// ============================================================================

/**
 * Generate detailed tax bracket breakdown
 */
function generateTaxBreakdown(taxableIncome: number): TaxBracketBreakdown[] {
  const details = getTaxBracketDetails(taxableIncome);

  return details.map((d, index) => ({
    bracketNumber: d.bracket,
    lowerLimit: index === 0 ? 0 : details[index - 1].amount,
    upperLimit: d.amount,
    rate: d.rate,
    taxableAmount: d.amount,
    taxAmount: d.tax,
  }));
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate SPT 1770 S data
 */
export function validateSPT1770S(data: SPT1770SData): ValidationResult {
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

  // Validate employment income
  if (data.employmentIncome.length === 0) {
    warnings.push('Tidak ada penghasilan dari pekerjaan');
  }

  // Validate each employment income source
  for (let i = 0; i < data.employmentIncome.length; i++) {
    const source = data.employmentIncome[i];

    if (!source.employerNpwp) {
      warnings.push(`Penghasilan ${i + 1}: NPWP pemberi kerja kosong`);
    }

    if (source.grossIncome <= 0) {
      warnings.push(`Penghasilan ${i + 1}: Penghasilan bruto tidak valid`);
    }

    // Validate position costs (max 5% of gross or Rp 6M)
    const maxPositionCosts = Math.min(source.grossIncome * 0.05, 6_000_000);
    if (source.positionCosts > maxPositionCosts) {
      warnings.push(`Penghasilan ${i + 1}: Biaya jabatan melebihi batas maksimum`);
    }
  }

  // Validate PTKP status vs spouse income
  if (data.ptkpStatus.startsWith('K/I') && !data.spouseIncome) {
    warnings.push('Status K/I dipilih tapi data penghasilan istri tidak diisi');
  }

  // Validate calculations
  const recalculatedSummary = calculateSummary({
    employmentIncome: data.employmentIncome,
    otherIncome: data.otherIncome || normalizeOtherIncome({}),
    taxCredits: data.taxCredits,
    ptkpStatus: data.ptkpStatus,
    spouseIncome: data.spouseIncome,
  });

  if (Math.abs(recalculatedSummary.taxDue - data.summary.taxDue) > 1000) {
    warnings.push('PPh terutang tidak sesuai dengan perhitungan ulang');
  }

  // Check eligibility for 1770 S
  const eligibility = checkSPT1770SEligibility({
    employmentIncome: data.employmentIncome,
    hasBusinessIncome: false,
  });

  if (!eligibility.eligible) {
    warnings.push(`Form 1770 S mungkin tidak sesuai: ${eligibility.reason}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if taxpayer is eligible for SPT 1770 S
 */
export function checkSPT1770SEligibility(params: {
  employmentIncome: IncomeSource1721A1[];
  hasBusinessIncome?: boolean;
  hasFreelanceIncome?: boolean;
}): SPT1770SEligibility {
  const { employmentIncome, hasBusinessIncome, hasFreelanceIncome } = params;

  // If has business or freelance income, should use 1770
  if (hasBusinessIncome || hasFreelanceIncome) {
    return {
      eligible: false,
      reason: 'Wajib pajak memiliki penghasilan usaha/pekerjaan bebas',
      suggestedForm: '1770',
    };
  }

  // Calculate total gross income
  const totalGrossIncome = employmentIncome.reduce(
    (sum, source) => sum + source.grossIncome,
    0
  );

  // If single source and income < 60M, can use 1770 SS
  if (employmentIncome.length === 1 && totalGrossIncome < 60_000_000) {
    return {
      eligible: false,
      reason: 'Penghasilan bruto < Rp 60 juta dengan satu pemberi kerja, dapat menggunakan 1770 SS',
      suggestedForm: '1770SS',
    };
  }

  return { eligible: true };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

// Re-export shared utilities for convenience
export {
  formatRupiah,
  formatNumber,
  getPTKPDescription,
  getPTKPAmount,
};
