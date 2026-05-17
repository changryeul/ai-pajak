import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SupervisorTeamView } from '@/components/consultant-erp/supervisor/SupervisorTeamView';

export default async function SupervisorTeamPage({
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
          Supervisor ERP
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleTeam')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescTeam')}
        </p>
      </header>
      <SupervisorTeamView />
    </div>
  );
}
