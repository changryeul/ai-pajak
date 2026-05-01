'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, Building2, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ClosingType = 'umkm' | 'normal';

const STEP_KEYS: ('upload' | 'selectType' | 'adjust' | 'generate')[] = [
  'upload', 'selectType', 'adjust', 'generate',
];

export default function AnnualClosingStartPage() {
  const t = useTranslations('annualClosing');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [selectedType, setSelectedType] = useState<ClosingType>('umkm');
  const [addons, setAddons] = useState({ tp: false, related: false, foreign: false });

  const docs = t.raw('guide.docs.items') as string[];
  const types = t.raw('guide.types.items') as string[];

  const goNext = () => {
    const route = selectedType === 'umkm' ? '/tax/annual/umkm' : '/tax/annual/pph25';
    router.push(`/${locale}${route}`);
  };

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
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STEP_KEYS.map((s, idx) => (
          <span
            key={s}
            className={cn(
              'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold',
              idx === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
            )}
          >
            {idx + 1}. {t(`steps.${s}`)}
          </span>
        ))}
        <span className="inline-flex items-center rounded-md bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
          <Sparkles className="h-3 w-3 mr-1" />
          {t('aiPerforms')}
        </span>
      </div>

      {/* Guide */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <p className="text-base font-bold text-slate-900 mb-4">{t('guide.title')}</p>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              {t('guide.timing.title')}
            </p>
            <p className="text-slate-600 mt-1 ml-6">{t('guide.timing.body')}</p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              {t('guide.docs.title')}
            </p>
            <ul className="ml-9 list-disc text-slate-600 mt-1 space-y-0.5">
              {docs.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-600" />
              {t('guide.types.title')}
            </p>
            <ul className="ml-9 list-disc text-slate-600 mt-1 space-y-0.5">
              {types.map((tp) => <li key={tp}>{tp}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Type select */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-base font-bold text-slate-900">{t('typeSelect.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('typeSelect.desc')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {(['umkm', 'normal'] as const).map((k) => {
            const isSelected = selectedType === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedType(k)}
                className={cn(
                  'text-left rounded-xl border-2 p-5 transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn('text-base font-bold', isSelected ? 'text-blue-900' : 'text-slate-900')}>
                      {t(`typeSelect.${k}.name`)}
                    </p>
                    <p className={cn('text-xs mt-1', isSelected ? 'text-blue-700' : 'text-slate-500')}>
                      {t(`typeSelect.${k}.desc`)}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">
                      {t('typeSelect.umkm.name') === t(`typeSelect.${k}.name`) ? '선택됨' : '선택됨'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Add-ons */}
        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700 mb-2">{t('typeSelect.addons.title')}</p>
          <div className="space-y-2">
            {(['tp', 'related', 'foreign'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addons[key]}
                  onChange={(e) => setAddons({ ...addons, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t(`typeSelect.addons.${key}`)}
              </label>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2 mt-6">
          <Button onClick={goNext} className="bg-slate-900 text-white hover:bg-slate-800" size="sm">
            {t('typeSelect.next')}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info(tc('comingSoon'))}>
            <Sparkles className="h-4 w-4 mr-1" />
            {t('typeSelect.ai')}
          </Button>
        </div>
      </div>
    </div>
  );
}
