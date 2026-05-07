'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface MyCase {
  id: string;
  case_code: string | null;
  service_label: string;
  customer: { name: string };
  status: string;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  EBILLING_GENERATED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

export default function CoretaxLandingPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.landing');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const [items, setItems] = useState<MyCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/operator/my-cases');
      const j = await r.json();
      if (j.success) setItems(j.data.items as MyCase[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('aip.operator.lastCase');
      if (raw) {
        const last = JSON.parse(raw) as { id?: string };
        if (last?.id) {
          router.replace(`/${locale}/operator/coretax/${last.id}`);
          return;
        }
      }
    } catch { /* ignore */ }
    load();
  }, [load, router, locale]);

  const pickCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer.name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/coretax/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      <PageTitle title={t('coretaxTitle')} />
      <h1 className="mb-1 text-2xl font-black text-slate-900">{t('coretaxTitle')}</h1>
      <p className="mb-6 text-sm text-slate-500">{t('coretaxSubtitle')}</p>

      {items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          {t('noCases')}
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(c => {
            const cls = STATUS_CLASS[c.status] ?? 'bg-slate-100 text-slate-600';
            return (
              <li key={c.id}>
                <button
                  onClick={() => pickCase(c)}
                  className="w-full rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-blue-200"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{c.customer.name}</h3>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>{tStatus(c.status as 'PENDING')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{c.case_code ?? '—'} · {c.service_label}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
