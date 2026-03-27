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
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, FileCheck, AlertCircle } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'AUTO_DETECT', label: 'Auto-detect (AI)' },
  { value: 'TAX_DOCUMENT', label: 'Tax Document' },
  { value: 'BUKTI_POTONG', label: 'Bukti Potong' },
  { value: 'FAKTUR_PAJAK', label: 'Faktur Pajak' },
  { value: 'LAPORAN_KEUANGAN', label: 'Laporan Keuangan' },
  { value: 'KTP', label: 'KTP' },
  { value: 'NPWP_CARD', label: 'Kartu NPWP' },
  { value: 'POA_DRAFT', label: 'Draft Surat Kuasa' },
  { value: 'RECEIPT', label: 'Struk / Kwitansi (AI)' },
  { value: 'OTHER', label: 'Lainnya' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  BUKTI_POTONG: { label: 'Bukti Potong (PPh 21/23)', color: 'bg-blue-100 text-blue-700' },
  FAKTUR_PAJAK: { label: 'Faktur Pajak (PPN)', color: 'bg-purple-100 text-purple-700' },
  LAPORAN_KEUANGAN: { label: 'Laporan Keuangan', color: 'bg-green-100 text-green-700' },
  KTP: { label: 'KTP', color: 'bg-orange-100 text-orange-700' },
  NPWP_CARD: { label: 'Kartu NPWP', color: 'bg-yellow-100 text-yellow-700' },
  SPT: { label: 'SPT', color: 'bg-red-100 text-red-700' },
  UNKNOWN: { label: 'Tidak Dikenali', color: 'bg-gray-100 text-gray-700' },
};

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
  aiClassification?: {
    category: string;
    confidence: number;
    details?: string;
  };
}

export function DocumentUploader({
  onUploadComplete,
  customerId,
  taxFilingId,
}: DocumentUploaderProps) {
  const t = useTranslations();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('AUTO_DETECT');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const classifyDocument = async (file: File): Promise<{
    category: string;
    confidence: number;
    details?: string;
  } | null> => {
    // Only classify image/pdf files
    const classifiableTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!classifiableTypes.includes(file.type)) return null;

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Don't pass expectedCategory - let AI detect freely

      const response = await fetch('/api/documents/ocr-extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error('Classification API error:', response.status, errBody);
        return null;
      }

      const { data } = await response.json();
      if (data?.status === 'COMPLETED') {
        // Build details from extracted data
        const ext = data.extractedData || {};
        const details = [
          ext.fullName || ext.entityName || ext.employeeName,
          ext.npwp || ext.employeeNpwp,
          ext.taxYear ? `Tahun ${ext.taxYear}` : null,
          ext.documentNumber || ext.nomorBuktiPotong || ext.fakturNumber,
        ]
          .filter(Boolean)
          .join(' | ');

        return {
          category: data.category,
          confidence: data.confidence,
          details: details || undefined,
        };
      }
    } catch (err) {
      console.error('Classification error:', err);
    }
    return null;
  };

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
      setUploadProgress(((i + 0.3) / files.length) * 100);

      try {
        // Step 1: AI Classification (if auto-detect)
        let classification: { category: string; confidence: number; details?: string } | null = null;
        let effectiveType = documentType;

        if (documentType === 'AUTO_DETECT') {
          setIsClassifying(true);
          classification = await classifyDocument(file);
          setIsClassifying(false);

          if (classification) {
            // Map OCR category to document type
            const categoryToType: Record<string, string> = {
              BUKTI_POTONG: 'BUKTI_POTONG',
              FAKTUR_PAJAK: 'FAKTUR_PAJAK',
              LAPORAN_KEUANGAN: 'LAPORAN_KEUANGAN',
              KTP: 'KTP',
              NPWP_CARD: 'NPWP_CARD',
              SPT: 'TAX_DOCUMENT',
            };
            effectiveType = categoryToType[classification.category] || 'TAX_DOCUMENT';
          } else {
            effectiveType = 'TAX_DOCUMENT';
          }
        }

        setUploadProgress(((i + 0.7) / files.length) * 100);

        // Step 2: Upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', effectiveType);
        if (customerId) formData.append('customerId', customerId);
        if (taxFilingId) formData.append('taxFilingId', taxFilingId);
        if (classification) {
          formData.append('aiClassification', JSON.stringify(classification));
        }

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
            documentType: effectiveType,
            status: 'uploaded',
            aiClassification: classification || undefined,
          };
          setUploadedFiles((prev) => [...prev, newDoc]);
          onUploadComplete?.(newDoc);
        } else {
          setError(data.error || t('documents.uploadFailed'));
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(t('documents.uploadFailed'));
        setIsClassifying(false);
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
                <span className="flex items-center gap-2">
                  {type.value === 'AUTO_DETECT' && (
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                  )}
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {documentType === 'AUTO_DETECT' && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-yellow-500" />
            AI akan otomatis mendeteksi jenis dokumen saat upload
          </p>
        )}
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
          <div className="flex items-center gap-2 text-sm">
            {isClassifying ? (
              <>
                <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                <span className="text-gray-600">AI sedang mengenali jenis dokumen...</span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-gray-600">{t('documents.uploading')}</span>
              </>
            )}
            <span className="ml-auto text-gray-900 font-medium">
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
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
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
            {uploadedFiles.map((file) => {
              const catInfo = file.aiClassification
                ? CATEGORY_LABELS[file.aiClassification.category] || CATEGORY_LABELS.UNKNOWN
                : null;

              return (
                <div key={file.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                        <FileCheck className="w-5 h-5 text-green-600" />
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

                  {/* AI Classification Result */}
                  {file.aiClassification && (
                    <div className="ml-13 pl-13 flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-gray-500">AI:</span>
                      </div>
                      <Badge className={`text-xs ${catInfo?.color || ''}`}>
                        {catInfo?.label || file.aiClassification.category}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        ({(file.aiClassification.confidence * 100).toFixed(0)}%)
                      </span>
                      {file.aiClassification.details && (
                        <span className="text-xs text-gray-500 truncate max-w-[250px]">
                          {file.aiClassification.details}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
