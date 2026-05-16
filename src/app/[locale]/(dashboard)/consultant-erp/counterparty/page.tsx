import { setRequestLocale } from 'next-intl/server';

export default async function ConsultantErpCounterpartyPage({
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
          Consultant ERP · 공동 거래처 DB
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Counterparty Master
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          원천세 판단에 필요한 거래처 정보, 증빙자료, 신뢰도, 등재 후보를
          tax_partner 간 공유합니다.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700">P0 골격</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Phase 4에서 거래처 검색 + 신뢰도/필드별 출처 패널 + 업데이트 후보 +
          신규 등록 UI가 들어옵니다. 데이터는{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            counterparty_master
          </code>{' '}
          (cross-tenant 공유) +{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            counterparty_attribute_trust
          </code>{' '}
          +{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            counterparty_update_candidate
          </code>{' '}
          3 테이블입니다.
        </p>
      </div>
    </div>
  );
}
