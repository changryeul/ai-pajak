'use client';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function pph22Page() {
  const t = useTranslations('pph22Page');
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-amber-900">{t('preparing')}</p>
          <p className="text-sm text-amber-700 mt-2">{t('description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
