'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OCRResult {
  documentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  category: string;
  confidence: number;
  extractedData: Record<string, unknown>;
  rawText: string;
  processingTimeMs: number;
  errorMessage?: string;
}

interface DocumentOCRUploaderProps {
  customerId: string;
  expectedCategory?: string;
  onUploadComplete?: (documentId: string, result: OCRResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export function DocumentOCRUploader({
  customerId,
  expectedCategory,
  onUploadComplete,
  onError,
  className,
}: DocumentOCRUploaderProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acceptedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploadStatus('uploading');
      setUploadProgress(0);
      setErrorMessage(null);
      setOcrResult(null);

      try {
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('customerId', customerId);
        if (expectedCategory) {
          formData.append('documentType', expectedCategory);
        }

        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        // Upload file
        const uploadResponse = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.message || 'Upload failed');
        }

        const { documentId: docId } = await uploadResponse.json();
        setDocumentId(docId);
        setUploadStatus('processing');

        // Trigger OCR processing
        const ocrResponse = await fetch(`/api/documents/${docId}/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedCategory }),
        });

        if (!ocrResponse.ok) {
          const error = await ocrResponse.json();
          throw new Error(error.message || 'OCR processing failed to start');
        }

        // Poll for OCR completion
        const result = await pollOCRStatus(docId);
        setOcrResult(result);
        setUploadStatus(result.status === 'COMPLETED' ? 'completed' : 'failed');

        if (result.status === 'COMPLETED') {
          onUploadComplete?.(docId, result);
        } else if (result.errorMessage) {
          setErrorMessage(result.errorMessage);
          onError?.(result.errorMessage);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setErrorMessage(message);
        setUploadStatus('failed');
        onError?.(message);
      }
    },
    [customerId, expectedCategory, onUploadComplete, onError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const reset = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setOcrResult(null);
    setDocumentId(null);
    setErrorMessage(null);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Document OCR Upload
          {uploadStatus === 'completed' && (
            <Badge variant="default" className="bg-green-500">
              Completed
            </Badge>
          )}
          {uploadStatus === 'failed' && (
            <Badge variant="destructive">Failed</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uploadStatus === 'idle' && (
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-12 h-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-muted-foreground">
                {isDragActive
                  ? 'Drop the file here...'
                  : 'Drag & drop a document, or click to select'}
              </p>
              <p className="text-sm text-muted-foreground/70">
                Supported: JPEG, PNG, WebP, PDF (max 10MB)
              </p>
            </div>
          </div>
        )}

        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              <span>
                {uploadStatus === 'uploading'
                  ? 'Uploading...'
                  : 'Processing OCR...'}
              </span>
            </div>
            <Progress value={uploadStatus === 'uploading' ? uploadProgress : 100} />
          </div>
        )}

        {uploadStatus === 'completed' && ocrResult && (
          <div className="space-y-4">
            <OCRResultDisplay result={ocrResult} />
            <Button onClick={reset} variant="outline" className="w-full">
              Upload Another Document
            </Button>
          </div>
        )}

        {uploadStatus === 'failed' && (
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg text-destructive">
              <p className="font-medium">Processing Failed</p>
              <p className="text-sm">{errorMessage || 'An unknown error occurred'}</p>
            </div>
            <Button onClick={reset} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Poll OCR status until completion
async function pollOCRStatus(
  documentId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<OCRResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/documents/${documentId}/ocr`);
    if (!response.ok) {
      throw new Error('Failed to get OCR status');
    }

    const { data } = await response.json();

    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      return data.result || {
        documentId,
        status: data.status,
        category: 'UNKNOWN',
        confidence: 0,
        extractedData: {},
        rawText: '',
        processingTimeMs: 0,
        errorMessage: data.status === 'FAILED' ? 'OCR processing failed' : undefined,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('OCR processing timed out');
}

// OCR Result Display Component
function OCRResultDisplay({ result }: { result: OCRResult }) {
  const confidenceColor =
    result.confidence >= 0.8
      ? 'text-green-600'
      : result.confidence >= 0.5
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Document Type</p>
          <p className="font-medium">{formatCategory(result.category)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Confidence</p>
          <p className={cn('font-medium', confidenceColor)}>
            {(result.confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {Object.keys(result.extractedData).length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="font-medium mb-2">Extracted Data</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(result.extractedData)
              .filter(([key]) => !key.startsWith('additional'))
              .slice(0, 10)
              .map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-muted-foreground">{formatFieldName(key)}</span>
                  <span className="font-mono">{formatFieldValue(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Processed in {result.processingTimeMs}ms
      </p>
    </div>
  );
}

function formatCategory(category: string): string {
  const categoryNames: Record<string, string> = {
    BUKTI_POTONG: 'Bukti Potong (Withholding Tax)',
    FAKTUR_PAJAK: 'Faktur Pajak (Tax Invoice)',
    LAPORAN_KEUANGAN: 'Laporan Keuangan (Financial Statement)',
    KTP: 'KTP (ID Card)',
    NPWP_CARD: 'NPWP Card (Tax ID)',
    SPT: 'SPT (Tax Return)',
    UNKNOWN: 'Unknown Document',
  };
  return categoryNames[category] || category;
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    return value.toLocaleString('id-ID');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default DocumentOCRUploader;
