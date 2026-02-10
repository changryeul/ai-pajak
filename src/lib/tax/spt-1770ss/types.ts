/**
 * SPT 1770 SS Types
 *
 * Data types for Indonesian simplified annual tax return (SPT Tahunan 1770 SS)
 * For individual taxpayers with single source of income from employment
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
 * Income source from Form 1721-A1
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
 * SPT 1770 SS main form data
 */
export interface SPT1770SSData {
  // Form metadata
  taxYear: number;
  correctionNumber: number; // 0 = Normal, 1+ = Pembetulan ke-N
  submissionDate: Date;

  // Taxpayer info
  taxpayer: TaxpayerData;
  ptkpStatus: PTKPStatus;

  // Income sources (from 1721-A1)
  incomeSources: IncomeSource1721A1[];

  // Calculated totals
  summary: SPT1770SSSummary;

  // Optional: Other income (normally not applicable for 1770 SS)
  otherIncome?: number;
  otherTaxWithheld?: number;
}

/**
 * SPT 1770 SS calculation summary
 */
export interface SPT1770SSSummary {
  // Part A: Income
  totalGrossIncome: number; // Total Penghasilan Bruto
  totalDeductions: number; // Total Biaya Jabatan + Iuran Pensiun
  totalNetIncome: number; // Total Penghasilan Neto

  // Part B: PTKP and PKP
  ptkpAmount: number; // PTKP berdasarkan status
  taxableIncome: number; // PKP = Neto - PTKP (if > 0)

  // Part C: Tax calculation
  taxDue: number; // PPh Terutang (dari tarif progresif)
  totalTaxWithheld: number; // Total PPh yang sudah dipotong
  taxPayable: number; // PPh Kurang Bayar (if taxDue > taxWithheld)
  taxRefund: number; // PPh Lebih Bayar (if taxWithheld > taxDue)

  // Final status
  status: 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR';
}

/**
 * SPT 1770 SS form sections mapping to official DJP form
 */
export interface SPT1770SSFormSections {
  // Identitas
  section1_identitas: {
    npwp: string;
    nama: string;
    pekerjaan: string;
    alamat: string;
    telepon: string;
  };

  // Penghasilan Neto
  section2_penghasilan: {
    penghasilanNeto: number;
    penghasilanLainnya: number;
    totalPenghasilan: number;
  };

  // PTKP
  section3_ptkp: {
    status: PTKPStatus;
    jumlahPTKP: number;
  };

  // PKP dan Pajak
  section4_pajak: {
    pkp: number;
    pphTerutang: number;
  };

  // Kredit Pajak
  section5_kredit: {
    pphDipotong: number;
    pphDibayar: number;
    totalKredit: number;
  };

  // PPh Kurang/Lebih Bayar
  section6_hasil: {
    pphKurangBayar: number;
    pphLebihBayar: number;
  };

  // Daftar Bukti Potong
  lampiran: Array<{
    noBuktiPotong: string;
    tanggal: string;
    pemotong: string;
    npwpPemotong: string;
    jenisPenghasilan: string;
    jumlahPenghasilan: number;
    pphDipotong: number;
  }>;
}

/**
 * PTKP rates for 2024 (in Rupiah)
 * Based on PMK 101/2016
 */
export const PTKP_RATES: Record<PTKPStatus, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
  'K/I/0': 112_500_000,
  'K/I/1': 117_000_000,
  'K/I/2': 121_500_000,
  'K/I/3': 126_000_000,
};

/**
 * Progressive tax brackets for PPh 21 (2024)
 * Based on UU HPP 2021
 */
export const TAX_BRACKETS = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: 5_000_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

/**
 * SPT submission deadline
 * March 31st for individual taxpayers
 */
export function getSPTDeadline(taxYear: number): Date {
  return new Date(taxYear + 1, 2, 31); // March 31 of next year
}

/**
 * Check if SPT is late
 */
export function isSPTLate(taxYear: number, submissionDate: Date): boolean {
  const deadline = getSPTDeadline(taxYear);
  return submissionDate > deadline;
}
