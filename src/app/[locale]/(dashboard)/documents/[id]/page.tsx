'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DocumentDetail {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null;
  ocrData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    fullName: string;
    companyName: string | null;
    npwp: string | null;
  };
  taxFiling?: {
    id: string;
    taxType: string;
    taxPeriod: string;
    status: string;
  };
}

const DOCUMENT_TYPES = [
  { value: 'TAX_DOCUMENT', label: 'Tax Document' },
  { value: 'BUKTI_POTONG', label: 'Bukti Potong' },
  { value: 'FAKTUR_PAJAK', label: 'Faktur Pajak' },
  { value: 'LAPORAN_KEUANGAN', label: 'Laporan Keuangan' },
  { value: 'KTP', label: 'KTP' },
  { value: 'NPWP_CARD', label: 'Kartu NPWP' },
  { value: 'POA_DRAFT', label: 'Draft Surat Kuasa' },
  { value: 'OTHER', label: 'Other' },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const routeParams = useParams();
  const locale = routeParams.locale as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();

      if (data.success) {
        setDocument(data.data);

        // Get preview URL
        if (data.data.fileType.includes('image') || data.data.fileType.includes('pdf')) {
          const downloadRes = await fetch(`/api/documents/${id}/download`);
          const downloadData = await downloadRes.json();
          if (downloadData.success) {
            setPreviewUrl(downloadData.data.downloadUrl);
          }
        }
      } else {
        setError(data.error || 'Failed to load document');
      }
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Failed to load document');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${id}/download`);
      const data = await response.json();

      if (data.success) {
        window.open(data.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleUpdateType = async (newType: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: newType }),
      });
      const data = await response.json();

      if (data.success) {
        setDocument((prev) => prev ? { ...prev, documentType: newType } : null);
      }
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('documents.confirmDelete'))) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        router.push(`/${locale}/documents`);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryOCR = async () => {
    try {
      const response = await fetch(`/api/documents/${id}/ocr`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        fetchDocument();
      }
    } catch (err) {
      console.error('OCR retry error:', err);
    }
  };

  // Create transaction from OCR data
  const handleCreateTransaction = () => {
    if (!document?.ocrData) return;
    const ocr = document.ocrData;

    const params = new URLSearchParams();
    if (ocr.grossAmount) params.set('amount', String(ocr.grossAmount));
    if (ocr.entityName) params.set('counterparty', String(ocr.entityName));
    if (ocr.npwp) params.set('npwp', String(ocr.npwp));

    window.location.href = `/${locale}/tax/spt-masa?${params.toString()}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getOcrStatusBadge = (status: DocumentDetail['ocrStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">OCR Complete</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary">Processing</Badge>;
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">No OCR</Badge>;
    }
  };

  const renderPreview = () => {
    if (!document || !previewUrl) {
      return (
        <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <p className="text-gray-500">{t('documents.noPreviewAvailable')}</p>
          </div>
        </div>
      );
    }

    if (document.fileType.includes('image')) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={document.fileName}
            className="max-w-full max-h-[500px] object-contain"
          />
        </div>
      );
    }

    if (document.fileType.includes('pdf')) {
      return (
        <div className="w-full h-[600px] bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={previewUrl}
            title={document.fileName}
            className="w-full h-full"
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-gray-500">{t('documents.noPreviewAvailable')}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-red-500">{error || 'Document not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('common.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{document.fileName}</h1>
            <p className="text-gray-500">{formatFileSize(document.fileSize)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t('common.download')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t('common.loading') : t('common.delete')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            {renderPreview()}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          {/* Document Info */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {t('documents.documentInfo')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">{t('documents.type')}</label>
                <Select
                  value={document.documentType}
                  onValueChange={handleUpdateType}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1">
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
              <div>
                <label className="text-sm text-gray-500">{t('documents.fileType')}</label>
                <p className="font-medium">{document.fileType}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('documents.uploadDate')}</label>
                <p className="font-medium">
                  {new Date(document.createdAt).toLocaleDateString()} {new Date(document.createdAt).toLocaleTimeString()}
                </p>
              </div>
              {document.updatedAt !== document.createdAt && (
                <div>
                  <label className="text-sm text-gray-500">{t('documents.lastModified')}</label>
                  <p className="font-medium">
                    {new Date(document.updatedAt).toLocaleDateString()} {new Date(document.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          {document.customer && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('documents.customer')}
              </h3>
              <div className="space-y-2">
                <p className="font-medium">
                  {document.customer.companyName || document.customer.fullName}
                </p>
                {document.customer.npwp && (
                  <p className="text-sm text-gray-500">
                    NPWP: {document.customer.npwp}
                  </p>
                )}
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600"
                  onClick={() => router.push(`/${locale}/customers/${document.customer?.id}`)}
                >
                  {t('documents.viewCustomer')}
                </Button>
              </div>
            </div>
          )}

          {/* Tax Filing Info */}
          {document.taxFiling && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('documents.taxFiling')}
              </h3>
              <div className="space-y-2">
                <p className="font-medium">{document.taxFiling.taxType}</p>
                <p className="text-sm text-gray-500">
                  {t('tax.taxPeriod')}: {document.taxFiling.taxPeriod}
                </p>
                <Badge variant="outline">{document.taxFiling.status}</Badge>
                <div className="pt-2">
                  <Button
                    variant="link"
                    className="p-0 h-auto text-blue-600"
                    onClick={() => router.push(`/${locale}/filings/${document.taxFiling?.id}`)}
                  >
                    {t('documents.viewFiling')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* OCR Status */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">
                {t('documents.ocrStatus')}
              </h3>
              {getOcrStatusBadge(document.ocrStatus)}
            </div>

            {document.ocrStatus === 'COMPLETED' && document.ocrData ? (
              <div>
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-48">
                    {JSON.stringify(document.ocrData, null, 2)}
                  </pre>
                </div>
                <Button size="sm" onClick={handleCreateTransaction} className="bg-indigo-600 hover:bg-indigo-700">
                  {t('documents.createSptTransaction')}
                </Button>
              </div>
            ) : document.ocrStatus === 'PROCESSING' ? (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">{t('documents.processing')}</span>
              </div>
            ) : document.ocrStatus === 'FAILED' ? (
              <div>
                <p className="text-sm text-red-600 mb-2">{t('documents.ocrFailed')}</p>
                <Button variant="outline" size="sm" onClick={handleRetryOCR}>
                  {t('documents.retryOcr')}
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-2">{t('documents.noOcrData')}</p>
                <Button variant="outline" size="sm" onClick={handleRetryOCR}>
                  {t('documents.runOcr')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
