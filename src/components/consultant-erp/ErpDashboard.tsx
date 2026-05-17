'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BoardCustomer, BoardStats } from '@/lib/consultant-erp/session-helpers';

interface Resp {
  success: boolean;
  data?: { stats: BoardStats; rows: BoardCustomer[] };
  error?: string;
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  UPLOADING: 'bg-blue-100 text-blue-700',
  PARSING: 'bg-indigo-100 text-indigo-700',
  REVIEWING: 'bg-amber-100 text-amber-700',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  COMPLETED: 'bg-emerald-600 text-white',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

export function ErpDashboard({ locale }: { locale: string }) {
  const t = useTranslations('consultantErp');
  const [data, setData] = useState<Resp['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/consultant-erp/sessions/board')
      .then((r) => r.json())
      .then((j: Resp) => {
        if (!j.success || !j.data) setError(j.error || 'Failed');
        else setData(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('dashboard.loading')}
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-rose-600">{t('dashboard.errorPrefix')}: {error ?? t('dashboard.errorEmpty')}</p>;
  }

  const { stats, rows } = data;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalCustomers')} value={stats.totalCustomers} />
        <StatCard label={t('dashboard.activeCustomers')} value={stats.activeCustomers} tone="text-blue-700" />
        <StatCard label={t('dashboard.uploadedSessions')} value={stats.uploadedSessions} tone="text-emerald-700" />
        <StatCard label={t('dashboard.reviewedSessions')} value={stats.reviewedSessions} tone="text-violet-700" />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {t('dashboard.boardHeading')}
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            {t('dashboard.boardEmpty')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">{t('dashboard.thCustomer')}</th>
                <th className="px-5 py-3 text-left">{t('dashboard.thAssignee')}</th>
                <th className="px-5 py-3 text-left">{t('dashboard.thProgress')}</th>
                <th className="px-5 py-3 text-left">{t('dashboard.thDocStatus')}</th>
                <th className="px-5 py-3 text-right">{t('dashboard.thAction')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 align-top">
                    <p className="font-bold text-slate-950">{r.customerName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.customerType === 'COMPANY' ? t('customerType.COMPANY') : t('customerType.INDIVIDUAL')}
                      {r.npwp ? ` · ${r.npwp}` : ''}
                    </p>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <p className="text-slate-700">{r.consultantName ?? '—'}</p>
                    {r.supervisorName && (
                      <p className="mt-0.5 text-xs text-slate-500">{t('dashboard.supervisorPrefix')} {r.supervisorName}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top">
                    {r.status ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_TONE[r.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {r.filingKind === 'ANNUAL' ? t('filingKind.ANNUAL_SHORT') : t('filingKind.MONTHLY_SHORT')} · {r.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{t('dashboard.sessionNone')}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top text-xs text-slate-600">
                    {t('dashboard.docStatusSummary', { up: r.uploadCount, parsed: r.parsedCount, reviewed: r.reviewedCount })}
                  </td>
                  <td className="px-5 py-3 align-top text-right">
                    <Link
                      href={{
                        pathname: `/${locale}/consultant-erp/work`,
                        query: { customerId: r.customerId, sessionId: r.sessionId ?? undefined },
                      }}
                      className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-slate-800"
                    >
                      {t('dashboard.openCustomer')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-3 text-4xl font-black ${tone ?? 'text-slate-950'}`}>{value}</p>
    </div>
  );
}
