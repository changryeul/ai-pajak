import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SupervisorCustomersView } from '@/components/operator/supervisor/SupervisorCustomersView';

export default async function SupervisorCustomersPage({
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
          {t('pageTitleCustomers')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescCustomers')}
        </p>
      </header>
      <SupervisorCustomersView />
    </div>
  );
}
