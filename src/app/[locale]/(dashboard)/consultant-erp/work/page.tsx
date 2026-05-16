import { setRequestLocale } from 'next-intl/server';

export default async function ConsultantErpWorkPage({
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
          Consultant ERP · 업무처리
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          5단계 신고 워크플로우
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          고객선택 → 자료업로드 → 파싱검토/자동계산 → 수퍼바이저 승인 → Coretax 기록.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700">P0 골격</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Phase 1에서 5-step navigator + 6 자료 슬롯 업로드 + supervisor 결재 +
          Coretax 수기 기록 UI가 들어옵니다. 데이터 모델은{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            consultant_session
          </code>{' '}
          + 5 자식 테이블입니다.
        </p>
      </div>
    </div>
  );
}
