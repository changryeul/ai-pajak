'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type CategoryId =
  | 'quickStart' | 'monthly' | 'annual' | 'upload'
  | 'counterparty' | 'history' | 'billing' | 'integration' | 'security';

const SIDEBAR_KEYS: CategoryId[] = [
  'quickStart', 'monthly', 'annual', 'upload',
  'counterparty', 'history', 'billing', 'integration', 'security',
];

const TAB_KEYS: (CategoryId | 'faq')[] = [
  'quickStart', 'monthly', 'annual', 'upload',
  'counterparty', 'history', 'billing', 'integration', 'security', 'faq',
];

const STEP_KEYS: ('gettingStarted' | 'byTopic' | 'dataUpload' | 'troubleshoot')[] = [
  'gettingStarted', 'byTopic', 'dataUpload', 'troubleshoot',
];

export default function HelpPage() {
  const t = useTranslations('helpPage');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [active, setActive] = useState<CategoryId>('quickStart');
  const [query, setQuery] = useState('');

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

      {/* Hero */}
      <div className="rounded-2xl bg-slate-900 p-7 md:p-9 text-white mb-6">
        <p className="text-slate-400 text-sm mb-2">{t('hero.label')}</p>
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{t('hero.title')}</h2>
        <p className="text-slate-300 text-sm mt-3 max-w-4xl">{t('hero.subtitle')}</p>
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('hero.searchPlaceholder')}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pl-11 h-11"
          />
        </div>
      </div>

      {/* Quick entries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(['onboarding', 'monthly', 'annual', 'withholding'] as const).map((k) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">{t(`quickEntries.${k}.title`)}</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{t(`quickEntries.${k}.body`)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TAB_KEYS.map((tb) => {
          const isFaq = tb === 'faq';
          const isActive = !isFaq && active === tb;
          return (
            <button
              key={tb}
              onClick={() => { if (!isFaq) setActive(tb as CategoryId); }}
              className={cn(
                'rounded-md px-4 py-2 text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {t(`tabs.${tb}`)}
            </button>
          );
        })}
      </div>

      {/* Body: sidebar + content */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500 mb-3 px-2">{t('sidebarHeader')}</p>
          <ul className="space-y-1">
            {SIDEBAR_KEYS.map((k) => (
              <li key={k}>
                <button
                  onClick={() => setActive(k)}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active === k
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {t(`tabs.${k}`)}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-base font-bold text-slate-900">{t(`categories.${active}.title`)}</p>
          <p className="text-sm text-slate-500 mt-1">{t(`categories.${active}.subtitle`)}</p>

          <ul className="space-y-2 mt-5">
            {(t.raw(`categories.${active}.items`) as string[]).map((item) => (
              <li
                key={item}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
