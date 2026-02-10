/**
 * Storage Module
 * Main export file for file storage operations
 */

// Types
export * from './types';

// Validators
export {
  validateFile,
  validateFileType,
  validateFileSize,
  validateFileName,
  getFileExtension,
  generateSafeFileName,
  inferDocumentType,
} from './file-validator';

// Storage operations
export {
  uploadFile,
  getDownloadUrl,
  deleteFile,
  listFiles,
  getFileMetadata,
  copyFile,
  moveFile,
} from './supabase-storage';
