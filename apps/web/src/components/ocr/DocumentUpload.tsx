import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

interface DocumentUploadProps {
  taxCaseId?: string;
  onUploadComplete?: (documentId: string, ocrJobId?: string) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

/**
 * DocumentUpload component with drag-and-drop support
 * Supports PDF, JPG, PNG files up to 10MB
 */
export function DocumentUpload({
  taxCaseId,
  onUploadComplete,
  onUploadError,
  className,
}: DocumentUploadProps) {
  const { upload, progress, isUploading, error } = useDocumentUpload();

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Handle rejections
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        const errorMessage = rejection.errors
          .map((e) => {
            if (e.code === 'file-too-large') {
              return '파일 크기가 10MB를 초과합니다.';
            }
            if (e.code === 'file-invalid-type') {
              return '지원하지 않는 파일 형식입니다. (PDF, JPG, PNG만 가능)';
            }
            return e.message;
          })
          .join(' ');
        onUploadError?.(errorMessage);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const result = await upload(file, taxCaseId);
        onUploadComplete?.(result.id, result.ocrJobId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed';
        onUploadError?.(message);
      }
    },
    [upload, taxCaseId, onUploadComplete, onUploadError],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
      multiple: false,
      disabled: isUploading,
    });

  const hasError = error || fileRejections.length > 0;

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            isUploading && 'pointer-events-none opacity-50',
            hasError && 'border-destructive',
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="space-y-4">
              <FileText className="mx-auto h-12 w-12 text-primary animate-pulse" />
              <div className="space-y-2">
                <p className="text-sm font-medium">업로드 중...</p>
                <Progress value={progress} className="w-full max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive
                    ? '여기에 파일을 놓으세요'
                    : '파일을 드래그하거나 클릭하여 선택'}
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, JPG, PNG (최대 10MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {hasError && (
          <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              {error || '지원하지 않는 파일 형식이거나 크기가 초과되었습니다.'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DocumentUpload;
