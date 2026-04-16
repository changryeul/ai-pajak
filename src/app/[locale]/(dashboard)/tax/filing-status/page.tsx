'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowRight } from 'lucide-react';

export default function FilingStatusPage() {
  const t = useTranslations('filingStatusPlaceholder');
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="mx-auto max-w-[1100px] py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-12 text-center space-y-4">
          <p className="text-sm text-gray-500">{t('comingSoon')}</p>
          <Link href={`/${locale}/tax/monthly-dashboard`}>
            <Button>
              {t('goToMonthlyDashboard')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
