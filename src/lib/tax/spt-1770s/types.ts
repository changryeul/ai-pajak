/**
 * SPT 1770 S Types
 *
 * Data types for Indonesian annual tax return (SPT Tahunan 1770 S)
 * For individual taxpayers with:
 * - Annual gross income >= Rp 60 million, OR
 * - Multiple sources of employment income
 *
 * This form is more detailed than 1770 SS and includes:
 * - Multiple 1721-A1 income sources
 * - Other income (interest, dividends, rental, etc.)
 * - Tax credits from PPh 22, 23
 * - Asset and liability declarations (optional)
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
} from '../shared/types';

// Re-export shared constants
export { PTKP_RATES, TAX_BRACKETS } from '../shared/constants';

// Import types for local use
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  OtherIncomeData,
  TaxCreditsData,
  AssetDeclaration,
  LiabilityDeclaration,
  TaxStatus,
} from '../shared/types';

/**
 * SPT 1770 S main form data
 */
export interface SPT1770SData {
  // Form metadata
  taxYear: number;
  correctionNumber: number; // 0 = Normal, 1+ = Pembetulan ke-N
  submissionDate: Date;

  // Taxpayer info
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;

  // Employment income sources (from multiple 1721-A1)
  employmentIncome: IncomeSource1721A1[];

  // Other income (optional)
  otherIncome?: SPT1770SOtherIncome;

  // Income subject to final tax (not included in main calculation)
  finalTaxIncome?: SPT1770SFinalTaxIncome;

  // Tax credits
  taxCredits: SPT1770STaxCredits;

  // Calculated summary
  summary: SPT1770SSummary;

  // Asset and liability declarations (optional for 1770 S)
  assets?: AssetDeclaration[];
  liabilities?: LiabilityDeclaration[];

  // Spouse income information (if K/I status)
  spouseIncome?: SpouseIncomeData;
}

/**
 * Other income for SPT 1770 S
 * Income not from employment that is subject to progressive tax
 */
export interface SPT1770SOtherIncome {
  // Domestic other income
  interestFromBank: number; // Bunga dari bank (subject to final tax, but may have exceptions)
  dividends: number; // Dividen
  rental: number; // Sewa
  royalties: number; // Royalti
  capitalGains: number; // Keuntungan penjualan harta
  prizes: number; // Hadiah
  otherIncome: number; // Penghasilan lainnya

  // Foreign income (must be included)
  foreignIncome?: ForeignIncomeData[];

  // Total calculated
  totalOtherIncome: number;
}

/**
 * Foreign income data
 */
export interface ForeignIncomeData {
  countryCode: string;
  countryName: string;
  incomeType: string;
  grossIncome: number;
  foreignTaxPaid: number;
  exchangeRate: number; // IDR per foreign currency
  incomeInIDR: number;
}

/**
 * Income subject to final tax (PPh Final)
 * These are reported for information but not included in progressive tax calculation
 */
export interface SPT1770SFinalTaxIncome {
  // Bank interest (PPh 4(2) - 20%)
  bankInterest: number;
  bankInterestTax: number;

  // Deposit/savings interest (PPh 4(2) - 20%)
  depositInterest: number;
  depositInterestTax: number;

  // Stock dividend from listed companies (PPh 4(2) - 10%)
  stockDividend: number;
  stockDividendTax: number;

  // Property rental (PPh 4(2) - 10%)
  propertyRental: number;
  propertyRentalTax: number;

  // Land/building sale (PPh 4(2) - 2.5%)
  landBuildingSale: number;
  landBuildingSaleTax: number;

  // UMKM income (PP 23/2018 - 0.5%)
  umkmIncome: number;
  umkmTax: number;

  // Other final tax income
  otherFinalIncome: number;
  otherFinalTax: number;

  // Totals
  totalFinalIncome: number;
  totalFinalTax: number;
}

/**
 * Tax credits for SPT 1770 S
 */
export interface SPT1770STaxCredits {
  // PPh 21 withheld from employment income
  pph21Withheld: number;

  // PPh 22 collected (import duties, etc.)
  pph22Withheld: number;

  // PPh 23 withheld (dividends, interest, royalties, etc.)
  pph23Withheld: number;

  // PPh 24 - foreign tax credit
  pph24ForeignTaxCredit: number;

  // PPh 25 installments already paid
  pph25Installments: number;

  // STP (Surat Tagihan Pajak) - tax assessments paid
  stpPayments: number;

  // Total tax credits
  totalTaxCredits: number;
}

/**
 * Spouse income data (for K/I status)
 */
export interface SpouseIncomeData {
  // Spouse identification
  spouseNpwp?: string;
  spouseName: string;

  // Spouse income
  grossIncome: number;
  netIncome: number;
  taxWithheld: number;

  // Joint or separate filing
  isJointFiling: boolean;
}

/**
 * SPT 1770 S calculation summary
 */
export interface SPT1770SSummary {
  // Part A: Employment income
  totalEmploymentGrossIncome: number;
  totalEmploymentDeductions: number;
  totalEmploymentNetIncome: number;

  // Part B: Other income
  totalOtherIncome: number;

  // Part C: Spouse income (if joint filing)
  spouseNetIncome: number;

  // Part D: Total net income
  totalNetIncome: number; // Employment + Other + Spouse

  // Part E: PTKP and PKP
  ptkpAmount: number;
  taxableIncome: number; // PKP = Total Net Income - PTKP (min 0)

  // Part F: Tax calculation
  taxDue: number; // PPh terutang from progressive rates
  taxOnForeignIncome: number; // Tax on foreign income
  totalTaxBeforeCredits: number;

  // Part G: Tax credits
  totalTaxCredits: number;
  pph24Credit: number; // Foreign tax credit (limited)

  // Part H: Net tax
  taxPayable: number; // Kurang Bayar
  taxRefund: number; // Lebih Bayar

  // Status
  status: TaxStatus;

  // Breakdown for transparency
  taxBreakdown: TaxBracketBreakdown[];
}

/**
 * Tax bracket breakdown for detailed calculation view
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
 * SPT 1770 S form sections mapping to official DJP form
 */
export interface SPT1770SFormSections {
  // Identitas (Identity)
  identitas: {
    npwp: string;
    nama: string;
    pekerjaan: string;
    alamat: string;
    telepon: string;
    email: string;
    statusPerkawinan: 'TK' | 'K' | 'K/I';
    jumlahTanggungan: number;
  };

  // Lampiran I - Penghasilan Neto Dalam Negeri dari Usaha dan/atau Pekerjaan Bebas
  // (Not applicable for 1770 S - use 1770 for business income)

  // Lampiran II - Penghasilan yang Dikenakan PPh Final dan yang Tidak Termasuk Objek Pajak
  lampiranII: {
    finalTaxIncome: SPT1770SFinalTaxIncome;
  };

  // Lampiran III - Daftar Harta dan Kewajiban
  lampiranIII: {
    assets: AssetDeclaration[];
    liabilities: LiabilityDeclaration[];
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };

  // Lampiran IV - Daftar Susunan Anggota Keluarga
  lampiranIV: {
    familyMembers: FamilyMemberData[];
  };

  // Induk SPT - Main form calculations
  induk: {
    // A. Penghasilan Neto
    penghasilanNetoKaryawan: number; // From 1721-A1
    penghasilanNetoLainnya: number; // Other income
    penghasilanNetoLuarNegeri: number; // Foreign income
    jumlahPenghasilanNeto: number;

    // B. Penghasilan Tidak Kena Pajak
    ptkp: number;

    // C. Penghasilan Kena Pajak
    pkp: number;

    // D. PPh Terutang
    pphTerutang: number;

    // E. Kredit Pajak
    pph21: number;
    pph22: number;
    pph23: number;
    pph24: number;
    pph25: number;
    stp: number;
    jumlahKreditPajak: number;

    // F. PPh Kurang/Lebih Bayar
    pphKurangBayar: number;
    pphLebihBayar: number;
  };

  // Daftar Bukti Potong
  buktiPotong: BuktiPotongEntry[];
}

/**
 * Family member data for Lampiran IV
 */
export interface FamilyMemberData {
  nama: string;
  nik: string;
  hubungan: 'SUAMI' | 'ISTRI' | 'ANAK' | 'ORANG_TUA' | 'LAINNYA';
  tanggalLahir: string;
  pekerjaan: string;
}

/**
 * Bukti Potong (withholding tax certificate) entry
 */
export interface BuktiPotongEntry {
  nomorBuktiPotong: string;
  tanggal: string;
  pemotong: string;
  npwpPemotong: string;
  jenisPajak: 'PPh21' | 'PPh22' | 'PPh23' | 'PPh24';
  jenisPenghasilan: string;
  jumlahPenghasilan: number;
  pphDipotong: number;
}

/**
 * 1770 S eligibility check
 */
export type SPT1770SEligibility =
  | { eligible: true }
  | { eligible: false; reason: string; suggestedForm: '1770SS' | '1770' };
