import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function ConsultantErpWorkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('consultantErp');

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          {t('pageEyebrowWork')}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleWork')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescWork')}
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700">{t('workflow.p0Title')}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('workflow.p0Body')}
        </p>
      </div>
    </div>
  );
}
