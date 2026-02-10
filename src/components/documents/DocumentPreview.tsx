'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null;
  ocrData: Record<string, unknown> | null;
  createdAt: string;
  storageUrl: string;
  customer?: {
    id: string;
    fullName: string;
    companyName: string | null;
  };
}

interface DocumentPreviewProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

export function DocumentPreview({ documentId, open, onClose }: DocumentPreviewProps) {
  const t = useTranslations();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}`);
      const data = await response.json();

      if (data.success) {
        setDocument(data.data);

        // Get preview URL for images and PDFs
        if (data.data.fileType.includes('image') || data.data.fileType.includes('pdf')) {
          const downloadRes = await fetch(`/api/documents/${documentId}/download`);
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
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) {
      fetchDocument();
    }
  }, [open, documentId, fetchDocument]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getOcrStatusBadge = (status: DocumentData['ocrStatus']) => {
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

  const handleDownload = async () => {
    if (!document) return;

    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      const data = await response.json();

      if (data.success) {
        window.open(data.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const renderPreview = () => {
    if (!document || !previewUrl) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
          <p className="text-gray-500">{t('documents.noPreviewAvailable')}</p>
        </div>
      );
    }

    if (document.fileType.includes('image')) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={previewUrl}
            alt={document.fileName}
            className="max-w-full max-h-[400px] object-contain"
          />
        </div>
      );
    }

    if (document.fileType.includes('pdf')) {
      return (
        <div className="w-full h-[500px] bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={previewUrl}
            title={document.fileName}
            className="w-full h-full"
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-gray-500">{t('documents.noPreviewAvailable')}</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            {t('common.download')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{document?.fileName || t('documents.documentPreview')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchDocument}>
              {t('common.retry')}
            </Button>
          </div>
        ) : document ? (
          <div className="space-y-6">
            {/* Preview */}
            {renderPreview()}

            {/* Document Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">{t('documents.type')}</p>
                <p className="font-medium">{document.documentType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('documents.size')}</p>
                <p className="font-medium">{formatFileSize(document.fileSize)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('documents.uploadDate')}</p>
                <p className="font-medium">
                  {new Date(document.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('documents.ocrStatus')}</p>
                <div className="mt-1">{getOcrStatusBadge(document.ocrStatus)}</div>
              </div>
              {document.customer && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">{t('documents.customer')}</p>
                  <p className="font-medium">
                    {document.customer.companyName || document.customer.fullName}
                  </p>
                </div>
              )}
            </div>

            {/* OCR Data */}
            {document.ocrStatus === 'COMPLETED' && document.ocrData && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">
                  {t('documents.extractedData')}
                </h4>
                <pre className="text-sm text-blue-800 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(document.ocrData, null, 2)}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
              <Button onClick={handleDownload}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('common.download')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
