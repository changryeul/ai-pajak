import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SupervisorApprovalDetail } from '@/components/operator/supervisor/SupervisorApprovalDetail';

export default async function SupervisorApprovalDetailPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('supervisorErp');

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-6">
        <Link
          href={`/${locale}/operator/supervisor/approval`}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          {t('backToList')}
        </Link>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Operator Supervisor
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleApproval')}
        </h1>
      </header>
      <SupervisorApprovalDetail sessionId={sessionId} />
    </div>
  );
}
