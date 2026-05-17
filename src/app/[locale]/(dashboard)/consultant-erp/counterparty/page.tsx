import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CounterpartyExplorer } from '@/components/consultant-erp/CounterpartyExplorer';

export default async function ConsultantErpCounterpartyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('consultantErp');

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          {t('pageEyebrowCounterparty')}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleCounterparty')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescCounterparty')}
        </p>
      </header>
      <CounterpartyExplorer />
    </div>
  );
}
