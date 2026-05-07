'use client';

/**
 * 이력 — index landing.
 * lastCase가 있으면 즉시 /operator/history/[id]로 점프, 없으면 케이스 카드 그리드.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING:            { text: '대기',       cls: 'bg-slate-100 text-slate-600' },
  DATA_REVIEW:        { text: '검토중',     cls: 'bg-indigo-100 text-indigo-700' },
  PENDING_APPROVAL:   { text: '승인요청',   cls: 'bg-violet-100 text-violet-700' },
  APPROVED:           { text: '승인완료',   cls: 'bg-emerald-100 text-emerald-700' },
  EBILLING_GENERATED: { text: 'ID Billing', cls: 'bg-blue-100 text-blue-700' },
  COMPLETED:          { text: '신고완료',   cls: 'bg-emerald-100 text-emerald-700' },
};

export default function OperatorHistoryLandingPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
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
          router.replace(`/${locale}/operator/history/${last.id}`);
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
    router.push(`/${locale}/operator/history/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div>
      <PageTitle title="이력 — 고객 선택" />
      <h1 className="mb-1 text-2xl font-black text-slate-900">상담 / 처리 이력</h1>
      <p className="mb-6 text-sm text-slate-500">조회할 케이스를 선택하세요. 케이스별 + 회사별 + 내 고객 전체 타임라인을 한 곳에서 봅니다.</p>

      {items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          배정된 케이스가 없습니다.
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(c => {
            const s = STATUS_LABEL[c.status] ?? { text: c.status, cls: 'bg-slate-100 text-slate-600' };
            return (
              <li key={c.id}>
                <button
                  onClick={() => pickCase(c)}
                  className="w-full rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-blue-200"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{c.customer.name}</h3>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.cls)}>{s.text}</span>
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
