import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SupervisorCoretaxView } from '@/components/operator/supervisor/SupervisorCoretaxView';

export default async function SupervisorCoretaxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('supervisorErp');

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Operator Supervisor
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleCoretax')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescCoretax')}
        </p>
      </header>
      <SupervisorCoretaxView />
    </div>
  );
}
