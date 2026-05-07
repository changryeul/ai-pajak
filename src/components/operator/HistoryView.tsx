'use client';

/**
 * 상담/처리 이력 화면 — PDF p.12-13. 5 locales 다국어.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface MyCase {
  id: string;
  case_code: string | null;
  service_label: string | null;
  status: string;
  priority: string | null;
  customer_name: string;
}

interface TimelineEvent {
  id: string;
  case_id: string;
  case_code: string | null;
  customer_name?: string;
  kind: 'case-audit' | 'coretax-step' | 'system' | 'customer-ntpn';
  event: string;
  label: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  at: string;
}

interface CompanyCase {
  id: string;
  case_code: string | null;
  service_label: string;
  status: string;
  priority: string | null;
  operator: string | null;
  ebilling: string | null;
  bpe: string | null;
  completed_at: string | null;
}

interface HistoryData {
  case: { id: string; case_code: string | null; status: string; priority: string | null; service_label: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  kpi: { customerName: string; messages: number; docRequests: number; processLogs: number; companyTotal: number };
  timeline: TimelineEvent[];
  companyCases: CompanyCase[];
  companyTimeline: TimelineEvent[];
  myRecentTimeline: TimelineEvent[];
  myCases: MyCase[];
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PENDING_DOCS: 'bg-amber-100 text-amber-700',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  EBILLING_GENERATED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

const KIND_CLASS: Record<TimelineEvent['kind'], string> = {
  'case-audit': 'bg-blue-100 text-blue-700',
  'coretax-step': 'bg-violet-100 text-violet-700',
  'system': 'bg-slate-100 text-slate-700',
  'customer-ntpn': 'bg-amber-100 text-amber-800',
};

const fmtTs = (iso: string) => new Date(iso).toLocaleString();

const summarizePayload = (e: TimelineEvent): string => {
  if (!e.payload) return '';
  const p = e.payload as Record<string, unknown>;
  if (e.event === 'CUSTOMER_NTPN') {
    return [String(p.ntpn ?? ''), p.file ? `${String(p.file)}` : ''].filter(Boolean).join('\n');
  }
  if (e.event === 'INSTRUCTED') {
    if (typeof p.invoice === 'string') return `${p.invoice}`;
    if (typeof p.note === 'string') return p.note;
  }
  if (e.event === 'APPROVED' && typeof p.note === 'string') return `${p.note}`;
  if (e.event === 'REJECTED' && typeof p.reason === 'string') return `${p.reason}`;
  if (e.kind === 'coretax-step') {
    if (typeof p.billingId === 'string') return `Billing: ${p.billingId}`;
    if (typeof p.bpeNumber === 'string') return `BPE: ${p.bpeNumber}`;
    if (typeof p.ntpn === 'string') return `NTPN: ${p.ntpn}`;
    if (typeof p.note === 'string') return p.note;
    if (typeof p.key === 'string' && typeof p.state === 'string') return `${p.key} → ${p.state}`;
  }
  return '';
};

export function HistoryView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.history');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const tEvent = useTranslations('operatorStaff.eventLabel');
  const [d, setD] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/history`);
      const j = await r.json();
      if (j.success) setD(j.data as HistoryData);
    } finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!d) return;
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: d.case.id, case_code: d.case.case_code,
        customer_name: d.customer?.company_name || d.customer?.full_name || '—',
        status: d.case.status,
      }));
    } catch { /* ignore */ }
  }, [d]);

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/history/${c.id}`);
  };

  const kindLabel = (k: TimelineEvent['kind']): string => {
    switch (k) {
      case 'case-audit': return t('kindCaseAudit');
      case 'coretax-step': return t('kindCoretax');
      case 'system': return t('kindSystem');
      case 'customer-ntpn': return t('kindCustomerNtpn');
    }
  };

  const eventLabel = (ev: string): string => {
    try { return tEvent(ev as 'CASE_CREATED'); } catch { return ev; }
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">{t('loadFailed')}</div>;

  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const companyId = `CL-${d.customer?.id?.slice(0, 4).toUpperCase() ?? '----'}`;

  return (
    <div>
      <PageTitle title={`${t('pageTitlePrefix')} ${customerName}`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-sm font-black text-slate-900">{t('myCustomers')}</h2>
          <ul className="space-y-1.5">
            {d.myCases.length === 0 ? (
              <li className="px-2 py-2 text-xs text-slate-400">{t('noCustomers')}</li>
            ) : d.myCases.map(c => {
              const sel = c.id === d.case.id;
              const sCls = STATUS_CLASS[c.status] ?? 'bg-slate-100 text-slate-600';
              return (
                <li key={c.id}>
                  <button
                    onClick={() => switchCase(c)}
                    className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition',
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white hover:bg-slate-50')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-black', sel ? 'text-white' : 'text-slate-900')}>{c.customer_name}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', sel ? 'bg-white/20 text-white' : sCls)}>{tStatus(c.status as 'PENDING')}</span>
                    </div>
                    <p className={cn('mt-0.5 text-[10px]', sel ? 'text-white/70' : 'text-slate-500')}>{c.case_code ?? '—'} · {c.service_label}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="space-y-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">{t('title')}</h2>
                <p className="text-xs text-slate-500">{t('subtitle')}</p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                {tStatus(d.case.status as 'PENDING')}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <Kpi label={t('kpiSelected')}     value={d.kpi.customerName} truncate />
              <Kpi label={t('kpiMessages')}     value={`${d.kpi.messages}`} highlight />
              <Kpi label={t('kpiDocRequests')}  value={`${d.kpi.docRequests}`} />
              <Kpi label={t('kpiProcessLogs')}  value={`${d.kpi.processLogs}`} />
              <Kpi label={t('kpiCompanyTotal')} value={`${d.kpi.companyTotal}`} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('detailTitle', { name: customerName })}</h3>
            <Timeline events={d.timeline} kindLabel={kindLabel} eventLabel={eventLabel} emptyText={t('emptyEvents')} />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('companyTitle', { name: customerName })}</h3>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <Kpi label={t('kpiCompanyId')}    value={companyId} mono />
              <Kpi label={t('kpiRelatedCases')} value={`${d.companyCases.length}`} />
              <Kpi label={t('kpiCumulative')}   value={`${d.companyTimeline.length}`} />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500">
                    <th className="px-2 py-2">{t('tableCase')}</th>
                    <th className="px-2 py-2">{t('tableService')}</th>
                    <th className="px-2 py-2">{t('tableStatus')}</th>
                    <th className="px-2 py-2">{t('tableOperator')}</th>
                    <th className="px-2 py-2">{t('tableBilling')}</th>
                    <th className="px-2 py-2">{t('tableNtpn')}</th>
                    <th className="px-2 py-2">{t('tableFiledAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.companyCases.map(c => {
                    const cls = STATUS_CLASS[c.status] ?? 'bg-slate-100 text-slate-600';
                    return (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700">{c.case_code ?? '—'}</td>
                        <td className="px-2 py-2 text-[11px] text-slate-700">{c.service_label}</td>
                        <td className="px-2 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>{tStatus(c.status as 'PENDING')}</span></td>
                        <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{c.operator ?? '—'}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{c.ebilling ?? '—'}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{c.bpe ?? '—'}</td>
                        <td className="px-2 py-2 text-[11px] text-slate-600">{c.completed_at ? new Date(c.completed_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                  {d.companyCases.length === 0 && (
                    <tr><td colSpan={7} className="px-2 py-6 text-center text-[11px] text-slate-400">{t('tableEmpty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Timeline events={d.companyTimeline} kindLabel={kindLabel} eventLabel={eventLabel} emptyText={t('emptyEvents')} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('myRecentTitle')}</h3>
            {d.myRecentTimeline.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[11px] text-slate-400">{t('emptyRecent')}</p>
            ) : (
              <ul className="space-y-2">
                {d.myRecentTimeline.slice(0, 30).map(e => (
                  <li key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black text-slate-900">
                        {e.customer_name ?? '—'} <span className="text-slate-400 font-bold">· {e.case_code ?? '—'}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">{fmtTs(e.at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[9px] font-bold', KIND_CLASS[e.kind])}>
                        {kindLabel(e.kind)}
                      </span>
                      <span className="text-[11px] text-slate-700">{eventLabel(e.event)}</span>
                    </div>
                    {summarizePayload(e) && (
                      <p className="mt-0.5 text-[10px] text-slate-500 whitespace-pre-line">{summarizePayload(e)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Timeline({ events, kindLabel, eventLabel, emptyText }: {
  events: TimelineEvent[];
  kindLabel: (k: TimelineEvent['kind']) => string;
  eventLabel: (e: string) => string;
  emptyText: string;
}) {
  if (events.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[11px] text-slate-400">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {events.map(e => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
            <span className="mt-0.5 h-full w-px bg-slate-200" />
          </div>
          <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', KIND_CLASS[e.kind])}>{kindLabel(e.kind)}</span>
              <span className="text-[10px] text-slate-400">{fmtTs(e.at)}</span>
            </div>
            <p className="mt-1 text-[12px] font-bold text-slate-900">{eventLabel(e.event)}</p>
            {summarizePayload(e) && <p className="text-[11px] text-slate-500 whitespace-pre-line">{summarizePayload(e)}</p>}
            {e.actor && <p className="mt-0.5 text-[10px] text-slate-400">{e.actor}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, highlight, truncate, mono }: { label: string; value: string; highlight?: boolean; truncate?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn(
        'mt-0.5 font-black',
        truncate && 'truncate text-sm',
        !truncate && 'text-base',
        mono && 'font-mono text-sm',
        highlight ? 'text-blue-600' : 'text-slate-800',
      )}>{value}</p>
    </div>
  );
}
