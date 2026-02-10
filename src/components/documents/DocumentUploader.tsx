'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DOCUMENT_TYPES = [
  { value: 'TAX_DOCUMENT', label: 'Tax Document' },
  { value: 'BUKTI_POTONG', label: 'Bukti Potong' },
  { value: 'FAKTUR_PAJAK', label: 'Faktur Pajak' },
  { value: 'LAPORAN_KEUANGAN', label: 'Laporan Keuangan' },
  { value: 'KTP', label: 'KTP' },
  { value: 'NPWP_CARD', label: 'Kartu NPWP' },
  { value: 'POA_DRAFT', label: 'Draft Surat Kuasa' },
  { value: 'OTHER', label: 'Lainnya' },
];

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface DocumentUploaderProps {
  onUploadComplete?: (document: UploadedDocument) => void;
  customerId?: string;
  taxFilingId?: string;
}

interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  status: string;
}

export function DocumentUploader({
  onUploadComplete,
  customerId,
  taxFilingId,
}: DocumentUploaderProps) {
  const t = useTranslations();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('TAX_DOCUMENT');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(t('documents.invalidFileType'));
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(t('documents.fileTooLarge'));
        continue;
      }

      setIsUploading(true);
      setUploadProgress(((i + 0.5) / files.length) * 100);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        if (customerId) formData.append('customerId', customerId);
        if (taxFilingId) formData.append('taxFilingId', taxFilingId);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          const newDoc: UploadedDocument = {
            id: data.data.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            documentType: documentType,
            status: 'uploaded',
          };
          setUploadedFiles((prev) => [...prev, newDoc]);
          onUploadComplete?.(newDoc);
        } else {
          setError(data.error || t('documents.uploadFailed'));
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(t('documents.uploadFailed'));
      }

      setUploadProgress(((i + 1) / files.length) * 100);
    }

    setIsUploading(false);
    setUploadProgress(0);
  }, [documentType, customerId, taxFilingId, onUploadComplete, t]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [uploadFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files);
    e.target.value = '';
  }, [uploadFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Document Type Selection */}
      <div className="space-y-2">
        <Label>{t('documents.documentType')}</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 text-gray-400">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              {t('documents.dragAndDrop')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('documents.orClickToUpload')}
            </p>
          </div>
          <input
            type="file"
            id="doc-upload"
            className="hidden"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
          />
          <Button
            variant="default"
            onClick={() => document.getElementById('doc-upload')?.click()}
            disabled={isUploading}
          >
            {isUploading ? t('common.uploading') : t('documents.selectFiles')}
          </Button>
          <p className="text-xs text-gray-400">
            PDF, JPG, PNG, Excel - {t('documents.maxSize')} 10MB
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('documents.uploading')}</span>
            <span className="text-gray-900 font-medium">
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">
            {t('documents.uploadedFiles')} ({uploadedFiles.length})
          </h4>
          <div className="border rounded-lg divide-y">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-green-600 font-medium">
                  {t('common.success')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
