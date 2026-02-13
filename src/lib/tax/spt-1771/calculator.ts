/**
 * SPT 1771 Calculator
 *
 * Main calculator for Indonesian corporate annual tax return (SPT Tahunan 1771)
 *
 * Key features:
 * - 22% standard corporate tax rate
 * - 11% reduced rate for SMEs (gross revenue < 50B, on portion based on 4.8B/revenue ratio)
 * - Fiscal adjustments (koreksi fiskal)
 * - 5-10 year loss carryforward
 * - Related party transaction reporting
 */

import type { CorporateIdentity, ValidationResult, RelatedPartyTransaction } from '../shared/types';
import type {
  SPT1771Data,
  FiscalYearPeriod,
  CorporateIncomeStatement,
  CorporateBalanceSheet,
  SPT1771FiscalAdjustments,
  SPT1771TaxCalculation,
  SPT1771LossCarryforward,
  SPT1771TaxCredits,
  SPT1771Summary,
  SPT1771Attachments,
} from './types';
import {
  CORPORATE_TAX_RATES,
  qualifiesForSMERate,
  calculateSMEPortionLimit,
} from './types';
import {
  calculateFiscalAdjustments,
  FiscalAdjustmentInput,
} from './fiscal-adjustment';
import { formatRupiah, formatNumber } from '../shared/tax-utils';

// Re-export formatting utilities
export { formatRupiah, formatNumber };

/**
 * Input for calculating SPT 1771
 */
export interface SPT1771Input {
  // Company identity
  company: CorporateIdentity;

  // Tax period
  taxYear: number;
  fiscalYear: FiscalYearPeriod;
  correctionNumber?: number;
  submissionDate?: Date;

  // Financial statements
  incomeStatement: CorporateIncomeStatement;
  balanceSheet: CorporateBalanceSheet;

  // Fiscal adjustments (optional - will auto-calculate if not provided)
  fiscalAdjustments?: FiscalAdjustmentInput;

  // Loss carryforward from previous years
  lossCarryforward?: SPT1771LossCarryforward[];

  // Tax credits
  taxCredits?: Partial<SPT1771TaxCredits>;

  // Related party transactions
  relatedPartyTransactions?: RelatedPartyTransaction[];

  // Attachments
  attachments?: SPT1771Attachments;
}

/**
 * Calculate SPT 1771 from input data
 */
export function calculateSPT1771(input: SPT1771Input): SPT1771Data {
  const {
    company,
    taxYear,
    fiscalYear,
    correctionNumber = 0,
    submissionDate = new Date(),
    incomeStatement,
    balanceSheet,
    fiscalAdjustments: fiscalAdjInput,
    lossCarryforward = [],
    taxCredits: taxCreditsInput = {},
    relatedPartyTransactions = [],
    attachments,
  } = input;

  // Calculate fiscal adjustments
  const fiscalAdjustments = calculateFiscalAdjustments(
    fiscalAdjInput || detectDefaultAdjustments(incomeStatement)
  );

  // Calculate tax
  const taxCalculation = calculateCorporateTax(
    incomeStatement,
    fiscalAdjustments,
    lossCarryforward,
    taxYear
  );

  // Build tax credits
  const taxCredits = buildTaxCredits(taxCreditsInput, taxCalculation.grossTaxDue);

  // Update tax calculation with credits
  taxCalculation.totalTaxCredits = taxCredits.totalTaxCredits;
  taxCalculation.netTaxDue = Math.max(
    0,
    taxCalculation.grossTaxDue - taxCredits.totalTaxCredits
  );

  // Build summary
  const summary = buildSummary(
    incomeStatement,
    taxCalculation,
    taxCredits
  );

  return {
    taxYear,
    fiscalYear,
    correctionNumber,
    submissionDate,
    company,
    incomeStatement,
    balanceSheet,
    fiscalAdjustments,
    taxCalculation,
    lossCarryforward: updateLossCarryforward(
      lossCarryforward,
      taxCalculation.lossCarryforwardUsed,
      taxYear
    ),
    taxCredits,
    summary,
    relatedPartyTransactions:
      relatedPartyTransactions.length > 0 ? relatedPartyTransactions : undefined,
    attachments,
  };
}

/**
 * Detect default fiscal adjustments from income statement
 */
function detectDefaultAdjustments(
  incomeStatement: CorporateIncomeStatement
): FiscalAdjustmentInput {
  const adjustments: FiscalAdjustmentInput = {};

  // Income tax expense is always non-deductible
  if (incomeStatement.incomeTaxExpense > 0) {
    adjustments.incomeTaxExpense = incomeStatement.incomeTaxExpense;
  }

  // Entertainment without nominatif (assume 50%)
  if (incomeStatement.operatingExpenses.entertainmentExpense > 0) {
    adjustments.entertainmentWithoutDaftarNominatif =
      incomeStatement.operatingExpenses.entertainmentExpense * 0.5;
  }

  // Bank interest is usually final tax
  if (incomeStatement.otherIncome.interestIncome > 0) {
    adjustments.bankInterestFinalTax = incomeStatement.otherIncome.interestIncome;
  }

  // Domestic dividends may be exempt (participation exemption)
  if (incomeStatement.otherIncome.dividendIncome > 0) {
    adjustments.dividendFromDomestic = incomeStatement.otherIncome.dividendIncome;
  }

  // Rental income is usually final tax
  if (incomeStatement.otherIncome.rentalIncome > 0) {
    adjustments.propertyRentalFinalTax = incomeStatement.otherIncome.rentalIncome;
  }

  return adjustments;
}

/**
 * Calculate corporate tax
 */
function calculateCorporateTax(
  incomeStatement: CorporateIncomeStatement,
  fiscalAdjustments: SPT1771FiscalAdjustments,
  lossCarryforward: SPT1771LossCarryforward[],
  taxYear: number
): SPT1771TaxCalculation {
  // Commercial income (accounting)
  const commercialIncome = incomeStatement.incomeBeforeTax;

  // Apply fiscal adjustments
  const fiscalIncome = commercialIncome + fiscalAdjustments.netAdjustment;

  // Calculate available loss carryforward
  let lossCarryforwardUsed = 0;
  if (fiscalIncome > 0) {
    const availableLoss = lossCarryforward
      .filter((loss) => !loss.isExpired && loss.remainingLoss > 0)
      .reduce((sum, loss) => sum + loss.remainingLoss, 0);

    lossCarryforwardUsed = Math.min(availableLoss, fiscalIncome);
  }

  // Taxable income
  const taxableIncome = Math.max(0, fiscalIncome - lossCarryforwardUsed);

  // Determine tax rates
  const grossRevenue = incomeStatement.grossRevenue;
  const qualifiesForSME = qualifiesForSMERate(grossRevenue);

  // Calculate SME portion
  const smePortionLimit = qualifiesForSME
    ? calculateSMEPortionLimit(grossRevenue, taxableIncome)
    : 0;

  const regularPortion = taxableIncome - smePortionLimit;

  // Calculate tax amounts
  const taxOnSMEPortion = smePortionLimit * CORPORATE_TAX_RATES.SME;
  const taxOnRegularPortion = regularPortion * CORPORATE_TAX_RATES.STANDARD;
  const grossTaxDue = taxOnSMEPortion + taxOnRegularPortion;

  return {
    commercialIncome,
    totalPositiveAdjustments: fiscalAdjustments.positiveAdjustments.total,
    totalNegativeAdjustments: fiscalAdjustments.negativeAdjustments.total,
    netFiscalAdjustment: fiscalAdjustments.netAdjustment,
    fiscalIncome,
    lossCarryforwardUsed,
    taxableIncome,
    corporateTaxRate: CORPORATE_TAX_RATES.STANDARD,
    smeRate: CORPORATE_TAX_RATES.SME,
    smePortionLimit,
    taxOnSMEPortion,
    taxOnRegularPortion,
    grossTaxDue,
    totalTaxCredits: 0, // Will be updated
    netTaxDue: grossTaxDue, // Will be updated
  };
}

/**
 * Build tax credits object
 */
function buildTaxCredits(
  input: Partial<SPT1771TaxCredits>,
  grossTaxDue: number
): SPT1771TaxCredits {
  const pph22Withheld = input.pph22Withheld || 0;
  const pph23Withheld = input.pph23Withheld || 0;
  const pph24ForeignTaxCredit = input.pph24ForeignTaxCredit || 0;
  const pph25Installments = input.pph25Installments || 0;
  const priorYearOverpayment = input.priorYearOverpayment || 0;
  const stpPayments = input.stpPayments || 0;
  const skpkbPayments = input.skpkbPayments || 0;
  const investmentTaxCredit = input.investmentTaxCredit || 0;

  // Foreign tax credit is limited
  const pph24Limit = calculateForeignTaxCreditLimit(
    pph24ForeignTaxCredit,
    grossTaxDue
  );

  const totalTaxCredits =
    pph22Withheld +
    pph23Withheld +
    Math.min(pph24ForeignTaxCredit, pph24Limit) +
    pph25Installments +
    priorYearOverpayment +
    stpPayments +
    skpkbPayments +
    investmentTaxCredit;

  return {
    pph22Withheld,
    pph23Withheld,
    pph24ForeignTaxCredit,
    pph24Limit,
    pph25Installments,
    priorYearOverpayment,
    stpPayments,
    skpkbPayments,
    investmentTaxCredit,
    totalTaxCredits,
  };
}

/**
 * Calculate foreign tax credit limit (PPh 24)
 */
function calculateForeignTaxCreditLimit(
  foreignTaxPaid: number,
  domesticTaxDue: number
): number {
  // Foreign tax credit cannot exceed the proportion of domestic tax
  // attributable to foreign-source income
  // Simplified: limit to gross tax due
  return Math.min(foreignTaxPaid, domesticTaxDue);
}

/**
 * Update loss carryforward after compensation
 */
function updateLossCarryforward(
  lossCarryforward: SPT1771LossCarryforward[],
  usedAmount: number,
  taxYear: number
): SPT1771LossCarryforward[] {
  let remainingToUse = usedAmount;

  return lossCarryforward.map((loss) => {
    const isExpired = taxYear > loss.expiryYear;
    let compensatedThisYear = 0;

    if (!isExpired && remainingToUse > 0 && loss.remainingLoss > 0) {
      compensatedThisYear = Math.min(remainingToUse, loss.remainingLoss);
      remainingToUse -= compensatedThisYear;
    }

    return {
      ...loss,
      compensatedThisYear,
      remainingLoss: loss.remainingLoss - compensatedThisYear,
      isExpired,
    };
  });
}

/**
 * Build tax summary
 */
function buildSummary(
  incomeStatement: CorporateIncomeStatement,
  taxCalculation: SPT1771TaxCalculation,
  taxCredits: SPT1771TaxCredits
): SPT1771Summary {
  const taxDifference = taxCalculation.grossTaxDue - taxCredits.totalTaxCredits;

  const taxPayable = taxDifference > 0 ? taxDifference : 0;
  const taxRefund = taxDifference < 0 ? Math.abs(taxDifference) : 0;

  const status =
    taxDifference === 0
      ? 'NIHIL'
      : taxDifference > 0
      ? 'KURANG_BAYAR'
      : 'LEBIH_BAYAR';

  // PPh 25 for next year (simplified: based on net tax due / 12)
  const pph25NextYear = taxPayable > 0 ? taxPayable : 0;
  const pph25MonthlyInstallment = Math.ceil(pph25NextYear / 12);

  // Effective tax rate
  const effectiveTaxRate =
    incomeStatement.grossRevenue > 0
      ? taxCalculation.grossTaxDue / incomeStatement.grossRevenue
      : 0;

  // Current year loss (if fiscal income is negative)
  const currentYearLoss =
    taxCalculation.fiscalIncome < 0
      ? Math.abs(taxCalculation.fiscalIncome)
      : 0;

  return {
    netRevenue: incomeStatement.netRevenue,
    grossProfit: incomeStatement.grossProfit,
    operatingIncome: incomeStatement.operatingIncome,
    commercialIncome: taxCalculation.commercialIncome,
    fiscalIncome: taxCalculation.fiscalIncome,
    lossCarryforwardUsed: taxCalculation.lossCarryforwardUsed,
    taxableIncome: taxCalculation.taxableIncome,
    grossTaxDue: taxCalculation.grossTaxDue,
    totalTaxCredits: taxCredits.totalTaxCredits,
    taxPayable,
    taxRefund,
    status,
    pph25NextYear,
    pph25MonthlyInstallment,
    effectiveTaxRate,
    currentYearLoss,
  };
}

/**
 * Validate SPT 1771 data
 */
export function validateSPT1771(data: SPT1771Data): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate company identity
  if (!data.company.npwp) {
    errors.push('Company NPWP is required');
  }
  if (!data.company.companyName) {
    errors.push('Company name is required');
  }
  if (!data.company.kluCode) {
    warnings.push('KLU code is not specified');
  }

  // Validate fiscal year
  if (!data.fiscalYear.startDate || !data.fiscalYear.endDate) {
    errors.push('Fiscal year period is required');
  }

  // Validate income statement
  const { incomeStatement } = data;
  if (incomeStatement.grossRevenue < 0) {
    errors.push('Gross revenue cannot be negative');
  }
  if (incomeStatement.netRevenue > incomeStatement.grossRevenue) {
    errors.push('Net revenue cannot exceed gross revenue');
  }

  // Validate balance sheet
  const { balanceSheet } = data;
  const assetsLiabilitiesMatch =
    Math.abs(
      balanceSheet.assets.totalAssets -
        (balanceSheet.liabilities.totalLiabilities +
          balanceSheet.equity.totalEquity)
    ) < 1; // Allow Rp 1 rounding

  if (!assetsLiabilitiesMatch) {
    errors.push('Balance sheet does not balance: Assets ≠ Liabilities + Equity');
  }

  // Validate fiscal adjustments
  if (data.fiscalAdjustments.positiveAdjustments.total < 0) {
    errors.push('Total positive adjustments cannot be negative');
  }
  if (data.fiscalAdjustments.negativeAdjustments.total < 0) {
    errors.push('Total negative adjustments cannot be negative');
  }

  // Validate tax calculation
  if (data.taxCalculation.taxableIncome < 0) {
    errors.push('Taxable income cannot be negative after loss carryforward');
  }

  // Validate loss carryforward
  if (data.lossCarryforward) {
    for (const loss of data.lossCarryforward) {
      if (loss.originalLoss < 0) {
        errors.push(`Loss carryforward for year ${loss.taxYear} has invalid amount`);
      }
      if (loss.compensatedThisYear > loss.remainingLoss + loss.compensatedThisYear) {
        errors.push(`Loss carryforward compensation exceeds available amount for year ${loss.taxYear}`);
      }
    }
  }

  // Validate tax credits
  const taxCredits = data.taxCredits;
  if (taxCredits.pph24ForeignTaxCredit > taxCredits.pph24Limit) {
    warnings.push('Foreign tax credit claimed exceeds calculated limit');
  }

  // Check for related party transactions requirement
  if (data.incomeStatement.grossRevenue >= 50_000_000_000) {
    if (!data.relatedPartyTransactions || data.relatedPartyTransactions.length === 0) {
      warnings.push(
        'Companies with gross revenue >= Rp 50 billion should report related party transactions'
      );
    }
  }

  // Check audit requirement
  if (
    data.company.isAuditRequired &&
    (!data.company.auditorName || !data.company.auditorLicense)
  ) {
    errors.push('Audit is required but auditor information is missing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create an empty income statement template
 */
export function createEmptyIncomeStatement(): CorporateIncomeStatement {
  return {
    grossRevenue: 0,
    salesReturns: 0,
    salesDiscounts: 0,
    netRevenue: 0,
    costOfRevenue: {
      rawMaterials: 0,
      directLabor: 0,
      manufacturingOverhead: 0,
      beginningInventory: 0,
      endingInventory: 0,
      purchasesOfGoods: 0,
      freightIn: 0,
      otherDirectCosts: 0,
      totalCostOfRevenue: 0,
    },
    grossProfit: 0,
    operatingExpenses: {
      salariesAndWages: 0,
      employeeBenefits: 0,
      bonusesAndIncentives: 0,
      trainingAndDevelopment: 0,
      rentExpense: 0,
      utilitiesExpense: 0,
      maintenanceAndRepairs: 0,
      insuranceExpense: 0,
      securityExpense: 0,
      officeSupplies: 0,
      communicationExpense: 0,
      travelExpense: 0,
      entertainmentExpense: 0,
      advertisingExpense: 0,
      transportationExpense: 0,
      professionalFees: 0,
      auditFees: 0,
      legalFees: 0,
      consultingFees: 0,
      depreciation: 0,
      amortization: 0,
      bankCharges: 0,
      badDebtExpense: 0,
      donationsAndCSR: 0,
      researchAndDevelopment: 0,
      otherOperatingExpenses: 0,
      totalOperatingExpenses: 0,
    },
    operatingIncome: 0,
    otherIncome: {
      interestIncome: 0,
      dividendIncome: 0,
      rentalIncome: 0,
      gainOnAssetSale: 0,
      foreignExchangeGain: 0,
      otherIncome: 0,
      total: 0,
    },
    otherExpenses: {
      interestIncome: 0,
      dividendIncome: 0,
      rentalIncome: 0,
      gainOnAssetSale: 0,
      foreignExchangeGain: 0,
      otherIncome: 0,
      total: 0,
    },
    incomeBeforeTax: 0,
    incomeTaxExpense: 0,
    netIncome: 0,
  };
}

/**
 * Create an empty balance sheet template
 */
export function createEmptyBalanceSheet(): CorporateBalanceSheet {
  return {
    assets: {
      currentAssets: 0,
      fixedAssets: 0,
      accumulatedDepreciation: 0,
      netFixedAssets: 0,
      otherAssets: 0,
      totalAssets: 0,
    },
    liabilities: {
      currentLiabilities: 0,
      longTermLiabilities: 0,
      totalLiabilities: 0,
    },
    equity: {
      paidInCapital: 0,
      retainedEarnings: 0,
      currentYearProfit: 0,
      otherEquity: 0,
      totalEquity: 0,
    },
  };
}

/**
 * Calculate income statement totals from line items
 */
export function calculateIncomeStatementTotals(
  incomeStatement: Partial<CorporateIncomeStatement>
): CorporateIncomeStatement {
  const stmt = { ...createEmptyIncomeStatement(), ...incomeStatement };

  // Net revenue
  stmt.netRevenue = stmt.grossRevenue - stmt.salesReturns - stmt.salesDiscounts;

  // Cost of revenue total
  const cor = stmt.costOfRevenue;
  cor.totalCostOfRevenue =
    cor.beginningInventory +
    cor.rawMaterials +
    cor.directLabor +
    cor.manufacturingOverhead +
    cor.purchasesOfGoods +
    cor.freightIn +
    cor.otherDirectCosts -
    cor.endingInventory;

  // Gross profit
  stmt.grossProfit = stmt.netRevenue - cor.totalCostOfRevenue;

  // Operating expenses total
  const opex = stmt.operatingExpenses;
  opex.totalOperatingExpenses =
    opex.salariesAndWages +
    opex.employeeBenefits +
    opex.bonusesAndIncentives +
    opex.trainingAndDevelopment +
    opex.rentExpense +
    opex.utilitiesExpense +
    opex.maintenanceAndRepairs +
    opex.insuranceExpense +
    opex.securityExpense +
    opex.officeSupplies +
    opex.communicationExpense +
    opex.travelExpense +
    opex.entertainmentExpense +
    opex.advertisingExpense +
    opex.transportationExpense +
    opex.professionalFees +
    opex.auditFees +
    opex.legalFees +
    opex.consultingFees +
    opex.depreciation +
    opex.amortization +
    opex.bankCharges +
    opex.badDebtExpense +
    opex.donationsAndCSR +
    opex.researchAndDevelopment +
    opex.otherOperatingExpenses;

  // Operating income
  stmt.operatingIncome = stmt.grossProfit - opex.totalOperatingExpenses;

  // Other income total
  const otherInc = stmt.otherIncome;
  otherInc.total =
    otherInc.interestIncome +
    otherInc.dividendIncome +
    otherInc.rentalIncome +
    otherInc.gainOnAssetSale +
    otherInc.foreignExchangeGain +
    otherInc.otherIncome;

  // Other expenses total
  const otherExp = stmt.otherExpenses;
  otherExp.total =
    otherExp.interestIncome + // Represents interest expense
    otherExp.dividendIncome + // Represents dividend expense (rare)
    otherExp.rentalIncome + // Represents rental expense
    otherExp.gainOnAssetSale + // Represents loss on asset sale
    otherExp.foreignExchangeGain + // Represents forex loss
    otherExp.otherIncome; // Represents other expenses

  // Income before tax
  stmt.incomeBeforeTax =
    stmt.operatingIncome + otherInc.total - otherExp.total;

  // Net income (accounting)
  stmt.netIncome = stmt.incomeBeforeTax - stmt.incomeTaxExpense;

  return stmt;
}

/**
 * Check if company needs audit
 */
export function isAuditRequired(
  grossRevenue: number,
  totalAssets: number
): boolean {
  // Simplified: PT Tbk and certain thresholds require audit
  // This is a simplified check - actual rules are more complex
  const REVENUE_THRESHOLD = 50_000_000_000; // Rp 50 billion
  const ASSET_THRESHOLD = 100_000_000_000; // Rp 100 billion

  return grossRevenue >= REVENUE_THRESHOLD || totalAssets >= ASSET_THRESHOLD;
}

/**
 * Check if company can use UMKM final tax (PP 55)
 */
export function canUseUMKMFinalTax(grossRevenue: number): boolean {
  return grossRevenue < CORPORATE_TAX_RATES.UMKM_THRESHOLD;
}

/**
 * Calculate UMKM final tax (0.5% of gross revenue)
 */
export function calculateUMKMFinalTax(grossRevenue: number): number {
  if (!canUseUMKMFinalTax(grossRevenue)) {
    return 0;
  }
  return grossRevenue * CORPORATE_TAX_RATES.UMKM_FINAL;
}
