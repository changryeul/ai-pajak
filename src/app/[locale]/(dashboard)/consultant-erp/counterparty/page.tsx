import { setRequestLocale } from 'next-intl/server';
import { CounterpartyExplorer } from '@/components/consultant-erp/CounterpartyExplorer';

export default async function ConsultantErpCounterpartyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-6">
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
      <CounterpartyExplorer />
    </div>
  );
}
