/**
 * Shared Tax Types
 *
 * Common type definitions used across SPT forms (1770 SS, 1770 S, 1770, 1771)
 */

/**
 * Taxpayer identification data
 */
export interface TaxpayerData {
  npwp: string; // XX.XXX.XXX.X-XXX.XXX
  nik: string; // 16-digit NIK
  name: string;
  address: string;
  kelurahan?: string;
  kecamatan?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  kppCode?: string; // Kantor Pelayanan Pajak code
}

/**
 * Corporate identity (for SPT 1771)
 */
export interface CorporateIdentity {
  npwp: string;
  companyName: string;
  legalName: string;
  entityType: 'PT' | 'CV' | 'FIRMA' | 'KOPERASI' | 'YAYASAN' | 'OTHER';
  registrationNumber: string;
  address: string;
  city: string;
  kluCode: string; // Klasifikasi Lapangan Usaha
  businessDescription: string;
  fiscalYearEnd: string; // 'MM-DD' format
  isAuditRequired: boolean;
  auditorName?: string;
  auditorLicense?: string;
}

/**
 * PTKP (Penghasilan Tidak Kena Pajak) Status
 * Non-taxable income status based on marital and dependent status
 */
export type PTKPStatus =
  | 'TK/0' // Tidak Kawin / 0 tanggungan
  | 'TK/1' // Tidak Kawin / 1 tanggungan
  | 'TK/2' // Tidak Kawin / 2 tanggungan
  | 'TK/3' // Tidak Kawin / 3 tanggungan
  | 'K/0' // Kawin / 0 tanggungan
  | 'K/1' // Kawin / 1 tanggungan
  | 'K/2' // Kawin / 2 tanggungan
  | 'K/3' // Kawin / 3 tanggungan
  | 'K/I/0' // Kawin + Penghasilan Istri digabung / 0 tanggungan
  | 'K/I/1'
  | 'K/I/2'
  | 'K/I/3';

/**
 * Income source from Form 1721-A1 (employment income)
 */
export interface IncomeSource1721A1 {
  // Employer info
  employerNpwp: string;
  employerName: string;

  // Income period
  periodStart: string; // MM (e.g., "01")
  periodEnd: string; // MM (e.g., "12")
  taxYear: number;

  // Income amounts
  grossIncome: number; // Penghasilan Bruto
  positionCosts: number; // Biaya Jabatan (max 5% or Rp 6M/year)
  pensionContribution: number; // Iuran Pensiun
  netIncome: number; // Penghasilan Neto

  // Tax amounts
  ptkpAmount: number; // PTKP
  taxableIncome: number; // PKP (Penghasilan Kena Pajak)
  taxDue: number; // PPh Terutang
  taxWithheld: number; // PPh yang Dipotong

  // Document reference
  buktiPotongNumber?: string;
  buktiPotongDate?: string;
}

/**
 * Other income sources (for 1770 S and 1770)
 */
export interface OtherIncomeData {
  interest: number; // Bunga
  dividends: number; // Dividen
  rental: number; // Sewa
  royalties: number; // Royalti
  capitalGains: number; // Keuntungan penjualan harta
  other: number; // Penghasilan lainnya
}

/**
 * Tax credits summary
 */
export interface TaxCreditsData {
  pph21Withheld: number; // PPh 21 yang dipotong
  pph22Withheld: number; // PPh 22 yang dipungut
  pph23Withheld: number; // PPh 23 yang dipotong
  pph24Foreign: number; // PPh 24 (kredit pajak luar negeri)
  pph25Installments: number; // PPh 25 angsuran yang sudah dibayar
}

/**
 * Base tax summary (common across all SPT forms)
 */
export interface BaseTaxSummary {
  totalGrossIncome: number;
  totalDeductions: number;
  totalNetIncome: number;
  taxDue: number;
  totalTaxWithheld: number;
  taxPayable: number; // Kurang Bayar
  taxRefund: number; // Lebih Bayar
  status: TaxStatus;
}

/**
 * Tax status result
 */
export type TaxStatus = 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Asset declaration (for 1770 S, 1770)
 */
export interface AssetDeclaration {
  id: string;
  assetType: AssetType;
  description: string;
  acquisitionYear: number;
  acquisitionValue: number;
  currentValue: number;
  location?: string;
}

export type AssetType =
  | 'CASH' // Kas dan setara kas
  | 'SAVINGS' // Tabungan
  | 'DEPOSIT' // Deposito
  | 'STOCKS' // Saham
  | 'BONDS' // Obligasi
  | 'MUTUAL_FUNDS' // Reksa dana
  | 'RECEIVABLES' // Piutang
  | 'LAND' // Tanah
  | 'BUILDING' // Bangunan
  | 'VEHICLE' // Kendaraan
  | 'JEWELRY' // Perhiasan
  | 'FURNITURE' // Perabot
  | 'OTHER'; // Harta lainnya

/**
 * Liability declaration (for 1770 S, 1770)
 */
export interface LiabilityDeclaration {
  id: string;
  liabilityType: LiabilityType;
  creditor: string;
  originalAmount: number;
  outstandingAmount: number;
  interestRate?: number;
}

export type LiabilityType =
  | 'MORTGAGE' // KPR
  | 'VEHICLE_LOAN' // Kredit kendaraan
  | 'PERSONAL_LOAN' // Kredit multiguna
  | 'BUSINESS_LOAN' // Kredit usaha
  | 'CREDIT_CARD' // Kartu kredit
  | 'OTHER'; // Utang lainnya

/**
 * Loss carryforward (for 1770, 1771)
 */
export interface LossCarryforward {
  taxYear: number;
  originalLoss: number;
  usedAmount: number;
  remainingAmount: number;
  expiryYear: number; // 5 years for individual, 10 years for corporate
}

/**
 * Business income data (for SPT 1770)
 */
export interface BusinessIncomeData {
  businessId: string;
  businessName: string;
  businessType: string;
  kluCode: string; // Klasifikasi Lapangan Usaha
  bookkeepingMethod: 'PEMBUKUAN' | 'NORMA';

  // Revenue
  grossRevenue: number;
  returnsAndAllowances: number;
  netRevenue: number;

  // Cost of goods sold (for trading businesses)
  cogs?: {
    beginningInventory: number;
    purchases: number;
    endingInventory: number;
    total: number;
  };

  // Operating expenses
  operatingExpenses: BusinessExpenses;

  // Depreciation
  depreciation: DepreciationData[];

  // Net income
  netBusinessIncome: number;
}

/**
 * Business expenses breakdown
 */
export interface BusinessExpenses {
  salaries: number; // Gaji dan upah
  rent: number; // Sewa
  utilities: number; // Listrik, air, telepon
  supplies: number; // Perlengkapan
  insurance: number; // Asuransi
  repairs: number; // Pemeliharaan
  travel: number; // Perjalanan
  advertising: number; // Iklan dan promosi
  professional: number; // Jasa profesional
  other: number; // Biaya lainnya
  total: number;
}

/**
 * Depreciation data for assets
 */
export interface DepreciationData {
  assetId: string;
  assetName: string;
  assetCategory: DepreciationCategory;
  acquisitionDate: Date;
  acquisitionCost: number;
  usefulLife: number; // years
  depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  accumulatedDepreciation: number;
  currentYearDepreciation: number;
  bookValue: number;
}

export type DepreciationCategory =
  | 'GROUP_1' // 4 years (computers, office equipment)
  | 'GROUP_2' // 8 years (vehicles, furniture)
  | 'GROUP_3' // 16 years (machinery)
  | 'GROUP_4' // 20 years (heavy equipment)
  | 'BUILDING_PERMANENT' // 20 years
  | 'BUILDING_NON_PERMANENT'; // 10 years

/**
 * Fiscal adjustment data (for SPT 1771)
 */
export interface FiscalAdjustmentData {
  // Positive adjustments (increase taxable income)
  positiveAdjustments: {
    nonDeductibleExpenses: number;
    excessDepreciation: number;
    provisionsNotAllowed: number;
    donationsNotAllowed: number;
    penaltiesAndFines: number;
    relatedPartyAdjustments: number;
    other: number;
  };

  // Negative adjustments (decrease taxable income)
  negativeAdjustments: {
    taxExemptIncome: number;
    finalTaxedIncome: number;
    acceleratedDepreciation: number;
    researchCredit: number;
    other: number;
  };

  totalPositive: number;
  totalNegative: number;
  netAdjustment: number;
}

/**
 * Related party transaction (for SPT 1771)
 */
export interface RelatedPartyTransaction {
  transactionId: string;
  relatedPartyName: string;
  relatedPartyNpwp: string;
  relationshipType: string;
  transactionType: string;
  transactionValue: number;
  armLengthValue?: number;
  adjustmentAmount?: number;
}
