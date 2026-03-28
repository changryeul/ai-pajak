'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DocumentList, DocumentUploader } from '@/components/documents';
import { useSession } from '@/hooks/useSession';

export default function DocumentsPage() {
  const t = useTranslations();
  const { session } = useSession();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('documents.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('documents.description')}
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {t('documents.uploadNew')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('documents.uploadNew')}</DialogTitle>
            </DialogHeader>
            <DocumentUploader
              customerId={session?.customerId}
              onUploadComplete={() => {
                handleUploadComplete();
              }}
            />
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <DocumentList key={refreshKey} />
      </div>
    </div>
  );
}
