'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const STEP_KEYS: ('aggregate' | 'generate' | 'submit')[] = ['aggregate', 'generate', 'submit'];

export default function SPT1771Page() {
  const t = useTranslations('spt1771Page');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('pageTitle')}</h1>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {t('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {t(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          size="sm"
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => toast.info(tc('comingSoon'))}
        >
          {t('cta.generate')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info(tc('invoiceComing'))}
        >
          {t('cta.pdf')}
        </Button>
      </div>

      {/* Empty body */}
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        {t('empty')}
      </div>
    </div>
  );
}
