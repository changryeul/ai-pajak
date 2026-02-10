/**
 * File Validation Utilities
 * Validates file type, size, and security
 */

import {
  StorageBucket,
  DocumentType,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
  EXTENSION_MIME_MAP,
} from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file type based on MIME type and extension
 */
export function validateFileType(
  file: File,
  allowedTypes: 'image' | 'pdf' | 'document' = 'document'
): ValidationResult {
  const allowedMimeTypes = ALLOWED_MIME_TYPES[allowedTypes];

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
    };
  }

  // Validate extension matches MIME type
  const extension = getFileExtension(file.name).toLowerCase();
  const expectedMimeType = EXTENSION_MIME_MAP[extension];

  if (expectedMimeType && expectedMimeType !== file.type) {
    return {
      valid: false,
      error: `File extension "${extension}" does not match file type "${file.type}"`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size based on bucket limits
 */
export function validateFileSize(
  file: File,
  bucket: StorageBucket
): ValidationResult {
  const maxSize = MAX_FILE_SIZES[bucket];

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  return { valid: true };
}

/**
 * Validate file name for security issues
 */
export function validateFileName(fileName: string): ValidationResult {
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return {
      valid: false,
      error: 'File name contains invalid characters',
    };
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return {
      valid: false,
      error: 'File name contains invalid characters',
    };
  }

  // Check for executable extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.js', '.vbs'];
  const extension = getFileExtension(fileName).toLowerCase();
  if (dangerousExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not allowed`,
    };
  }

  // Check length
  if (fileName.length > 255) {
    return {
      valid: false,
      error: 'File name is too long (max 255 characters)',
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  file: File,
  bucket: StorageBucket,
  allowedTypes: 'image' | 'pdf' | 'document' = 'document'
): ValidationResult {
  // Validate file name
  const nameValidation = validateFileName(file.name);
  if (!nameValidation.valid) {
    return nameValidation;
  }

  // Validate file type
  const typeValidation = validateFileType(file, allowedTypes);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // Validate file size
  const sizeValidation = validateFileSize(file, bucket);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}

/**
 * Get file extension from file name
 */
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return '';
  }
  return fileName.substring(lastDotIndex);
}

/**
 * Generate safe file name with UUID
 */
export function generateSafeFileName(
  originalName: string,
  userId: string
): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  const extension = getFileExtension(originalName).toLowerCase();

  // Sanitize extension
  const safeExtension = extension.replace(/[^a-z0-9.]/g, '');

  return `${userId}/${timestamp}-${randomId}${safeExtension}`;
}

/**
 * Get document type from file name/type
 */
export function inferDocumentType(
  fileName: string,
  mimeType: string
): DocumentType {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('1721') || lowerName.includes('a1')) {
    return 'FORM_1721_A1';
  }
  if (lowerName.includes('1770')) {
    return 'FORM_1770';
  }
  if (lowerName.includes('faktur') || lowerName.includes('efaktur')) {
    return 'E_FAKTUR';
  }
  if (lowerName.includes('invoice') || lowerName.includes('faktur')) {
    return 'INVOICE';
  }
  if (lowerName.includes('receipt') || lowerName.includes('kwitansi')) {
    return 'RECEIPT';
  }
  if (lowerName.includes('slip') || lowerName.includes('gaji') || lowerName.includes('salary')) {
    return 'SALARY_SLIP';
  }
  if (lowerName.includes('bank') || lowerName.includes('statement') || lowerName.includes('rekening')) {
    return 'BANK_STATEMENT';
  }
  if (lowerName.includes('poa') || lowerName.includes('kuasa')) {
    return 'POA_DOCUMENT';
  }

  return 'OTHER';
}
