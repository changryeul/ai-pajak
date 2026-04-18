/**
 * OCR Processing Types
 *
 * Defines types for OCR document processing pipeline
 */

export type DocumentCategory =
  | 'BUKTI_POTONG'      // Withholding tax slip
  | 'FAKTUR_PAJAK'      // Tax invoice
  | 'LAPORAN_KEUANGAN'  // Financial statement
  | 'KTP'               // ID card
  | 'NPWP_CARD'         // Tax ID card
  | 'KARTU_KELUARGA'    // Family register (KK) — drives PTKP dependents
  | 'SPT'               // Tax return form
  | 'UNKNOWN';

export type OCRStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OCRResult {
  documentId: string;
  status: OCRStatus;
  category: DocumentCategory;
  confidence: number;
  extractedData: ExtractedData;
  rawText: string;
  processingTimeMs: number;
  errorMessage?: string;
}

export interface ExtractedData {
  // Common fields
  documentNumber?: string;
  documentDate?: string;
  taxPeriod?: string;
  taxYear?: number;

  // Tax-related
  npwp?: string;
  taxAmount?: number;
  grossAmount?: number;
  taxRate?: number;

  // Entity info
  entityName?: string;
  entityAddress?: string;

  // For Bukti Potong
  withholdingTaxType?: string;
  incomeType?: string;

  // For Faktur Pajak
  fakturNumber?: string;
  dpp?: number; // Dasar Pengenaan Pajak
  ppn?: number; // PPN amount

  // For KTP/NPWP
  nik?: string;
  fullName?: string;
  birthDate?: string;
  address?: string;

  // Raw key-value pairs
  additionalFields?: Record<string, string>;
}

export interface OCRJobRequest {
  documentId: string;
  fileUrl: string;
  fileType: string;
  expectedCategory?: DocumentCategory;
  priority?: 'high' | 'normal' | 'low';
}

export interface OCRJobStatus {
  jobId: string;
  documentId: string;
  status: OCRStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  result?: OCRResult;
}

// Pattern matchers for Indonesian tax documents
export const TAX_PATTERNS = {
  NPWP: /\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}/,
  NIK: /\d{16}/,
  FAKTUR_NUMBER: /\d{3}\.\d{3}-\d{2}\.\d{8}/,
  CURRENCY_IDR: /Rp\.?\s*[\d.,]+/gi,
  DATE_ID: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/,
  TAX_PERIOD: /\b(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}\b/i,
};

// Document classification keywords
export const DOCUMENT_KEYWORDS: Record<DocumentCategory, string[]> = {
  BUKTI_POTONG: [
    'bukti potong',
    'bukti pemotongan',
    'pph pasal 21',
    'pph pasal 23',
    'pph pasal 26',
    'pph final',
    '1721-A1',
    '1721-A2',
  ],
  FAKTUR_PAJAK: [
    'faktur pajak',
    'tax invoice',
    'ppn',
    'pajak pertambahan nilai',
    'dasar pengenaan pajak',
    'dpp',
  ],
  LAPORAN_KEUANGAN: [
    'laporan keuangan',
    'neraca',
    'laba rugi',
    'income statement',
    'balance sheet',
    'arus kas',
    'cash flow',
  ],
  KTP: [
    'kartu tanda penduduk',
    'ktp',
    'nik',
    'kewarganegaraan',
    'berlaku hingga',
  ],
  NPWP_CARD: [
    'nomor pokok wajib pajak',
    'npwp',
    'terdaftar',
    'kantor pelayanan pajak',
  ],
  KARTU_KELUARGA: [
    'kartu keluarga',
    'nomor kartu keluarga',
    'kepala keluarga',
    'nama lengkap',
    'status hubungan dalam keluarga',
    'status perkawinan',
  ],
  SPT: [
    'surat pemberitahuan',
    'spt tahunan',
    'spt masa',
    'formulir 1770',
    'formulir 1771',
  ],
  UNKNOWN: [],
};
