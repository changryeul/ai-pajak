'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BPEInfo {
  id: string;
  bpeNumber: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  receiptUrl: string | null;
}

interface BPEDownloadProps {
  filingId: string;
  bpeInfo: BPEInfo | null;
  status: string;
}

export function BPEDownload({ filingId, bpeInfo, status }: BPEDownloadProps) {
  const t = useTranslations();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!bpeInfo?.bpeNumber) return;

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/tax/filings/${filingId}/bpe`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Download error:', errorData.error);
        return;
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BPE_${bpeInfo.bpeNumber.replace(/[/\\:*?"<>|]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Not submitted yet
  if (status === 'DRAFT' || status === 'PENDING_REVIEW' || status === 'IN_REVIEW') {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-gray-600">{t('filings.bpeNotAvailable')}</p>
        <p className="text-xs text-gray-400 mt-1">{t('filings.submitFirstForBpe')}</p>
      </div>
    );
  }

  // Pending submission
  if (status === 'PENDING_SUBMISSION') {
    return (
      <div className="bg-yellow-50 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-yellow-700">{t('filings.pendingSubmission')}</p>
        <p className="text-xs text-yellow-600 mt-1">{t('filings.waitingForDjpSubmission')}</p>
      </div>
    );
  }

  // Submitted and waiting
  if (status === 'SUBMITTED' && !bpeInfo?.bpeNumber) {
    return (
      <div className="bg-blue-50 rounded-lg p-6 text-center">
        <div className="animate-pulse">
          <svg className="w-12 h-12 mx-auto text-blue-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-sm text-blue-700">{t('filings.processingSubmission')}</p>
        <p className="text-xs text-blue-600 mt-1">{t('filings.waitingForBpe')}</p>
      </div>
    );
  }

  // Rejected
  if (status === 'REJECTED') {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-red-700">{t('filings.submissionRejected')}</p>
        <p className="text-xs text-red-600 mt-1">{t('filings.pleaseCorrectAndResubmit')}</p>
      </div>
    );
  }

  // Accepted with BPE
  if ((status === 'ACCEPTED' || status === 'SUBMITTED') && bpeInfo?.bpeNumber) {
    return (
      <div className="bg-green-50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-green-900">
                {t('filings.bpeReceived')}
              </h4>
              <Badge variant="default" className="bg-green-600">
                {status === 'ACCEPTED' ? t('filings.status.accepted') : t('filings.status.submitted')}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">{t('filings.bpeNumber')}:</span>
                <span className="font-mono text-green-900">{bpeInfo.bpeNumber}</span>
              </div>
              {bpeInfo.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-green-700">{t('filings.submittedAt')}:</span>
                  <span className="text-green-900">
                    {new Date(bpeInfo.submittedAt).toLocaleDateString()}{' '}
                    {new Date(bpeInfo.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {bpeInfo.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-green-700">{t('filings.acceptedAt')}:</span>
                  <span className="text-green-900">
                    {new Date(bpeInfo.acceptedAt).toLocaleDateString()}{' '}
                    {new Date(bpeInfo.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
            <Button
              className="mt-4 w-full"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isDownloading ? t('common.loading') : t('filings.downloadBpe')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="bg-gray-50 rounded-lg p-6 text-center">
      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm text-gray-600">{t('filings.bpeNotAvailable')}</p>
    </div>
  );
}
