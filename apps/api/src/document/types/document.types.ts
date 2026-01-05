export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface OcrQueueJobData {
  documentId: string;
  filePath: string;
  mimeType: string;
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
