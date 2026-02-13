/**
 * SPT 1770 SS Types
 *
 * Data types for Indonesian simplified annual tax return (SPT Tahunan 1770 SS)
 * For individual taxpayers with single source of income from employment
 */

// Re-export shared types for backward compatibility
export type { TaxpayerData, PTKPStatus, IncomeSource1721A1 } from '../shared/types';

// Re-export shared constants
export { PTKP_RATES, TAX_BRACKETS } from '../shared/constants';

// Import types for use in this file
import type { TaxpayerData, PTKPStatus, IncomeSource1721A1 } from '../shared/types';

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

// Re-export deadline utilities from shared (for backward compatibility)
export { getSPTDeadline, isSPTLate } from '../shared/tax-utils';
