'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const t = useTranslations('notificationsPlaceholder');

  return (
    <div className="mx-auto max-w-[900px] py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-indigo-600" />
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-12 text-center space-y-2">
          <Bell className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">{t('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
