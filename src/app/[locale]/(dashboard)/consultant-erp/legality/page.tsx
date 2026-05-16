import { setRequestLocale } from 'next-intl/server';

export default async function ConsultantErpLegalityPage({
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
          Consultant ERP · 리갈리티 자료
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          고객 법인 기본자료 보관함
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Akta Pendirian / Akta Perubahan / NIB-OSS / 자격증·라이센스 / 회사 NPWP /
          Coretax 접속정보를 카테고리별로 보관하고 유효기간을 관리합니다.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700">P0 골격</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Phase 5에서 카테고리 grid + 업로드/추가업로드/미리보기 + 유효기간
          datepicker UI가 들어옵니다. 데이터는{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            legality_document
          </code>{' '}
          테이블입니다.
        </p>
      </div>
    </div>
  );
}
