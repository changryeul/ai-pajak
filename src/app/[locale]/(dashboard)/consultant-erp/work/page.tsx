import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Loader2 } from 'lucide-react';
import { ErpWorkflow } from '@/components/consultant-erp/ErpWorkflow';

export default async function ConsultantErpWorkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('consultantErp');

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          {t('pageEyebrowWork')}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t('pageTitleWork')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('pageDescWork')}
        </p>
      </header>

      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('dashboard.loading')}
          </div>
        }
      >
        <ErpWorkflow />
      </Suspense>
    </div>
  );
}
