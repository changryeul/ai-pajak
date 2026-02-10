'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useTaxFilingStore, DocumentData } from '@/stores/tax-filing-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentsStep() {
  const t = useTranslations();
  const { taxType, documents, addDocument, removeDocument } = useTaxFilingStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const requiredDocs = getRequiredDocuments(taxType);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    setUploadError(null);

    for (const file of files) {
      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(t('tax.documents.invalidFileType'));
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('tax.documents.fileTooLarge'));
        continue;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', 'TAX_DOCUMENT');

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          const newDoc: DocumentData = {
            id: data.data.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'uploaded',
          };
          addDocument(newDoc);
        } else {
          setUploadError(data.error || t('tax.documents.uploadFailed'));
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadError(t('tax.documents.uploadFailed'));
      } finally {
        setIsUploading(false);
      }
    }
  }, [t, addDocument]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [uploadFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files);
    e.target.value = ''; // Reset input
  }, [uploadFiles]);

  const getStatusBadge = (status: DocumentData['status']) => {
    switch (status) {
      case 'verified':
        return <Badge variant="default" className="bg-green-100 text-green-800">Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Uploaded</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Required Documents Info */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">
          {t('tax.documents.requiredDocuments')}
        </h4>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          {requiredDocs.map((doc, idx) => (
            <li key={idx}>{doc}</li>
          ))}
        </ul>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-gray-600">
              {t('tax.documents.dragAndDrop')}
            </p>
            <p className="text-sm text-gray-500">
              {t('tax.documents.orClickToUpload')}
            </p>
          </div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={isUploading}
          >
            {isUploading ? t('common.uploading') : t('tax.documents.selectFiles')}
          </Button>
          <p className="text-xs text-gray-400">
            PDF, JPG, PNG, Excel - Max 10MB
          </p>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {uploadError}
        </div>
      )}

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">
            {t('tax.documents.uploadedDocuments')} ({documents.length})
          </h4>
          <div className="border rounded-lg divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    {doc.fileType.includes('pdf') ? (
                      <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    ) : doc.fileType.includes('image') ? (
                      <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {doc.fileName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(doc.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Documents Notice */}
      {documents.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <p>{t('tax.documents.noDocumentsYet')}</p>
          <p className="text-sm">{t('tax.documents.documentsOptional')}</p>
        </div>
      )}
    </div>
  );
}

function getRequiredDocuments(taxType: string | null): string[] {
  switch (taxType) {
    case 'PPh21':
      return [
        'Bukti potong 1721-A1/A2',
        'Slip gaji bulanan',
        'NPWP karyawan',
      ];
    case 'PPh23':
      return [
        'Faktur pajak',
        'Bukti potong PPh 23',
        'Invoice/kwitansi',
      ];
    case 'PPh_FINAL':
      return [
        'Kontrak sewa/jual beli',
        'Bukti pembayaran',
        'SPPT PBB (untuk properti)',
      ];
    case 'PPN':
      return [
        'Faktur pajak keluaran',
        'Faktur pajak masukan',
        'Rekapitulasi penjualan',
      ];
    case 'SPT_TAHUNAN':
      return [
        'Bukti potong 1721-A1/A2',
        'Laporan keuangan',
        'Daftar harta dan kewajiban',
        'Bukti donasi (jika ada)',
      ];
    default:
      return ['Dokumen pendukung sesuai jenis pajak'];
  }
}
