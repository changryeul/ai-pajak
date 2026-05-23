'use client';

/**
 * Approval queue (PDF p.7)
 *
 * Left: PENDING_APPROVAL case list
 * Right: selected case detail + approve/reject box + operator instruction + review snapshot table
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, Send, XCircle } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  service_label: string | null;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | null;
  due_date: string | null;
  customer: { full_name: string; company_name: string | null } | null;
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
}

interface SnapshotItem { state: string; invoice: string; vendor: string; taxKind: string; taxCode: string; tax: number }
interface SnapshotData { items?: SnapshotItem[]; reviewRequired?: number; generatedAt?: string }

interface CaseDetail extends CaseRow {
  notes: string | null;
  review_summary: SnapshotData | null;
}

// Snapshot state values come from the backend in Korean (legacy) — map to
// CSS class + safe i18n key.
const STATE_BADGE: Record<string, string> = {
  '자동확인':    'bg-emerald-100 text-emerald-700',
  '불확실 높음':  'bg-amber-100 text-amber-700',
  '정보부족':    'bg-rose-100 text-rose-700',
};
const STATE_KEY: Record<string, string> = {
  '자동확인':   'auto',
  '불확실 높음': 'highUncertainty',
  '정보부족':   'lackInfo',
};

const fmtRp = (n: number) => `${n.toLocaleString('id-ID')}`;

export default function ApprovalsPage() {
  const t = useTranslations('operatorApprovals');
  const [items, setItems] = useState<CaseRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [instruction, setInstruction] = useState('');

  const stateLabel = (k: string) => {
    const key = STATE_KEY[k];
    if (!key) return k;
    try { return t(`confidence.${key}`); } catch { return k; }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/cases?scope=all&status=PENDING_APPROVAL,DATA_REVIEW');
      const j = await r.json();
      if (j.success) {
        const list = (j.data.items as CaseRow[]).filter(c => c.status === 'PENDING_APPROVAL' || c.status === 'DATA_REVIEW');
        setItems(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/operator/cases/${selectedId}`).then(r => r.json()).then(j => {
      if (j.success) setDetail(j.data as CaseDetail);
    });
  }, [selectedId]);

  const action = async (op: 'approve' | 'reject' | 'instruct') => {
    if (!selectedId) return;
    if (op === 'instruct' && !instruction.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      if (op === 'instruct') {
        const r = await fetch(`/api/operator/cases/${selectedId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'instruct', note: instruction }),
        });
        const j = await r.json();
        if (!r.ok || !j.success) setMsg({ type: 'err', text: j.error || t('msg.instructFailed') });
        else { setMsg({ type: 'ok', text: t('msg.instructDone') }); setInstruction(''); }
      } else {
        const r = await fetch(`/api/operator/cases/${selectedId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op === 'approve'
            ? { action: 'approve' }
            : { action: 'reject', reason: t('decision.rejectReason') }),
        });
        const j = await r.json();
        if (!r.ok || !j.success) setMsg({ type: 'err', text: j.error || t('msg.actionFailed', { op }) });
        else setMsg({ type: 'ok', text: op === 'approve' ? t('msg.approvedDone') : t('msg.rejectedDone') });
      }
      await load();
      const r2 = await fetch(`/api/operator/cases/${selectedId}`);
      const j2 = await r2.json();
      if (j2.success) setDetail(j2.data as CaseDetail);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('pageTitle')} />
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">{t('pageTitle')}</h1>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 min-h-10 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-2 text-sm font-bold ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {msg.type === 'ok' ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">{t('listTitle')}</h2>
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
            {items.map(c => (
              <button
                key={c.id} onClick={() => setSelectedId(c.id)}
                className={`w-full text-left rounded-xl border p-3 ${c.id === selectedId ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {c.customer?.company_name || c.customer?.full_name || '—'}
                  </div>
                  {c.status === 'PENDING_APPROVAL' && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{t('approvalBadge')}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{c.case_code} · {c.service_label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('assigneePrefix', { id: c.operator?.employee_id ?? t('unassigned') })} · {c.priority || 'NORMAL'}</p>
              </button>
            ))}
            {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">{t('listEmpty')}</p>}
          </div>
        </section>

        <section className="space-y-4">
          {!detail ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm">{t('pickPrompt')}</div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-black text-slate-900">{detail.customer?.company_name || detail.customer?.full_name || '—'}</h2>
                  {detail.status === 'PENDING_APPROVAL' && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{t('approvalBadge')}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{detail.case_code} · {detail.service_label}</p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <Field label={t('field.operator')} value={detail.operator?.employee_id ?? '—'} />
                  <Field label={t('field.supervisor')} value={detail.supervisor?.employee_id ?? '—'} />
                  <Field label={t('field.service')} value={detail.service_label ?? '—'} />
                  <Field label={t('field.priority')} value={detail.priority ?? 'NORMAL'} />
                  <Field label="Due" value={detail.due_date ? formatDue(detail.due_date) : '-'} />
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 mb-2">{t('decision.title')}</h3>
                <p className="text-xs text-slate-500 mb-2">{t('decision.stateLabel')} <b>{detail.status === 'PENDING_APPROVAL' ? t('decision.requested') : t('decision.notRequested')}</b></p>
                {detail.review_summary?.reviewRequired ? (
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 mb-3">
                    {t('decision.reviewBlocker', { n: detail.review_summary.reviewRequired })}
                  </div>
                ) : null}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button disabled={busy || detail.status !== 'PENDING_APPROVAL'} onClick={() => action('approve')}
                    className="flex-1 sm:flex-none rounded-xl bg-blue-600 px-5 min-h-12 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
                    <CheckCircle className="h-4 w-4 inline mr-1" /> {t('decision.approveBtn')}
                  </button>
                  <button disabled={busy || detail.status !== 'PENDING_APPROVAL'} onClick={() => action('reject')}
                    className="flex-1 sm:flex-none rounded-xl bg-rose-600 px-5 min-h-12 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50">
                    <XCircle className="h-4 w-4 inline mr-1" /> {t('decision.rejectBtn')}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 mb-2">{t('instruction.title')}</h3>
                <textarea
                  value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
                  placeholder={t('instruction.placeholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <button disabled={busy || !instruction.trim()} onClick={() => action('instruct')}
                  className="mt-2 w-full sm:w-auto rounded-xl bg-slate-900 px-4 min-h-11 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50">
                  <Send className="h-3 w-3 inline mr-1" /> {t('instruction.sendBtn')}
                </button>
                {detail.notes && (
                  <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                    {detail.notes}
                  </pre>
                )}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 mb-3">{t('snapshot.title')}</h3>
                {!detail.review_summary?.items?.length ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">{t('snapshot.empty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                          <th className="px-2 py-2 font-bold">{t('snapshot.state')}</th>
                          <th className="px-2 py-2 font-bold">Invoice</th>
                          <th className="px-2 py-2 font-bold">Vendor</th>
                          <th className="px-2 py-2 font-bold">{t('snapshot.taxType')}</th>
                          <th className="px-2 py-2 font-bold">Tax Code</th>
                          <th className="px-2 py-2 font-bold text-right">Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.review_summary.items.map((it, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_BADGE[it.state] || 'bg-slate-100 text-slate-700'}`}>{stateLabel(it.state)}</span></td>
                            <td className="px-2 py-2 font-mono text-[11px]">{it.invoice}</td>
                            <td className="px-2 py-2">{it.vendor}</td>
                            <td className="px-2 py-2 font-mono text-[11px]">{it.taxKind}</td>
                            <td className="px-2 py-2 font-mono text-[11px]">{it.taxCode}</td>
                            <td className="px-2 py-2 text-right font-bold">{fmtRp(it.tax)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function formatDue(d: string): string {
  const today = new Date();
  const due = new Date(d);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${-diff}`;
}
