/**
 * SPT 1770 Types
 *
 * Data types for Indonesian annual tax return (SPT Tahunan 1770)
 * For individual taxpayers with:
 * - Business income (penghasilan dari usaha)
 * - Freelance/professional income (pekerjaan bebas)
 * - Combined employment and business income
 *
 * This is the most comprehensive individual tax form.
 */

// Re-export shared types
export type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  OtherIncomeData,
  TaxCreditsData,
  AssetDeclaration,
  LiabilityDeclaration,
  ValidationResult,
  TaxStatus,
  BusinessIncomeData,
  BusinessExpenses,
  DepreciationData,
  DepreciationCategory,
  LossCarryforward,
} from '../shared/types';

// Re-export shared constants
export { PTKP_RATES, TAX_BRACKETS, DEPRECIATION_RATES, LOSS_CARRYFORWARD } from '../shared/constants';

// Import types for local use
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  AssetDeclaration,
  LiabilityDeclaration,
  TaxStatus,
  DepreciationCategory,
} from '../shared/types';

/**
 * SPT 1770 main form data
 */
export interface SPT1770Data {
  // Form metadata
  taxYear: number;
  correctionNumber: number; // 0 = Normal, 1+ = Pembetulan ke-N
  submissionDate: Date;

  // Taxpayer info
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;

  // Part I: Business/Professional Income (Lampiran I)
  businessIncome: SPT1770BusinessIncome[];

  // Part II: Employment Income (from 1721-A1)
  employmentIncome?: IncomeSource1721A1[];

  // Part III: Other Income
  otherIncome?: SPT1770OtherIncome;

  // Part IV: Income subject to final tax
  finalTaxIncome?: SPT1770FinalTaxIncome;

  // Part V: Non-taxable income
  nonTaxableIncome?: SPT1770NonTaxableIncome;

  // Loss carryforward from previous years
  lossCarryforward?: SPT1770LossCarryforward[];

  // Tax credits
  taxCredits: SPT1770TaxCredits;

  // Summary
  summary: SPT1770Summary;

  // Asset and liability declarations (required for 1770)
  assets: AssetDeclaration[];
  liabilities: LiabilityDeclaration[];

  // Family members (for PTKP verification)
  familyMembers?: FamilyMember[];
}

/**
 * Business/Professional income for SPT 1770
 */
export interface SPT1770BusinessIncome {
  // Business identification
  businessId: string;
  businessName: string;
  businessType: BusinessType;
  kluCode: string; // Klasifikasi Lapangan Usaha (5 digits)
  kluDescription?: string;

  // Bookkeeping method
  bookkeepingMethod: BookkeepingMethod;

  // For Norma method - deemed profit percentage
  normaPercentage?: number;

  // Revenue
  grossRevenue: number;
  returnsAndAllowances: number;
  netRevenue: number;

  // Cost of Goods Sold (for trading/manufacturing)
  cogs?: COGSData;

  // Gross profit
  grossProfit: number;

  // Operating expenses (for Pembukuan method)
  operatingExpenses?: SPT1770OperatingExpenses;

  // Depreciation
  depreciation?: SPT1770DepreciationItem[];
  totalDepreciation: number;

  // Net business income
  netBusinessIncome: number;

  // Period
  periodStart: string; // MM
  periodEnd: string; // MM
}

/**
 * Business type classification
 */
export type BusinessType =
  | 'TRADING' // Perdagangan
  | 'MANUFACTURING' // Industri/Manufaktur
  | 'SERVICES' // Jasa
  | 'PROFESSION' // Pekerjaan Bebas (dokter, pengacara, dll)
  | 'AGRICULTURE' // Pertanian
  | 'CONSTRUCTION' // Konstruksi
  | 'OTHER';

/**
 * Bookkeeping method
 */
export type BookkeepingMethod =
  | 'PEMBUKUAN' // Full bookkeeping (required if revenue > 4.8B)
  | 'NORMA'; // Deemed profit method (simplified)

/**
 * Cost of Goods Sold breakdown
 */
export interface COGSData {
  beginningInventory: number;
  purchases: number;
  freightIn: number;
  purchaseReturns: number;
  purchaseDiscounts: number;
  netPurchases: number;
  goodsAvailable: number;
  endingInventory: number;
  costOfGoodsSold: number;
}

/**
 * Operating expenses breakdown for Pembukuan method
 */
export interface SPT1770OperatingExpenses {
  // Salaries and wages
  salaries: number;
  employeeBenefits: number;
  bonuses: number;

  // Facility costs
  rent: number;
  utilities: number; // Listrik, air, telepon
  insurance: number;
  repairs: number;

  // Operational
  supplies: number;
  travel: number;
  transportation: number;
  entertainment: number;
  advertising: number;

  // Professional services
  professionalFees: number;
  bankCharges: number;

  // Other deductible expenses
  otherExpenses: number;

  // Non-deductible expenses (for reference, not subtracted)
  nonDeductibleExpenses?: {
    personalExpenses: number;
    finesAndPenalties: number;
    donations: number; // Non-qualifying donations
    other: number;
  };

  // Total deductible expenses
  totalExpenses: number;
}

/**
 * Depreciation item for assets
 */
export interface SPT1770DepreciationItem {
  assetId: string;
  assetName: string;
  assetCategory: DepreciationCategory;
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionCost: number;
  usefulLife: number; // years
  depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';

  // Calculated values
  annualDepreciationRate: number;
  priorDepreciation: number;
  currentYearDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

/**
 * Other income (not from business/employment)
 */
export interface SPT1770OtherIncome {
  // Capital income
  interestIncome: number; // Bunga (non-final)
  dividendIncome: number; // Dividen
  royaltyIncome: number; // Royalti

  // Property income
  rentalIncome: number; // Sewa (non-final)
  capitalGains: number; // Keuntungan penjualan harta

  // Other
  prizeIncome: number; // Hadiah
  otherIncome: number;

  // Foreign income
  foreignIncome?: ForeignIncomeItem[];

  // Total
  totalOtherIncome: number;
}

/**
 * Foreign income item
 */
export interface ForeignIncomeItem {
  countryCode: string;
  countryName: string;
  incomeType: string;
  grossIncomeInForeignCurrency: number;
  foreignCurrency: string;
  exchangeRate: number;
  grossIncomeInIDR: number;
  foreignTaxPaid: number;
  foreignTaxPaidInIDR: number;
}

/**
 * Income subject to final tax (reported for information only)
 */
export interface SPT1770FinalTaxIncome {
  // Financial income (PPh 4(2))
  bankInterest: number;
  depositInterest: number;
  bondInterest: number;

  // Investment income
  stockDividends: number; // Listed company dividends

  // Property
  propertyRental: number;
  landBuildingSale: number;
  constructionServices: number;

  // UMKM (PP 23/2018 - 0.5% final tax)
  umkmRevenue: number;
  umkmTax: number;

  // Lottery/prizes
  lotteryPrizes: number;

  // Other final tax income
  otherFinalIncome: number;

  // Total (for reporting)
  totalFinalIncome: number;
  totalFinalTax: number;
}

/**
 * Non-taxable income (not subject to income tax)
 */
export interface SPT1770NonTaxableIncome {
  // Insurance proceeds
  lifeInsuranceProceeds: number;
  healthInsuranceReimbursement: number;

  // Inheritance
  inheritance: number;

  // Gifts (from family)
  familyGifts: number;

  // Government assistance
  governmentAssistance: number;

  // Scholarship
  scholarships: number;

  // Other
  otherNonTaxable: number;

  // Total
  totalNonTaxableIncome: number;
}

/**
 * Loss carryforward from previous years
 */
export interface SPT1770LossCarryforward {
  taxYear: number;
  originalLoss: number;
  previouslyUsed: number;
  usedThisYear: number;
  remaining: number;
  expiryYear: number; // Original year + 5
  isExpired: boolean;
}

/**
 * Tax credits for SPT 1770
 */
export interface SPT1770TaxCredits {
  // Employment withholding
  pph21Withheld: number;

  // Import duties
  pph22Withheld: number;

  // Service withholding
  pph23Withheld: number;

  // Foreign tax credit (limited)
  pph24ForeignTaxCredit: number;
  pph24Limit: number; // Calculated limit

  // Installments paid
  pph25Installments: number;

  // Tax assessment payments
  stpPayments: number;
  skpkbPayments: number; // Surat Ketetapan Pajak Kurang Bayar

  // Fiscal exit tax credit
  fiscalExitTaxCredit: number;

  // Total
  totalTaxCredits: number;
}

/**
 * SPT 1770 calculation summary
 */
export interface SPT1770Summary {
  // Part A: Business income
  totalBusinessRevenue: number;
  totalBusinessCOGS: number;
  totalBusinessExpenses: number;
  totalBusinessDepreciation: number;
  totalNetBusinessIncome: number;

  // Part B: Employment income
  totalEmploymentIncome: number;

  // Part C: Other income
  totalOtherIncome: number;

  // Part D: Gross total income
  grossTotalIncome: number;

  // Part E: Loss carryforward used
  lossCarryforwardUsed: number;

  // Part F: Net income
  totalNetIncome: number;

  // Part G: PTKP
  ptkpAmount: number;

  // Part H: Taxable income (PKP)
  taxableIncome: number;

  // Part I: Tax calculation
  taxDue: number;
  taxOnForeignIncome: number;
  totalTaxBeforeCredits: number;

  // Part J: Tax credits
  totalTaxCredits: number;

  // Part K: Tax payable/refund
  taxPayable: number;
  taxRefund: number;
  status: TaxStatus;

  // Part L: PPh 25 installments for next year
  pph25NextYear: number;
  pph25MonthlyInstallment: number;

  // Tax breakdown
  taxBreakdown: TaxBracketBreakdown[];

  // Loss to carry forward (if any)
  currentYearLoss: number;
}

/**
 * Tax bracket breakdown
 */
export interface TaxBracketBreakdown {
  bracketNumber: number;
  lowerLimit: number;
  upperLimit: number;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

/**
 * Family member data
 */
export interface FamilyMember {
  name: string;
  nik: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
  birthDate: string;
  occupation?: string;
  hasOwnIncome: boolean;
  isDependant: boolean;
}

/**
 * Norma profit percentages by KLU code
 * (Simplified - actual values from PER-17/PJ/2015)
 */
export const NORMA_PERCENTAGES: Record<string, number> = {
  // Trading
  '46100': 0.15, // Wholesale trade
  '47100': 0.20, // Retail trade

  // Services
  '69100': 0.50, // Legal services
  '69200': 0.50, // Accounting services
  '86101': 0.45, // Hospital
  '86102': 0.50, // Medical practice
  '86103': 0.50, // Dental practice

  // Professional
  '71100': 0.50, // Architecture
  '71200': 0.50, // Engineering
  '74100': 0.50, // Design

  // Construction
  '41000': 0.13, // Building construction
  '42000': 0.13, // Civil engineering

  // Default
  'DEFAULT': 0.25,
};

/**
 * Get norma percentage for KLU code
 */
export function getNormaPercentage(kluCode: string): number {
  // Try exact match first
  if (NORMA_PERCENTAGES[kluCode]) {
    return NORMA_PERCENTAGES[kluCode];
  }

  // Try prefix match (first 3 digits)
  const prefix = kluCode.substring(0, 3);
  for (const [code, percentage] of Object.entries(NORMA_PERCENTAGES)) {
    if (code.startsWith(prefix)) {
      return percentage;
    }
  }

  return NORMA_PERCENTAGES['DEFAULT'];
}

/**
 * Check if UMKM final tax is applicable
 * Based on PP 23/2018 - gross revenue < 4.8B
 */
export function isUMKMEligible(grossRevenue: number): boolean {
  return grossRevenue < 4_800_000_000;
}

/**
 * Check if full bookkeeping is required
 * Required if gross revenue >= 4.8B
 */
export function isBookkeepingRequired(grossRevenue: number): boolean {
  return grossRevenue >= 4_800_000_000;
}
