import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SupervisorSettingsView } from '@/components/consultant-erp/supervisor/SupervisorSettingsView';

export default async function SupervisorSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('supervisorErp');

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Supervisor ERP
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleSettings')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescSettings')}
        </p>
      </header>
      <SupervisorSettingsView />
    </div>
  );
}
