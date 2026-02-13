/**
 * SPT 1770 Calculator
 *
 * Main calculator for individuals with business/professional income.
 * Combines business income, employment income, other income, and deductions.
 */

import type {
  SPT1770Data,
  SPT1770Summary,
  SPT1770BusinessIncome,
  SPT1770OtherIncome,
  SPT1770FinalTaxIncome,
  SPT1770NonTaxableIncome,
  SPT1770LossCarryforward,
  SPT1770TaxCredits,
  TaxBracketBreakdown,
  FamilyMember,
} from './types';
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  AssetDeclaration,
  LiabilityDeclaration,
  ValidationResult,
  TaxStatus,
} from '../shared/types';
import {
  PTKP_RATES,
  LOSS_CARRYFORWARD,
} from '../shared/constants';
import {
  calculateProgressiveTax,
  getTaxBracketDetails,
  calculateTaxStatus,
  getPTKPAmount,
  getPTKPDescription,
  formatRupiah,
  formatNumber,
} from '../shared';
import {
  calculateBusinessIncome,
  calculateMultipleBusinessIncomes,
  BusinessIncomeInput,
} from './business-calculator';

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Input for SPT 1770 calculation
 */
export interface SPT1770Input {
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;
  taxYear: number;
  correctionNumber?: number;

  // Business income
  businessIncome?: BusinessIncomeInput[];

  // Employment income
  employmentIncome?: IncomeSource1721A1[];

  // Other income
  otherIncome?: Partial<SPT1770OtherIncome>;

  // Final tax income (for reporting)
  finalTaxIncome?: Partial<SPT1770FinalTaxIncome>;

  // Non-taxable income (for reporting)
  nonTaxableIncome?: Partial<SPT1770NonTaxableIncome>;

  // Loss carryforward
  lossCarryforward?: SPT1770LossCarryforward[];

  // Tax credits
  taxCredits?: Partial<SPT1770TaxCredits>;

  // Assets and liabilities
  assets?: AssetDeclaration[];
  liabilities?: LiabilityDeclaration[];

  // Family members
  familyMembers?: FamilyMember[];
}

/**
 * Calculate SPT 1770
 */
export function calculateSPT1770(input: SPT1770Input): SPT1770Data {
  const {
    taxpayer,
    ptkpStatus,
    taxYear,
    correctionNumber = 0,
    businessIncome: businessInputs,
    employmentIncome,
    otherIncome,
    finalTaxIncome,
    nonTaxableIncome,
    lossCarryforward,
    taxCredits,
    assets = [],
    liabilities = [],
    familyMembers,
  } = input;

  // Calculate business income
  let businessIncome: SPT1770BusinessIncome[] = [];
  if (businessInputs && businessInputs.length > 0) {
    const businessResult = calculateMultipleBusinessIncomes(
      businessInputs,
      taxYear
    );
    businessIncome = businessResult.businesses;
  }

  // Normalize other data
  const normalizedOtherIncome = normalizeOtherIncome(otherIncome);
  const normalizedFinalTaxIncome = normalizeFinalTaxIncome(finalTaxIncome);
  const normalizedNonTaxableIncome = normalizeNonTaxableIncome(nonTaxableIncome);
  const normalizedTaxCredits = normalizeTaxCredits(taxCredits, employmentIncome);

  // Process loss carryforward
  const processedLossCarryforward = processLossCarryforward(
    lossCarryforward || [],
    taxYear
  );

  // Calculate summary
  const summary = calculateSummary({
    businessIncome,
    employmentIncome: employmentIncome || [],
    otherIncome: normalizedOtherIncome,
    lossCarryforward: processedLossCarryforward,
    taxCredits: normalizedTaxCredits,
    ptkpStatus,
    taxYear,
  });

  return {
    taxYear,
    correctionNumber,
    submissionDate: new Date(),
    taxpayer,
    ptkpStatus,
    businessIncome,
    employmentIncome,
    otherIncome: normalizedOtherIncome,
    finalTaxIncome: normalizedFinalTaxIncome,
    nonTaxableIncome: normalizedNonTaxableIncome,
    lossCarryforward: processedLossCarryforward,
    taxCredits: normalizedTaxCredits,
    summary,
    assets,
    liabilities,
    familyMembers,
  };
}

/**
 * Calculate SPT 1770 summary
 */
export function calculateSummary(params: {
  businessIncome: SPT1770BusinessIncome[];
  employmentIncome: IncomeSource1721A1[];
  otherIncome: SPT1770OtherIncome;
  lossCarryforward: SPT1770LossCarryforward[];
  taxCredits: SPT1770TaxCredits;
  ptkpStatus: PTKPStatus;
  taxYear: number;
}): SPT1770Summary {
  const {
    businessIncome,
    employmentIncome,
    otherIncome,
    lossCarryforward,
    taxCredits,
    ptkpStatus,
  } = params;

  // Part A: Business income totals
  const totalBusinessRevenue = businessIncome.reduce(
    (sum, b) => sum + b.grossRevenue,
    0
  );
  const totalBusinessCOGS = businessIncome.reduce(
    (sum, b) => sum + (b.cogs?.costOfGoodsSold || 0),
    0
  );
  const totalBusinessExpenses = businessIncome.reduce(
    (sum, b) => sum + (b.operatingExpenses?.totalExpenses || 0),
    0
  );
  const totalBusinessDepreciation = businessIncome.reduce(
    (sum, b) => sum + b.totalDepreciation,
    0
  );
  const totalNetBusinessIncome = businessIncome.reduce(
    (sum, b) => sum + b.netBusinessIncome,
    0
  );

  // Part B: Employment income
  const totalEmploymentIncome = employmentIncome.reduce(
    (sum, e) => sum + e.netIncome,
    0
  );

  // Part C: Other income
  const totalOtherIncome = otherIncome.totalOtherIncome;

  // Part D: Gross total income
  const grossTotalIncome =
    totalNetBusinessIncome + totalEmploymentIncome + totalOtherIncome;

  // Part E: Loss carryforward
  const availableLoss = lossCarryforward
    .filter((l) => !l.isExpired && l.remaining > 0)
    .reduce((sum, l) => sum + l.remaining, 0);

  // Can only use loss up to gross income
  const lossCarryforwardUsed = Math.min(availableLoss, Math.max(0, grossTotalIncome));

  // Update loss carryforward usage
  let remainingLossToUse = lossCarryforwardUsed;
  for (const loss of lossCarryforward) {
    if (!loss.isExpired && loss.remaining > 0 && remainingLossToUse > 0) {
      const useAmount = Math.min(loss.remaining, remainingLossToUse);
      loss.usedThisYear = useAmount;
      loss.remaining -= useAmount;
      remainingLossToUse -= useAmount;
    }
  }

  // Part F: Net income
  const totalNetIncome = Math.max(0, grossTotalIncome - lossCarryforwardUsed);

  // Part G: PTKP
  const ptkpAmount = getPTKPAmount(ptkpStatus);

  // Part H: Taxable income (PKP)
  const taxableIncome = Math.max(0, totalNetIncome - ptkpAmount);

  // Part I: Tax calculation
  const taxDue = calculateProgressiveTax(taxableIncome);

  // Calculate tax on foreign income for PPh 24 limit
  const foreignIncomeTotal = otherIncome.foreignIncome?.reduce(
    (sum, fi) => sum + fi.grossIncomeInIDR,
    0
  ) || 0;
  const taxOnForeignIncome =
    foreignIncomeTotal > 0 && taxableIncome > 0
      ? Math.round((foreignIncomeTotal / taxableIncome) * taxDue)
      : 0;

  const totalTaxBeforeCredits = taxDue;

  // Part J: Calculate tax credits with PPh 24 limit
  const foreignTaxPaid = otherIncome.foreignIncome?.reduce(
    (sum, fi) => sum + fi.foreignTaxPaidInIDR,
    0
  ) || 0;
  const pph24Limit = taxOnForeignIncome;
  const pph24Credit = Math.min(taxCredits.pph24ForeignTaxCredit, pph24Limit);

  // Update tax credits with calculated limit
  taxCredits.pph24Limit = pph24Limit;

  const totalTaxCredits =
    taxCredits.pph21Withheld +
    taxCredits.pph22Withheld +
    taxCredits.pph23Withheld +
    pph24Credit +
    taxCredits.pph25Installments +
    taxCredits.stpPayments +
    taxCredits.skpkbPayments +
    taxCredits.fiscalExitTaxCredit;

  taxCredits.totalTaxCredits = totalTaxCredits;

  // Part K: Tax payable/refund
  const { status, taxPayable, taxRefund } = calculateTaxStatus(
    totalTaxBeforeCredits,
    totalTaxCredits
  );

  // Part L: PPh 25 for next year
  // Based on net tax due, divided by 12 months
  const pph25NextYear = Math.max(0, taxDue - taxCredits.pph21Withheld);
  const pph25MonthlyInstallment = Math.round(pph25NextYear / 12);

  // Tax breakdown
  const taxBreakdown = generateTaxBreakdown(taxableIncome);

  // Current year loss (if negative)
  const currentYearLoss = grossTotalIncome < 0 ? Math.abs(grossTotalIncome) : 0;

  return {
    totalBusinessRevenue,
    totalBusinessCOGS,
    totalBusinessExpenses,
    totalBusinessDepreciation,
    totalNetBusinessIncome,
    totalEmploymentIncome,
    totalOtherIncome,
    grossTotalIncome,
    lossCarryforwardUsed,
    totalNetIncome,
    ptkpAmount,
    taxableIncome,
    taxDue,
    taxOnForeignIncome,
    totalTaxBeforeCredits,
    totalTaxCredits,
    taxPayable,
    taxRefund,
    status,
    pph25NextYear,
    pph25MonthlyInstallment,
    taxBreakdown,
    currentYearLoss,
  };
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

function normalizeOtherIncome(
  input?: Partial<SPT1770OtherIncome>
): SPT1770OtherIncome {
  const otherIncome: SPT1770OtherIncome = {
    interestIncome: input?.interestIncome || 0,
    dividendIncome: input?.dividendIncome || 0,
    royaltyIncome: input?.royaltyIncome || 0,
    rentalIncome: input?.rentalIncome || 0,
    capitalGains: input?.capitalGains || 0,
    prizeIncome: input?.prizeIncome || 0,
    otherIncome: input?.otherIncome || 0,
    foreignIncome: input?.foreignIncome || [],
    totalOtherIncome: 0,
  };

  const foreignTotal = (otherIncome.foreignIncome || []).reduce(
    (sum, fi) => sum + fi.grossIncomeInIDR,
    0
  );

  otherIncome.totalOtherIncome =
    otherIncome.interestIncome +
    otherIncome.dividendIncome +
    otherIncome.royaltyIncome +
    otherIncome.rentalIncome +
    otherIncome.capitalGains +
    otherIncome.prizeIncome +
    otherIncome.otherIncome +
    foreignTotal;

  return otherIncome;
}

function normalizeFinalTaxIncome(
  input?: Partial<SPT1770FinalTaxIncome>
): SPT1770FinalTaxIncome {
  const income: SPT1770FinalTaxIncome = {
    bankInterest: input?.bankInterest || 0,
    depositInterest: input?.depositInterest || 0,
    bondInterest: input?.bondInterest || 0,
    stockDividends: input?.stockDividends || 0,
    propertyRental: input?.propertyRental || 0,
    landBuildingSale: input?.landBuildingSale || 0,
    constructionServices: input?.constructionServices || 0,
    umkmRevenue: input?.umkmRevenue || 0,
    umkmTax: input?.umkmTax || 0,
    lotteryPrizes: input?.lotteryPrizes || 0,
    otherFinalIncome: input?.otherFinalIncome || 0,
    totalFinalIncome: 0,
    totalFinalTax: 0,
  };

  income.totalFinalIncome =
    income.bankInterest +
    income.depositInterest +
    income.bondInterest +
    income.stockDividends +
    income.propertyRental +
    income.landBuildingSale +
    income.constructionServices +
    income.umkmRevenue +
    income.lotteryPrizes +
    income.otherFinalIncome;

  // Calculate final taxes (simplified)
  income.totalFinalTax =
    (income.bankInterest + income.depositInterest) * 0.20 +
    income.bondInterest * 0.15 +
    income.stockDividends * 0.10 +
    income.propertyRental * 0.10 +
    income.landBuildingSale * 0.025 +
    income.constructionServices * 0.03 +
    income.umkmTax +
    income.lotteryPrizes * 0.25;

  return income;
}

function normalizeNonTaxableIncome(
  input?: Partial<SPT1770NonTaxableIncome>
): SPT1770NonTaxableIncome {
  const income: SPT1770NonTaxableIncome = {
    lifeInsuranceProceeds: input?.lifeInsuranceProceeds || 0,
    healthInsuranceReimbursement: input?.healthInsuranceReimbursement || 0,
    inheritance: input?.inheritance || 0,
    familyGifts: input?.familyGifts || 0,
    governmentAssistance: input?.governmentAssistance || 0,
    scholarships: input?.scholarships || 0,
    otherNonTaxable: input?.otherNonTaxable || 0,
    totalNonTaxableIncome: 0,
  };

  income.totalNonTaxableIncome =
    income.lifeInsuranceProceeds +
    income.healthInsuranceReimbursement +
    income.inheritance +
    income.familyGifts +
    income.governmentAssistance +
    income.scholarships +
    income.otherNonTaxable;

  return income;
}

function normalizeTaxCredits(
  input?: Partial<SPT1770TaxCredits>,
  employmentIncome?: IncomeSource1721A1[]
): SPT1770TaxCredits {
  const pph21FromEmployment =
    employmentIncome?.reduce((sum, e) => sum + e.taxWithheld, 0) || 0;

  return {
    pph21Withheld: input?.pph21Withheld ?? pph21FromEmployment,
    pph22Withheld: input?.pph22Withheld || 0,
    pph23Withheld: input?.pph23Withheld || 0,
    pph24ForeignTaxCredit: input?.pph24ForeignTaxCredit || 0,
    pph24Limit: 0,
    pph25Installments: input?.pph25Installments || 0,
    stpPayments: input?.stpPayments || 0,
    skpkbPayments: input?.skpkbPayments || 0,
    fiscalExitTaxCredit: input?.fiscalExitTaxCredit || 0,
    totalTaxCredits: 0,
  };
}

function processLossCarryforward(
  losses: SPT1770LossCarryforward[],
  taxYear: number
): SPT1770LossCarryforward[] {
  return losses.map((loss) => ({
    ...loss,
    expiryYear: loss.taxYear + LOSS_CARRYFORWARD.INDIVIDUAL_YEARS,
    isExpired: taxYear > loss.taxYear + LOSS_CARRYFORWARD.INDIVIDUAL_YEARS,
    usedThisYear: 0,
  }));
}

function generateTaxBreakdown(taxableIncome: number): TaxBracketBreakdown[] {
  const details = getTaxBracketDetails(taxableIncome);

  let cumulativeAmount = 0;
  return details.map((d) => {
    const lowerLimit = cumulativeAmount;
    cumulativeAmount += d.amount;
    return {
      bracketNumber: d.bracket,
      lowerLimit,
      upperLimit: cumulativeAmount,
      rate: d.rate,
      taxableAmount: d.amount,
      taxAmount: d.tax,
    };
  });
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate SPT 1770 data
 */
export function validateSPT1770(data: SPT1770Data): ValidationResult {
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

  // Validate business income
  if (data.businessIncome.length === 0 && !data.employmentIncome?.length) {
    warnings.push('Tidak ada penghasilan usaha atau pekerjaan');
  }

  for (let i = 0; i < data.businessIncome.length; i++) {
    const business = data.businessIncome[i];
    if (!business.kluCode) {
      errors.push(`Usaha ${i + 1}: Kode KLU tidak boleh kosong`);
    }
    if (business.grossRevenue < 0) {
      errors.push(`Usaha ${i + 1}: Pendapatan bruto tidak boleh negatif`);
    }
    if (business.netBusinessIncome < 0) {
      warnings.push(`Usaha ${i + 1}: Usaha mengalami kerugian`);
    }
  }

  // Validate assets (required for 1770)
  if (data.assets.length === 0) {
    warnings.push('Daftar harta kosong. SPT 1770 memerlukan pelaporan harta.');
  }

  // Check for loss carryforward expiry
  for (const loss of data.lossCarryforward || []) {
    if (loss.isExpired && loss.remaining > 0) {
      warnings.push(
        `Kerugian tahun ${loss.taxYear} sebesar ${formatRupiah(loss.remaining)} sudah kadaluarsa`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  formatRupiah,
  formatNumber,
  getPTKPDescription,
  getPTKPAmount,
  calculateBusinessIncome,
  calculateMultipleBusinessIncomes,
};
