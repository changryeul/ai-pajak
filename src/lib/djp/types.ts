/**
 * DJP (Direktorat Jenderal Pajak) API Types
 *
 * Type definitions for Indonesia Tax Authority API integration
 * Covers e-Filing, e-Billing, NPWP validation, and BPE retrieval
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type DJPEnvironment = 'sandbox' | 'production';

export type SPTType =
  | 'SPT_MASA_PPH21'
  | 'SPT_MASA_PPH23'
  | 'SPT_MASA_PPH4_2'
  | 'SPT_MASA_PPN'
  | 'SPT_TAHUNAN_1770'
  | 'SPT_TAHUNAN_1770S'
  | 'SPT_TAHUNAN_1770SS'
  | 'SPT_TAHUNAN_1771';

export type DJPSubmissionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export type DJPJobType =
  | 'E_FILING'
  | 'E_BILLING'
  | 'NPWP_VALIDATION'
  | 'BPE_RETRIEVAL';

export type DJPJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type DJPJobPriority = 'HIGH' | 'NORMAL' | 'LOW';

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface DJPCredentials {
  clientId: string;
  clientSecret: string;
  certificatePath?: string;
  certificatePassword?: string;
}

export interface DJPAuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope: string;
}

// ============================================================================
// E-FILING TYPES
// ============================================================================

export interface EFilingRequest {
  npwp: string;
  taxYear: number;
  taxPeriod: string; // 'YYYY-MM' for SPT Masa, 'YYYY' for SPT Tahunan
  sptType: SPTType;
  correctionNumber: number; // 0 = normal, 1+ = correction (pembetulan)
  sptData: SPTData;
  attachments?: DJPAttachment[];
  poaNumber?: string; // Surat Kuasa
  submittedBy: {
    npwp: string; // Tax consultant NPWP
    name: string;
    licenseNumber: string; // Izin Praktek
  };
}

export interface SPTData {
  identitasWP: IdentitasWP;
  periodeData: PeriodeData;
  detailData: PPh21Data | PPh23Data | PPNData | SPTTahunanData;
}

export interface IdentitasWP {
  npwp: string;
  nama: string;
  alamat: string;
  kelurahan?: string;
  kecamatan?: string;
  kota: string;
  provinsi?: string;
  kodePos?: string;
  telepon?: string;
  email?: string;
  statusWP: 'OP' | 'BADAN'; // Orang Pribadi atau Badan
}

export interface PeriodeData {
  tahunPajak: number;
  masaPajak?: string; // '01' - '12' for monthly
  pembetulanKe: number;
}

export interface PPh21Data {
  jumlahPegawaiTetap: number;
  jumlahPenerimaUpah: number;
  penghasilanBruto: number;
  pphTerutang: number;
  pphDipotong: number;
  pphDisetor: number;
  kurangBayar?: number;
  lebihBayar?: number;
}

export interface PPh23Data {
  jenisPenghasilan: string;
  jumlahBruto: number;
  tarif: number;
  pphTerutang: number;
  pphDisetor: number;
}

export interface PPNData {
  penyerahanBKP: number;
  penyerahanJKP: number;
  jumlahDPP: number;
  ppnKeluaran: number;
  ppnMasukan: number;
  ppnKurangBayar?: number;
  ppnLebihBayar?: number;
}

export interface SPTTahunanData {
  // 1770SS specific
  penghasilanNeto?: number;
  ptkp?: number;
  pkp?: number;
  pphTerutang?: number;
  pphDipotong?: number;
  pphKurangBayar?: number;
  pphLebihBayar?: number;
  // Additional fields for 1770, 1770S, 1771
  penghasilanLainnya?: number;
  totalHarta?: number;
  totalKewajiban?: number;
}

export interface DJPAttachment {
  documentType: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
}

export interface EFilingResponse {
  success: boolean;
  transactionId: string;
  submissionTime: Date;
  status: DJPSubmissionStatus;
  bpeNumber?: string;
  bpeDate?: Date;
  errorCode?: string;
  errorMessage?: string;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

// ============================================================================
// E-BILLING TYPES
// ============================================================================

export interface EBillingRequest {
  npwp: string;
  jenisPajak: string; // e.g., '411121' for PPh 21
  jenisSetoran: string; // e.g., '100' for monthly
  masaPajak: string; // 'MM' format
  tahunPajak: number;
  jumlahSetor: number;
  uraian?: string;
}

export interface EBillingResponse {
  success: boolean;
  kodeBilling?: string;
  ntpn?: string; // NTPN (after payment)
  validUntil?: Date;
  jumlahSetor: number;
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// NPWP VALIDATION TYPES
// ============================================================================

export interface NPWPValidationRequest {
  npwp: string;
  nik?: string; // Optional cross-validation
}

export interface NPWPValidationResponse {
  valid: boolean;
  npwp: string;
  nama?: string;
  alamat?: string;
  kppAdmin?: string;
  statusWP?: 'AKTIF' | 'NON_EFEKTIF' | 'DE';
  tanggalTerdaftar?: Date;
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// BPE RETRIEVAL TYPES
// ============================================================================

export interface BPERetrievalRequest {
  transactionId: string;
  npwp: string;
}

export interface BPERetrievalResponse {
  success: boolean;
  bpeNumber?: string;
  bpeDate?: Date;
  status: DJPSubmissionStatus;
  sptType?: SPTType;
  taxPeriod?: string;
  pdfBase64?: string; // Official BPE PDF from DJP
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// JOB QUEUE TYPES
// ============================================================================

export interface DJPJobRequest {
  jobId: string;
  type: DJPJobType;
  taxFilingId?: string;
  customerId?: string;
  payload:
    | EFilingRequest
    | EBillingRequest
    | NPWPValidationRequest
    | BPERetrievalRequest;
  priority: DJPJobPriority;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt?: Date;
}

export interface DJPJobStatusResponse {
  jobId: string;
  status: DJPJobStatus;
  progress: number;
  result?:
    | EFilingResponse
    | EBillingResponse
    | NPWPValidationResponse
    | BPERetrievalResponse;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export type DJPWebhookEventType =
  | 'FILING_ACCEPTED'
  | 'FILING_REJECTED'
  | 'BPE_READY'
  | 'BILLING_PAID';

export interface DJPWebhookPayload {
  eventType: DJPWebhookEventType;
  transactionId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  signature: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type DJPErrorCategory = 'AUTH' | 'VALIDATION' | 'NETWORK' | 'SYSTEM';

export interface DJPErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    category: DJPErrorCategory;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// DATABASE TYPES (for Supabase)
// ============================================================================

export interface DJPJobRow {
  id: string;
  type: DJPJobType;
  tax_filing_id: string | null;
  customer_id: string | null;
  payload: Record<string, unknown>;
  priority: DJPJobPriority;
  status: DJPJobStatus;
  retry_count: number;
  max_retries: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  djp_transaction_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DJPBillingRow {
  id: string;
  customer_id: string;
  tax_filing_id: string | null;
  djp_job_id: string | null;
  kode_billing: string | null;
  jenis_pajak: string;
  jenis_setoran: string;
  masa_pajak: string;
  tahun_pajak: number;
  jumlah_setor: number;
  valid_until: string | null;
  ntpn: string | null;
  payment_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
