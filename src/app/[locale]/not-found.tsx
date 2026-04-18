'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const params = useParams();
  const locale = (params?.locale as string) || 'id';
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="h-8 w-8 text-blue-500" />
        </div>
        <p className="text-xs font-mono text-gray-400 mb-2">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {t('errors.pageNotFoundTitle')}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {t('errors.pageNotFoundDescription')}
        </p>
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('errors.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
