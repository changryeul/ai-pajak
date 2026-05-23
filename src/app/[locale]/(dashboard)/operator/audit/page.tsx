'use client';

/**
 * Audit log / change history (PDF p.22 + Phase 5/6 rich events).
 *
 * Renders every event in `case_audit_log`. Cases without explicit events get
 * a synthesized CASE_CREATED row.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface AuditRow {
  id: string;
  case_id: string;
  case_code: string | null;
  customer_name: string;
  event_type: string;
  actor_label: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const EVENT_CLS: Record<string, string> = {
  CASE_CREATED:      'bg-slate-100 text-slate-700',
  ASSIGNED:          'bg-emerald-100 text-emerald-700',
  REASSIGNED:        'bg-blue-100 text-blue-700',
  RECALLED:          'bg-rose-100 text-rose-700',
  TRANSFERRED_TO_SV: 'bg-purple-100 text-purple-700',
  BULK_TRANSFERRED:  'bg-rose-100 text-rose-700',
  APPROVED:          'bg-blue-100 text-blue-700',
  REJECTED:          'bg-rose-100 text-rose-700',
  INSTRUCTED:        'bg-amber-100 text-amber-800',
};

const KNOWN_EVENTS = Object.keys(EVENT_CLS);

export default function AuditPage() {
  const t = useTranslations('operatorAudit');
  const locale = useLocale();
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const fmtTs = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  const eventLabel = (ev: string): string => {
    try { return t(`event.${ev}`); } catch { return ev; }
  };

  const summarizePayload = (event: string, p: Record<string, unknown> | null): string => {
    if (!p || Object.keys(p).length === 0) return '';
    switch (event) {
      case 'ASSIGNED':
      case 'REASSIGNED':
        return p.mode ? t('summary.modePrefix', { mode: String(p.mode) }) : '';
      case 'RECALLED':
        return p.reason ? t('summary.reasonPrefix', { reason: String(p.reason) }) : '';
      case 'TRANSFERRED_TO_SV':
        return t('summary.supervisorChange');
      case 'BULK_TRANSFERRED':
        if (p.mode === 'operator') return t('summary.bulkOperator');
        if (p.mode === 'supervisor') return t('summary.bulkSupervisor');
        return t('summary.bulkGeneric');
      case 'APPROVED':
        return p.note ? t('summary.memoPrefix', { note: String(p.note) }) : '';
      case 'REJECTED':
        return p.reason ? t('summary.reasonPrefix', { reason: String(p.reason) }) : '';
      case 'INSTRUCTED':
        return p.note ? t('summary.instructPrefix', { note: String(p.note) }) : '';
      default:
        return '';
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/audit?limit=300');
      const j = await r.json();
      if (j.success) setItems(j.data.items as AuditRow[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? items : items.filter(i => i.event_type === filter);

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1200px]">
      <PageTitle title={t('pageTitle')} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">{t('pageTitle')}</h1>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>{t('filterAll', { n: items.length })}</FilterChip>
        {KNOWN_EVENTS.map(ev => {
          const count = items.filter(i => i.event_type === ev).length;
          if (count === 0) return null;
          return (
            <FilterChip key={ev} active={filter === ev} onClick={() => setFilter(ev)}>
              {eventLabel(ev)} {count}
            </FilterChip>
          );
        })}
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(e => {
              const cls = EVENT_CLS[e.event_type] ?? 'bg-slate-100 text-slate-700';
              const summary = summarizePayload(e.event_type, e.payload);
              return (
                <li key={e.id} className="grid grid-cols-[110px_120px_1fr_140px] items-start gap-3 px-2 py-3">
                  <span className="text-[11px] text-slate-400 font-mono">{fmtTs(e.created_at)}</span>
                  <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{eventLabel(e.event_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {e.case_code ?? '—'} · {e.customer_name}
                    </p>
                    {summary && <p className="text-[11px] text-slate-500 mt-0.5">{summary}</p>}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate text-right">{e.actor_label ?? 'system'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}
