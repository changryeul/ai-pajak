/**
 * BPE (Bukti Penerimaan Elektronik) Types
 *
 * Types for Electronic Receipt of Tax Filing
 */

export interface BPEData {
  // Filing Information
  filingId: string;
  bpeNumber: string;
  filedAt: Date;

  // Taxpayer Information
  taxpayer: {
    name: string;
    npwp: string;
    address?: string;
    companyName?: string;
  };

  // Tax Filing Details
  taxType: TaxType;
  taxPeriod: string;
  taxYear: number;

  // Tax Summary
  taxSummary: {
    totalIncome?: number;
    totalDeductions?: number;
    taxableIncome?: number;
    taxDue: number;
    taxPaid: number;
    taxRefund?: number;
    taxPayable?: number;
  };

  // Submission Details
  submissionDetails: {
    submittedAt: Date;
    acceptedAt?: Date;
    submissionChannel: string;
    filingType: FilingType;
    correctionNumber?: number;
  };

  // Tax Partner (if filed via consultant)
  taxPartner?: {
    name: string;
    npwp: string;
    licenseNumber: string;
  };
}

export type TaxType = 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_MASA' | 'SPT_TAHUNAN';

export type FilingType = 'REGULAR' | 'CORRECTION' | 'ANNUAL';

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  PPh21: 'PPh Pasal 21',
  PPh23: 'PPh Pasal 23',
  PPh_FINAL: 'PPh Final',
  PPN: 'Pajak Pertambahan Nilai (PPN)',
  SPT_MASA: 'SPT Masa',
  SPT_TAHUNAN: 'SPT Tahunan Orang Pribadi',
};

export const FILING_TYPE_LABELS: Record<FilingType, string> = {
  REGULAR: 'SPT Normal',
  CORRECTION: 'SPT Pembetulan',
  ANNUAL: 'SPT Tahunan',
};
