/**
 * Supabase Storage Service
 * Handles file upload, download, and management operations
 */

import { createClient } from '@/lib/supabase/server';
import {
  StorageBucket,
  FileMetadata,
  UploadOptions,
  UploadResult,
  DownloadResult,
  DeleteResult,
} from './types';
import {
  validateFile,
  generateSafeFileName,
  inferDocumentType,
} from './file-validator';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  userId: string,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file, options.bucket);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate safe file path
    const filePath = generateSafeFileName(file.name, userId);

    // Get Supabase client
    const supabase = await createClient();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(options.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: error.message };
    }

    // Get signed URL for immediate access
    const { data: urlData } = await supabase.storage
      .from(options.bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    // Create file metadata
    const metadata: FileMetadata = {
      id: crypto.randomUUID(),
      fileName: filePath,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      bucket: options.bucket,
      path: data.path,
      documentType: options.documentType || inferDocumentType(file.name, file.type),
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      taxFilingId: options.taxFilingId,
      customerId: options.customerId,
    };

    return {
      success: true,
      data: metadata,
      signedUrl: urlData?.signedUrl,
    };
  } catch (err) {
    console.error('Upload error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get a signed download URL for a file
 */
export async function getDownloadUrl(
  bucket: StorageBucket,
  filePath: string,
  expiresIn: number = 3600
): Promise<DownloadResult> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, signedUrl: data.signedUrl };
  } catch (err) {
    console.error('Download URL error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  filePath: string
): Promise<DeleteResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Delete error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

/**
 * List files in a directory
 */
export async function listFiles(
  bucket: StorageBucket,
  folderPath: string,
  options?: { limit?: number; offset?: number }
) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: options?.limit ?? 100,
        offset: options?.offset ?? 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
  } catch (err) {
    console.error('List files error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      data: null,
    };
  }
}

/**
 * Get file metadata from path
 */
export async function getFileMetadata(
  bucket: StorageBucket,
  filePath: string
) {
  try {
    const supabase = await createClient();

    // Get file info by listing the parent folder
    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    const folderPath = parts.join('/');

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath);

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    const file = data.find(f => f.name === fileName);
    if (!file) {
      return { success: false, error: 'File not found', data: null };
    }

    return { success: true, data: file };
  } catch (err) {
    console.error('Get metadata error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      data: null,
    };
  }
}

/**
 * Copy a file within storage
 */
export async function copyFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<{ success: boolean; error?: string; path?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .copy(fromPath, toPath);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: data.path };
  } catch (err) {
    console.error('Copy error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

/**
 * Move a file within storage
 */
export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<{ success: boolean; error?: string; path?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(bucket)
      .move(fromPath, toPath);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: toPath };
  } catch (err) {
    console.error('Move error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}
