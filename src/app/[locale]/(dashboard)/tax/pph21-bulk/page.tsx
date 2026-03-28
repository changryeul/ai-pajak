'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PPh21BulkCalculator } from '@/components/tax/PPh21BulkCalculator';

export default function PPh21BulkPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations('pages');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('pph21BulkTitle')}</h1>
        <p className="text-gray-500 mt-1">
          {t('pph21BulkDesc')}
        </p>
      </div>

      <PPh21BulkCalculator />
    </div>
  );
}
