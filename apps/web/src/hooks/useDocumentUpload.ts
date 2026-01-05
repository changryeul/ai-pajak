import { useState, useCallback } from 'react';
import { uploadDocument } from '@/api/document.api';
import type { UploadResponse } from '@/api/document.api';

interface UseDocumentUploadReturn {
  upload: (file: File, taxCaseId?: string) => Promise<UploadResponse>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Custom hook for document upload with progress tracking
 */
export function useDocumentUpload(): UseDocumentUploadReturn {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, taxCaseId?: string): Promise<UploadResponse> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const result = await uploadDocument(file, taxCaseId, setProgress);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Upload failed. Please try again.';
        setError(message);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return { upload, progress, isUploading, error, reset };
}
