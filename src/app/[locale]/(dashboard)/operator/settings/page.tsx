'use client';

/**
 * Operator settings / form versions / Tax Code Rules (PDF p.23).
 *
 * 3 header cards (fiscal year / platform / Coretax status) + Badan Form
 * Profile + OP Form Profile. Static informational page for now — to be
 * extended with real rulesets + Coretax API toggle in a later phase.
 */

import { useTranslations } from 'next-intl';
import { PageTitle } from '@/components/layout/PageTitle';

export default function OperatorSettingsPage() {
  const t = useTranslations('operatorSettings');
  return (
    <div className="container mx-auto py-6 px-4 max-w-[1200px]">
      <PageTitle title={t('pageTitle')} />
      <h1 className="text-2xl font-black text-slate-900 mb-4">{t('pageHeading')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Header label={t('header.fiscalYear')} value="2025" />
        <Header label={t('header.platform')} value="Coretax DJP" />
        <Header label={t('header.coretaxStatus')} value={t('header.coretaxStatusValue')} tone="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">{t('badan.title')}</h2>
          <p className="text-sm text-slate-700 mt-2">{t('badan.desc')}</p>
          <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
            {t('badan.legacy')}
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">{t('op.title')}</h2>
          <p className="text-sm text-slate-700 mt-2">{t('op.desc')}</p>
          <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
            {t('op.legacy')}
          </p>
        </section>
      </div>
    </div>
  );
}

function Header({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-base font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
