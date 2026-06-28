import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Briefcase } from 'lucide-react';
import { ErpDashboard } from '@/components/consultant-erp/ErpDashboard';

export default async function ConsultantErpDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { locale } = await params;
  const { welcome } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('consultantErp');
  // 2026-06-28: /register/firm 가입자가 가입 직후 ?welcome=1 로 떨어진다.
  // 첫 화면에 한 줄 환영 + "고객 등록 → 5단계 워크플로우" 안내.
  const isWelcome = welcome === '1';

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      {isWelcome && (
        <div className="mb-6 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">{t('welcomeTitle')}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('welcomeBody')}</p>
            </div>
          </div>
        </div>
      )}
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          {t('pageEyebrowDashboard')}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleDashboard')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescDashboard')}
        </p>
      </header>

      <ErpDashboard locale={locale} />
    </div>
  );
}
