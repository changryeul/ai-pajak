/**
 * Storage Types for AI Pajak
 * Defines types for file storage operations
 */

export type StorageBucket = 'tax-documents' | 'poa-documents' | 'avatars';

export type DocumentType =
  | 'INVOICE'
  | 'RECEIPT'
  | 'SALARY_SLIP'
  | 'FORM_1721_A1'
  | 'FORM_1770'
  | 'BANK_STATEMENT'
  | 'E_FAKTUR'
  | 'POA_DOCUMENT'
  | 'FAMILY_CARD' // Kartu Keluarga (KK) — used for 1770SS intake
  | 'FOREIGN_TAX_RECEIPT' // supporting doc for 세액공제
  | 'OTHER';

export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: StorageBucket;
  path: string;
  documentType: DocumentType;
  uploadedBy: string;
  uploadedAt: string;
  taxFilingId?: string;
  customerId?: string;
}

export interface UploadOptions {
  bucket: StorageBucket;
  documentType: DocumentType;
  taxFilingId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  success: boolean;
  data?: FileMetadata;
  error?: string;
  signedUrl?: string;
}

export interface DownloadResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// Allowed MIME types for different document types
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  pdf: ['application/pdf'],
  document: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'text/csv',
  ],
};

// Maximum file sizes in bytes
export const MAX_FILE_SIZES: Record<StorageBucket, number> = {
  'tax-documents': 10 * 1024 * 1024, // 10MB
  'poa-documents': 5 * 1024 * 1024,  // 5MB
  'avatars': 2 * 1024 * 1024,        // 2MB
};

// File extension mapping
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
};
