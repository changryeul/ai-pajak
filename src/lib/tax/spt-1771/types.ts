/**
 * SPT 1771 Types
 *
 * Data types for Indonesian corporate annual tax return (SPT Tahunan 1771)
 * For corporate taxpayers (PT, CV, Firma, Koperasi, Yayasan, etc.)
 *
 * Key features:
 * - 22% standard corporate tax rate
 * - 11% reduced rate for SMEs (gross revenue < 50B, on portion < 4.8B)
 * - Fiscal adjustments (koreksi fiskal)
 * - 5-10 year loss carryforward
 * - Related party transaction reporting
 */

// Re-export shared types
export type {
  CorporateIdentity,
  ValidationResult,
  TaxStatus,
  DepreciationData,
  DepreciationCategory,
  LossCarryforward,
  FiscalAdjustmentData,
  RelatedPartyTransaction,
} from '../shared/types';

// Re-export shared constants
export {
  CORPORATE_TAX,
  DEPRECIATION_RATES,
  LOSS_CARRYFORWARD,
} from '../shared/constants';

// Import types for local use
import type {
  CorporateIdentity,
  TaxStatus,
  DepreciationCategory,
  FiscalAdjustmentData,
  RelatedPartyTransaction,
} from '../shared/types';

/**
 * SPT 1771 main form data
 */
export interface SPT1771Data {
  // Form metadata
  taxYear: number;
  fiscalYear: FiscalYearPeriod;
  correctionNumber: number;
  submissionDate: Date;

  // Corporate identity
  company: CorporateIdentity;

  // Financial statements
  incomeStatement: CorporateIncomeStatement;
  balanceSheet: CorporateBalanceSheet;

  // Fiscal adjustments
  fiscalAdjustments: SPT1771FiscalAdjustments;

  // Tax calculation
  taxCalculation: SPT1771TaxCalculation;

  // Loss carryforward
  lossCarryforward?: SPT1771LossCarryforward[];

  // Tax credits
  taxCredits: SPT1771TaxCredits;

  // Summary
  summary: SPT1771Summary;

  // Related party transactions (TP Doc requirement)
  relatedPartyTransactions?: RelatedPartyTransaction[];

  // Attachments
  attachments?: SPT1771Attachments;
}

/**
 * Fiscal year period
 */
export interface FiscalYearPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCalendarYear: boolean;
}

/**
 * Corporate income statement (Laporan Laba Rugi)
 */
export interface CorporateIncomeStatement {
  // Revenue
  grossRevenue: number;
  salesReturns: number;
  salesDiscounts: number;
  netRevenue: number;

  // Cost of Revenue
  costOfRevenue: CostOfRevenue;
  grossProfit: number;

  // Operating expenses
  operatingExpenses: CorporateOperatingExpenses;
  operatingIncome: number;

  // Other income/expenses
  otherIncome: OtherIncomeExpense;
  otherExpenses: OtherIncomeExpense;

  // Income before tax (accounting)
  incomeBeforeTax: number;

  // Tax expense (accounting - for reference)
  incomeTaxExpense: number;

  // Net income (accounting)
  netIncome: number;
}

/**
 * Cost of revenue breakdown
 */
export interface CostOfRevenue {
  rawMaterials: number;
  directLabor: number;
  manufacturingOverhead: number;
  beginningInventory: number;
  endingInventory: number;
  purchasesOfGoods: number;
  freightIn: number;
  otherDirectCosts: number;
  totalCostOfRevenue: number;
}

/**
 * Corporate operating expenses
 */
export interface CorporateOperatingExpenses {
  // Personnel
  salariesAndWages: number;
  employeeBenefits: number;
  bonusesAndIncentives: number;
  trainingAndDevelopment: number;

  // Facilities
  rentExpense: number;
  utilitiesExpense: number;
  maintenanceAndRepairs: number;
  insuranceExpense: number;
  securityExpense: number;

  // Operations
  officeSupplies: number;
  communicationExpense: number;
  travelExpense: number;
  entertainmentExpense: number;
  advertisingExpense: number;
  transportationExpense: number;

  // Professional services
  professionalFees: number;
  auditFees: number;
  legalFees: number;
  consultingFees: number;

  // Depreciation and amortization
  depreciation: number;
  amortization: number;

  // Financial
  bankCharges: number;
  badDebtExpense: number;

  // Other
  donationsAndCSR: number;
  researchAndDevelopment: number;
  otherOperatingExpenses: number;

  // Total
  totalOperatingExpenses: number;
}

/**
 * Other income/expense items
 */
export interface OtherIncomeExpense {
  interestIncome: number;
  dividendIncome: number;
  rentalIncome: number;
  gainOnAssetSale: number;
  foreignExchangeGain: number;
  otherIncome: number;
  total: number;
}

/**
 * Corporate balance sheet (simplified for tax purposes)
 */
export interface CorporateBalanceSheet {
  // Assets
  assets: {
    currentAssets: number;
    fixedAssets: number;
    accumulatedDepreciation: number;
    netFixedAssets: number;
    otherAssets: number;
    totalAssets: number;
  };

  // Liabilities
  liabilities: {
    currentLiabilities: number;
    longTermLiabilities: number;
    totalLiabilities: number;
  };

  // Equity
  equity: {
    paidInCapital: number;
    retainedEarnings: number;
    currentYearProfit: number;
    otherEquity: number;
    totalEquity: number;
  };
}

/**
 * Fiscal adjustments (Koreksi Fiskal)
 */
export interface SPT1771FiscalAdjustments {
  // Positive adjustments (increase taxable income)
  positiveAdjustments: {
    // Non-deductible expenses
    entertainmentWithoutDaftarNominatif: number;
    personalExpenses: number;
    donationsExceedingLimit: number;
    finesAndPenalties: number;
    incomeTaxExpense: number;
    reservesNotAllowed: number;

    // Depreciation differences
    excessAccountingDepreciation: number;

    // Related party adjustments
    relatedPartyAdjustments: number;

    // Other positive adjustments
    otherPositiveAdjustments: number;

    total: number;
  };

  // Negative adjustments (decrease taxable income)
  negativeAdjustments: {
    // Tax-exempt income
    dividendFromDomestic: number;
    grantFromGovernment: number;
    inheritanceIncome: number;

    // Already taxed income (final tax)
    finalTaxedIncome: number;
    bankInterestFinalTax: number;
    propertyRentalFinalTax: number;

    // Fiscal depreciation excess
    excessFiscalDepreciation: number;

    // Tax incentives
    researchDevelopmentCredit: number;
    vocationalTrainingCredit: number;

    // Other negative adjustments
    otherNegativeAdjustments: number;

    total: number;
  };

  // Net adjustment
  netAdjustment: number;
}

/**
 * Corporate tax calculation
 */
export interface SPT1771TaxCalculation {
  // Commercial income (from accounting)
  commercialIncome: number;

  // Fiscal adjustments
  totalPositiveAdjustments: number;
  totalNegativeAdjustments: number;
  netFiscalAdjustment: number;

  // Fiscal income
  fiscalIncome: number;

  // Loss carryforward
  lossCarryforwardUsed: number;

  // Taxable income
  taxableIncome: number;

  // Tax calculation
  corporateTaxRate: number;
  smeRate: number;
  smePortionLimit: number;

  // Tax amounts
  taxOnSMEPortion: number;
  taxOnRegularPortion: number;
  grossTaxDue: number;

  // Tax credits
  totalTaxCredits: number;

  // Net tax
  netTaxDue: number;
}

/**
 * Corporate loss carryforward
 */
export interface SPT1771LossCarryforward {
  taxYear: number;
  originalLoss: number;
  previouslyCompensated: number;
  compensatedThisYear: number;
  remainingLoss: number;
  expiryYear: number;
  isExpired: boolean;

  // Extended carryforward (for specific industries/locations)
  hasExtendedPeriod: boolean;
  extendedExpiryYear?: number;
  extensionReason?: string;
}

/**
 * Corporate tax credits
 */
export interface SPT1771TaxCredits {
  // Withholding taxes
  pph22Withheld: number; // Import duties
  pph23Withheld: number; // Service withholding
  pph24ForeignTaxCredit: number; // Foreign tax credit
  pph24Limit: number;

  // Installments
  pph25Installments: number;

  // Prior year overpayment
  priorYearOverpayment: number;

  // Tax assessments
  stpPayments: number;
  skpkbPayments: number;

  // Special credits
  investmentTaxCredit: number;

  // Total
  totalTaxCredits: number;
}

/**
 * SPT 1771 summary
 */
export interface SPT1771Summary {
  // Income summary
  netRevenue: number;
  grossProfit: number;
  operatingIncome: number;
  commercialIncome: number;

  // Fiscal summary
  fiscalIncome: number;
  lossCarryforwardUsed: number;
  taxableIncome: number;

  // Tax summary
  grossTaxDue: number;
  totalTaxCredits: number;
  taxPayable: number;
  taxRefund: number;
  status: TaxStatus;

  // PPh 25 for next year
  pph25NextYear: number;
  pph25MonthlyInstallment: number;

  // Effective tax rate
  effectiveTaxRate: number;

  // Loss to carry forward
  currentYearLoss: number;
}

/**
 * SPT 1771 attachments
 */
export interface SPT1771Attachments {
  // Lampiran I - Daftar Penyusutan
  depreciationSchedule?: DepreciationScheduleItem[];

  // Lampiran II - Daftar Amortisasi
  amortizationSchedule?: AmortizationScheduleItem[];

  // Lampiran III - Kredit Pajak Luar Negeri
  foreignTaxCreditDetail?: ForeignTaxCreditItem[];

  // Lampiran IV - PPh Final
  finalTaxDetail?: FinalTaxItem[];

  // Lampiran V - Daftar Pemegang Saham
  shareholderList?: ShareholderItem[];

  // Lampiran VI - Daftar Pengurus
  managementList?: ManagementItem[];

  // Lampiran Khusus - Transaksi Hubungan Istimewa
  relatedPartyDetail?: RelatedPartyTransaction[];
}

/**
 * Depreciation schedule item
 */
export interface DepreciationScheduleItem {
  assetId: string;
  assetDescription: string;
  assetCategory: DepreciationCategory;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLife: number;
  depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  priorDepreciation: number;
  currentYearDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

/**
 * Amortization schedule item
 */
export interface AmortizationScheduleItem {
  assetId: string;
  assetDescription: string;
  assetType: 'PATENT' | 'TRADEMARK' | 'COPYRIGHT' | 'FRANCHISE' | 'GOODWILL' | 'OTHER';
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLife: number;
  priorAmortization: number;
  currentYearAmortization: number;
  accumulatedAmortization: number;
  bookValue: number;
}

/**
 * Foreign tax credit item
 */
export interface ForeignTaxCreditItem {
  countryCode: string;
  countryName: string;
  incomeType: string;
  grossIncome: number;
  foreignTaxPaid: number;
  creditLimit: number;
  creditAllowed: number;
}

/**
 * Final tax item
 */
export interface FinalTaxItem {
  incomeType: string;
  grossAmount: number;
  taxRate: number;
  taxAmount: number;
}

/**
 * Shareholder item
 */
export interface ShareholderItem {
  name: string;
  npwpOrPassport: string;
  nationality: string;
  numberOfShares: number;
  percentageOwnership: number;
  paidUpCapital: number;
}

/**
 * Management item
 */
export interface ManagementItem {
  name: string;
  npwp: string;
  position: string;
  nationality: string;
}

/**
 * Corporate tax rates
 */
export const CORPORATE_TAX_RATES = {
  /** Standard corporate tax rate (22%) */
  STANDARD: 0.22,
  /** SME rate for gross revenue < 50B, on portion up to 4.8B (11%) */
  SME: 0.11,
  /** SME gross revenue threshold (Rp 50 billion) */
  SME_GROSS_THRESHOLD: 50_000_000_000,
  /** SME taxable portion limit (Rp 4.8 billion) */
  SME_PORTION_LIMIT: 4_800_000_000,
  /** UMKM final tax rate (0.5%) for gross revenue < 4.8B */
  UMKM_FINAL: 0.005,
  /** UMKM threshold */
  UMKM_THRESHOLD: 4_800_000_000,
} as const;

/**
 * Check if company qualifies for SME rate
 */
export function qualifiesForSMERate(grossRevenue: number): boolean {
  return grossRevenue < CORPORATE_TAX_RATES.SME_GROSS_THRESHOLD;
}

/**
 * Calculate SME portion limit based on gross revenue
 */
export function calculateSMEPortionLimit(
  grossRevenue: number,
  taxableIncome: number
): number {
  if (!qualifiesForSMERate(grossRevenue)) {
    return 0;
  }

  // SME portion = (4.8B / gross revenue) * taxable income
  // But cannot exceed 4.8B
  const ratio = CORPORATE_TAX_RATES.SME_PORTION_LIMIT / grossRevenue;
  return Math.min(taxableIncome * ratio, CORPORATE_TAX_RATES.SME_PORTION_LIMIT);
}

/**
 * Fiscal adjustment categories
 */
export const FISCAL_ADJUSTMENT_CATEGORIES = {
  POSITIVE: {
    ENTERTAINMENT_NO_NOMINATIF: 'Biaya entertainment tanpa daftar nominatif',
    PERSONAL_EXPENSES: 'Biaya untuk kepentingan pribadi',
    DONATIONS_EXCESS: 'Sumbangan melebihi batas',
    FINES_PENALTIES: 'Denda dan sanksi administrasi',
    INCOME_TAX_EXPENSE: 'Beban Pajak Penghasilan',
    RESERVES_NOT_ALLOWED: 'Cadangan yang tidak diperkenankan',
    EXCESS_ACCOUNTING_DEPRECIATION: 'Selisih penyusutan komersial > fiskal',
    RELATED_PARTY_ADJUSTMENT: 'Koreksi transaksi hubungan istimewa',
    OTHER: 'Koreksi positif lainnya',
  },
  NEGATIVE: {
    DIVIDEND_DOMESTIC: 'Dividen dari dalam negeri',
    GOVERNMENT_GRANT: 'Hibah dari pemerintah',
    INHERITANCE: 'Warisan',
    FINAL_TAXED_INCOME: 'Penghasilan yang telah dikenakan PPh Final',
    BANK_INTEREST_FINAL: 'Bunga deposito/tabungan (PPh Final)',
    PROPERTY_RENTAL_FINAL: 'Sewa tanah/bangunan (PPh Final)',
    EXCESS_FISCAL_DEPRECIATION: 'Selisih penyusutan fiskal > komersial',
    RND_CREDIT: 'Insentif penelitian dan pengembangan',
    VOCATIONAL_CREDIT: 'Insentif pendidikan vokasi',
    OTHER: 'Koreksi negatif lainnya',
  },
} as const;
