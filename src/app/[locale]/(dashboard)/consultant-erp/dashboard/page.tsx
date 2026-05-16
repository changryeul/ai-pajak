import { setRequestLocale } from 'next-intl/server';
import { ErpDashboard } from '@/components/consultant-erp/ErpDashboard';

export default async function ConsultantErpDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Consultant ERP
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          고객별 업무 현황판
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          담당 고객의 월 신고 / 연 신고 진행 상황을 한 화면에서 확인합니다.
        </p>
      </header>

      <ErpDashboard locale={locale} />
    </div>
  );
}
