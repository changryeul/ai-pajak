/**
 * SPT 1771 Fiscal Adjustment Calculator
 *
 * Calculates fiscal adjustments (koreksi fiskal) for corporate tax returns.
 * Adjustments bridge the gap between accounting (commercial) income and
 * taxable (fiscal) income.
 *
 * Positive adjustments: Increase taxable income (non-deductible expenses)
 * Negative adjustments: Decrease taxable income (exempt/final-taxed income)
 */

import type {
  SPT1771FiscalAdjustments,
  CorporateIncomeStatement,
} from './types';

/**
 * Individual fiscal adjustment item
 */
export interface FiscalAdjustmentItem {
  type: string;
  amount: number;
  adjustmentType: 'POSITIVE' | 'NEGATIVE';
  description?: string;
}

/**
 * Input for calculating fiscal adjustments
 */
export interface FiscalAdjustmentInput {
  // Non-deductible expenses (Positive adjustments)
  entertainmentWithoutDaftarNominatif?: number;
  personalExpenses?: number;
  donationsExceedingLimit?: number;
  finesAndPenalties?: number;
  incomeTaxExpense?: number;
  reservesNotAllowed?: number;
  excessAccountingDepreciation?: number;
  relatedPartyAdjustments?: number;
  otherPositiveAdjustments?: number;

  // Tax-exempt income (Negative adjustments)
  dividendFromDomestic?: number;
  grantFromGovernment?: number;
  inheritanceIncome?: number;

  // Final-taxed income (Negative adjustments)
  finalTaxedIncome?: number;
  bankInterestFinalTax?: number;
  propertyRentalFinalTax?: number;

  // Fiscal depreciation excess
  excessFiscalDepreciation?: number;

  // Tax incentives
  researchDevelopmentCredit?: number;
  vocationalTrainingCredit?: number;

  // Other
  otherNegativeAdjustments?: number;
}

/**
 * Calculate fiscal adjustments from input
 */
export function calculateFiscalAdjustments(
  input: FiscalAdjustmentInput
): SPT1771FiscalAdjustments {
  // Calculate positive adjustments
  const positiveAdjustments = {
    entertainmentWithoutDaftarNominatif:
      input.entertainmentWithoutDaftarNominatif || 0,
    personalExpenses: input.personalExpenses || 0,
    donationsExceedingLimit: input.donationsExceedingLimit || 0,
    finesAndPenalties: input.finesAndPenalties || 0,
    incomeTaxExpense: input.incomeTaxExpense || 0,
    reservesNotAllowed: input.reservesNotAllowed || 0,
    excessAccountingDepreciation: input.excessAccountingDepreciation || 0,
    relatedPartyAdjustments: input.relatedPartyAdjustments || 0,
    otherPositiveAdjustments: input.otherPositiveAdjustments || 0,
    total: 0,
  };

  positiveAdjustments.total =
    positiveAdjustments.entertainmentWithoutDaftarNominatif +
    positiveAdjustments.personalExpenses +
    positiveAdjustments.donationsExceedingLimit +
    positiveAdjustments.finesAndPenalties +
    positiveAdjustments.incomeTaxExpense +
    positiveAdjustments.reservesNotAllowed +
    positiveAdjustments.excessAccountingDepreciation +
    positiveAdjustments.relatedPartyAdjustments +
    positiveAdjustments.otherPositiveAdjustments;

  // Calculate negative adjustments
  const negativeAdjustments = {
    dividendFromDomestic: input.dividendFromDomestic || 0,
    grantFromGovernment: input.grantFromGovernment || 0,
    inheritanceIncome: input.inheritanceIncome || 0,
    finalTaxedIncome: input.finalTaxedIncome || 0,
    bankInterestFinalTax: input.bankInterestFinalTax || 0,
    propertyRentalFinalTax: input.propertyRentalFinalTax || 0,
    excessFiscalDepreciation: input.excessFiscalDepreciation || 0,
    researchDevelopmentCredit: input.researchDevelopmentCredit || 0,
    vocationalTrainingCredit: input.vocationalTrainingCredit || 0,
    otherNegativeAdjustments: input.otherNegativeAdjustments || 0,
    total: 0,
  };

  negativeAdjustments.total =
    negativeAdjustments.dividendFromDomestic +
    negativeAdjustments.grantFromGovernment +
    negativeAdjustments.inheritanceIncome +
    negativeAdjustments.finalTaxedIncome +
    negativeAdjustments.bankInterestFinalTax +
    negativeAdjustments.propertyRentalFinalTax +
    negativeAdjustments.excessFiscalDepreciation +
    negativeAdjustments.researchDevelopmentCredit +
    negativeAdjustments.vocationalTrainingCredit +
    negativeAdjustments.otherNegativeAdjustments;

  // Net adjustment (positive - negative)
  const netAdjustment =
    positiveAdjustments.total - negativeAdjustments.total;

  return {
    positiveAdjustments,
    negativeAdjustments,
    netAdjustment,
  };
}

/**
 * Auto-detect fiscal adjustments from income statement
 * This helps identify common adjustment items automatically
 */
export function detectFiscalAdjustments(
  incomeStatement: CorporateIncomeStatement
): FiscalAdjustmentInput {
  const detected: FiscalAdjustmentInput = {};

  // Income tax expense is always a positive adjustment
  if (incomeStatement.incomeTaxExpense > 0) {
    detected.incomeTaxExpense = incomeStatement.incomeTaxExpense;
  }

  // Entertainment expense may need adjustment (assume 50% without nominatif)
  if (incomeStatement.operatingExpenses.entertainmentExpense > 0) {
    detected.entertainmentWithoutDaftarNominatif =
      incomeStatement.operatingExpenses.entertainmentExpense * 0.5;
  }

  // Donations may exceed limit (assume 5% of fiscal income limit)
  // This is a rough estimate - actual limit depends on fiscal income
  if (incomeStatement.operatingExpenses.donationsAndCSR > 0) {
    // Rough estimate: excess = donations - 5% of income before tax
    const limit = incomeStatement.incomeBeforeTax * 0.05;
    const excess =
      incomeStatement.operatingExpenses.donationsAndCSR - limit;
    if (excess > 0) {
      detected.donationsExceedingLimit = excess;
    }
  }

  // Interest income from bank deposits is usually final tax
  if (incomeStatement.otherIncome.interestIncome > 0) {
    detected.bankInterestFinalTax = incomeStatement.otherIncome.interestIncome;
  }

  // Dividend income from domestic companies may be exempt
  if (incomeStatement.otherIncome.dividendIncome > 0) {
    detected.dividendFromDomestic = incomeStatement.otherIncome.dividendIncome;
  }

  // Rental income is usually subject to final tax
  if (incomeStatement.otherIncome.rentalIncome > 0) {
    detected.propertyRentalFinalTax = incomeStatement.otherIncome.rentalIncome;
  }

  return detected;
}

/**
 * Calculate depreciation adjustment
 *
 * Positive adjustment: When accounting depreciation > fiscal depreciation
 * Negative adjustment: When fiscal depreciation > accounting depreciation
 */
export function calculateDepreciationAdjustment(
  accountingDepreciation: number,
  fiscalDepreciation: number
): { positive: number; negative: number } {
  const difference = accountingDepreciation - fiscalDepreciation;

  if (difference > 0) {
    // Accounting > Fiscal: Positive adjustment (add back)
    return { positive: difference, negative: 0 };
  } else if (difference < 0) {
    // Fiscal > Accounting: Negative adjustment (deduct)
    return { positive: 0, negative: Math.abs(difference) };
  }

  return { positive: 0, negative: 0 };
}

/**
 * Entertainment expense deductibility rules
 *
 * Entertainment expenses require a "daftar nominatif" (detailed list)
 * containing recipient information to be fully deductible.
 *
 * Without nominatif: Not deductible (positive adjustment)
 * With nominatif: Deductible up to reasonable limits
 */
export function calculateEntertainmentAdjustment(
  totalEntertainment: number,
  amountWithNominatif: number
): number {
  // Amount without nominatif is not deductible
  return Math.max(0, totalEntertainment - amountWithNominatif);
}

/**
 * Donation deductibility rules
 *
 * Donations for national disasters, R&D, education, sports development,
 * and social infrastructure development are deductible up to 5% of
 * net fiscal income.
 *
 * Other donations are not deductible.
 */
export function calculateDonationAdjustment(
  totalDonations: number,
  deductibleDonations: number,
  netFiscalIncome: number
): number {
  // Limit is 5% of net fiscal income
  const limit = netFiscalIncome * 0.05;

  // Deductible amount is lesser of deductible donations and limit
  const allowedDeduction = Math.min(deductibleDonations, limit);

  // Non-deductible amount
  return totalDonations - allowedDeduction;
}

/**
 * Convert generic fiscal adjustment items to SPT 1771 format
 */
export function convertToSPT1771Adjustments(
  adjustments: FiscalAdjustmentItem[]
): FiscalAdjustmentInput {
  const input: FiscalAdjustmentInput = {};

  for (const adj of adjustments) {
    switch (adj.type) {
      case 'ENTERTAINMENT_NO_NOMINATIF':
        input.entertainmentWithoutDaftarNominatif =
          (input.entertainmentWithoutDaftarNominatif || 0) + adj.amount;
        break;
      case 'PERSONAL_EXPENSE':
        input.personalExpenses =
          (input.personalExpenses || 0) + adj.amount;
        break;
      case 'DONATION_EXCESS':
        input.donationsExceedingLimit =
          (input.donationsExceedingLimit || 0) + adj.amount;
        break;
      case 'FINE_PENALTY':
        input.finesAndPenalties =
          (input.finesAndPenalties || 0) + adj.amount;
        break;
      case 'TAX_EXPENSE':
        input.incomeTaxExpense =
          (input.incomeTaxExpense || 0) + adj.amount;
        break;
      case 'RESERVE_NOT_ALLOWED':
        input.reservesNotAllowed =
          (input.reservesNotAllowed || 0) + adj.amount;
        break;
      case 'DEPRECIATION_DIFF_POSITIVE':
        input.excessAccountingDepreciation =
          (input.excessAccountingDepreciation || 0) + adj.amount;
        break;
      case 'DEPRECIATION_DIFF_NEGATIVE':
        input.excessFiscalDepreciation =
          (input.excessFiscalDepreciation || 0) + adj.amount;
        break;
      case 'RELATED_PARTY':
        input.relatedPartyAdjustments =
          (input.relatedPartyAdjustments || 0) + adj.amount;
        break;
      case 'DIVIDEND_DOMESTIC':
        input.dividendFromDomestic =
          (input.dividendFromDomestic || 0) + adj.amount;
        break;
      case 'FINAL_TAX_INCOME':
        input.finalTaxedIncome =
          (input.finalTaxedIncome || 0) + adj.amount;
        break;
      default:
        // Unknown types go to other adjustments
        if (adj.adjustmentType === 'POSITIVE') {
          input.otherPositiveAdjustments =
            (input.otherPositiveAdjustments || 0) + adj.amount;
        } else {
          input.otherNegativeAdjustments =
            (input.otherNegativeAdjustments || 0) + adj.amount;
        }
    }
  }

  return input;
}

/**
 * Validate fiscal adjustments
 */
export function validateFiscalAdjustments(
  adjustments: SPT1771FiscalAdjustments
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for negative values
  const checkNegative = (value: number, name: string) => {
    if (value < 0) {
      errors.push(`${name} cannot be negative`);
    }
  };

  // Check positive adjustments
  const pos = adjustments.positiveAdjustments;
  checkNegative(pos.entertainmentWithoutDaftarNominatif, 'Entertainment without nominatif');
  checkNegative(pos.personalExpenses, 'Personal expenses');
  checkNegative(pos.donationsExceedingLimit, 'Donations exceeding limit');
  checkNegative(pos.finesAndPenalties, 'Fines and penalties');
  checkNegative(pos.incomeTaxExpense, 'Income tax expense');
  checkNegative(pos.reservesNotAllowed, 'Reserves not allowed');
  checkNegative(pos.excessAccountingDepreciation, 'Excess accounting depreciation');
  checkNegative(pos.relatedPartyAdjustments, 'Related party adjustments');
  checkNegative(pos.otherPositiveAdjustments, 'Other positive adjustments');

  // Check negative adjustments
  const neg = adjustments.negativeAdjustments;
  checkNegative(neg.dividendFromDomestic, 'Dividend from domestic');
  checkNegative(neg.grantFromGovernment, 'Grant from government');
  checkNegative(neg.inheritanceIncome, 'Inheritance income');
  checkNegative(neg.finalTaxedIncome, 'Final taxed income');
  checkNegative(neg.bankInterestFinalTax, 'Bank interest final tax');
  checkNegative(neg.propertyRentalFinalTax, 'Property rental final tax');
  checkNegative(neg.excessFiscalDepreciation, 'Excess fiscal depreciation');
  checkNegative(neg.researchDevelopmentCredit, 'Research development credit');
  checkNegative(neg.vocationalTrainingCredit, 'Vocational training credit');
  checkNegative(neg.otherNegativeAdjustments, 'Other negative adjustments');

  // Verify totals
  const expectedPositiveTotal =
    pos.entertainmentWithoutDaftarNominatif +
    pos.personalExpenses +
    pos.donationsExceedingLimit +
    pos.finesAndPenalties +
    pos.incomeTaxExpense +
    pos.reservesNotAllowed +
    pos.excessAccountingDepreciation +
    pos.relatedPartyAdjustments +
    pos.otherPositiveAdjustments;

  if (Math.abs(pos.total - expectedPositiveTotal) > 0.01) {
    errors.push('Positive adjustments total does not match sum of items');
  }

  const expectedNegativeTotal =
    neg.dividendFromDomestic +
    neg.grantFromGovernment +
    neg.inheritanceIncome +
    neg.finalTaxedIncome +
    neg.bankInterestFinalTax +
    neg.propertyRentalFinalTax +
    neg.excessFiscalDepreciation +
    neg.researchDevelopmentCredit +
    neg.vocationalTrainingCredit +
    neg.otherNegativeAdjustments;

  if (Math.abs(neg.total - expectedNegativeTotal) > 0.01) {
    errors.push('Negative adjustments total does not match sum of items');
  }

  // Verify net adjustment
  const expectedNet = pos.total - neg.total;
  if (Math.abs(adjustments.netAdjustment - expectedNet) > 0.01) {
    errors.push('Net adjustment does not match difference of totals');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
