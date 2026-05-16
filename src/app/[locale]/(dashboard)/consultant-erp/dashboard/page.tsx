import { setRequestLocale } from 'next-intl/server';

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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700">P0 골격</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이 페이지는 Phase 1에서 4 통계 카드 + 고객별 행 테이블 + ACTION
          버튼으로 채워집니다. 데이터 소스는{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            GET /api/consultant-erp/sessions/board?consultantId=me
          </code>{' '}
          엔드포인트입니다.
        </p>
      </div>
    </div>
  );
}
