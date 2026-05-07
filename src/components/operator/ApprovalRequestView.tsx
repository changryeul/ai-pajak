'use client';

/**
 * 승인요청 (Final Review) 화면 — PDF p.5-7. 5 locales 다국어.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, Send } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface FinalItem {
  invoice: string;
  vendor: string;
  aiTaxKind: string;
  aiTaxCode: string;
  finalTaxKind: string;
  finalTaxCode: string;
  dpp: number;
  tax: number;
  state: string;
  isReviewed: boolean;
}

interface MyCase {
  id: string;
  case_code: string | null;
  service_label: string | null;
  status: string;
  priority: string | null;
  customer_name: string;
  review_required: number;
}

interface EditEvent {
  id: string;
  event: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  at: string;
}

interface FinalReview {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; totalTax: number };
  kpi: { customer: string; serviceLabel: string; reviewRequired: number; dataRequestCount: number };
  finalItems: FinalItem[];
  taxKindOptions: string[];
  documents: Array<{ type: string; name: string; parsedFields: number; status: string }>;
  editHistory: EditEvent[];
  myCases: MyCase[];
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
  canSubmit: boolean;
  finalReviewedAt: string | null;
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

const fmtRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtTs = (iso: string) => new Date(iso).toLocaleString();

export function ApprovalRequestView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.approval');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const tEvent = useTranslations('operatorStaff.eventLabel');
  const tPriority = useTranslations('operatorStaff.priority');
  const [d, setD] = useState<FinalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoice, setBusyInvoice] = useState<string | null>(null);
  const [reviewedChecked, setReviewedChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/final-review`);
      const j = await r.json();
      if (j.success) setD(j.data as FinalReview);
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

  const totalFinalTax = useMemo(() => (d?.finalItems ?? []).reduce((s, i) => s + (i.tax ?? 0), 0), [d]);

  const updateRow = async (
    invoice: string,
    patch: Partial<{ finalTaxKind: string; finalTaxCode: string; finalTax: number; finalDpp: number; vendorOverride: string }>,
  ) => {
    setBusyInvoice(invoice);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/final-review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, ...patch }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? t('alertGenericFailed'));
        return;
      }
      await load();
    } finally { setBusyInvoice(null); }
  };

  const submit = async () => {
    if (!d) return;
    if (!d.canSubmit) { alert(t('alertUnconfirmed')); return; }
    if (!reviewedChecked) { alert(t('alertCheckboxFirst')); return; }
    if (!confirm(t('confirmSubmit'))) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/request-approval`, { method: 'PUT' });
      const j = await r.json();
      if (!j.success) { alert(j.error ?? t('alertGenericFailed')); return; }
      router.push(`/${locale}/operator/my-work`);
    } finally { setSubmitting(false); }
  };

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/approval-request/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">{t('loadFailed')}</div>;

  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const statusCls = STATUS_CLASS[d.case.status] ?? 'bg-slate-100 text-slate-600';
  const blocked = d.kpi.reviewRequired > 0;

  return (
    <div>
      <PageTitle title={`${t('pageTitlePrefix')} ${customerName}`} />
      <h1 className="mb-1 text-2xl font-black text-slate-900">{t('title')}</h1>
      <p className="mb-6 text-sm text-slate-500">{t('subtitle')}</p>

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
                    <p className={cn('mt-1 text-[10px]', sel ? 'text-white/70' : 'text-slate-400')}>
                      {t('assignee')} {d.operator?.employee_id ?? '—'} · {tPriority((c.priority ?? 'NORMAL') as 'NORMAL')} · {t('reviewRequiredCount', { count: c.review_required })}
                    </p>
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
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', statusCls)}>{tStatus(d.case.status as 'PENDING')}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Kpi label={t('kpiCustomer')}        value={d.kpi.customer} />
              <Kpi label={t('kpiService')}         value={d.kpi.serviceLabel} />
              <Kpi label={t('kpiReviewRequired')}  value={`${d.kpi.reviewRequired}`} highlight={d.kpi.reviewRequired > 0} />
              <Kpi label={t('kpiDataRequestCount')} value={`${d.kpi.dataRequestCount}`} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('preCheckTitle')}</h3>
            {blocked ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-black text-rose-900">{t('blockedTitle')}</p>
                <p className="mt-1 text-[12px] text-rose-700">{t('blockedHintCount', { count: d.kpi.reviewRequired })}</p>
                <p className="mt-1 text-[11px] text-rose-600">{t('blockedHintRoute')}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">{t('okTitle')}</p>
                <p className="mt-1 text-[11px] text-emerald-700">{t('okHint')}</p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Step n="1" title={t('step1Title')} desc={t('step1Desc')} />
              <Step n="2" title={t('step2Title')} desc={t('step2Desc')} />
              <Step n="3" title={t('step3Title')} desc={t('step3Desc')} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">{t('finalAppTitle')}</h3>
                <p className="text-[11px] text-slate-500">{t('finalAppHint')}</p>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">{t('totalLabel')} {fmtRupiah(totalFinalTax)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500">
                    <th className="px-2 py-2">{t('tableInvoice')}</th>
                    <th className="px-2 py-2">{t('tableVendor')}</th>
                    <th className="px-2 py-2">{t('tableAiJudgement')}</th>
                    <th className="px-2 py-2">{t('tableFinalTaxKind')}</th>
                    <th className="px-2 py-2">{t('tableFinalTaxCode')}</th>
                    <th className="px-2 py-2 text-right">{t('tableDpp')}</th>
                    <th className="px-2 py-2 text-right">{t('tableTax')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.finalItems.map(it => {
                    const isBusy = busyInvoice === it.invoice;
                    return (
                      <tr key={it.invoice} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700">{it.invoice}</td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={it.vendor}
                            onBlur={e => { if (e.target.value !== it.vendor) updateRow(it.invoice, { vendorOverride: e.target.value }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-[11px] text-slate-500">{it.aiTaxKind} / {it.aiTaxCode}</td>
                        <td className="px-2 py-2">
                          <select
                            value={it.finalTaxKind}
                            onChange={e => updateRow(it.invoice, { finalTaxKind: e.target.value })}
                            disabled={isBusy}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          >
                            {d.taxKindOptions.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={it.finalTaxCode}
                            onBlur={e => { if (e.target.value !== it.finalTaxCode) updateRow(it.invoice, { finalTaxCode: e.target.value }); }}
                            disabled={isBusy}
                            className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" defaultValue={it.dpp}
                            onBlur={e => { const v = Number(e.target.value); if (v !== it.dpp) updateRow(it.invoice, { finalDpp: v }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number" defaultValue={it.tax}
                            onBlur={e => { const v = Number(e.target.value); if (v !== it.tax) updateRow(it.invoice, { finalTax: v }); }}
                            disabled={isBusy}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-[11px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {d.finalItems.length === 0 && (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-[11px] text-slate-400">{t('tableEmpty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('documentsTitle')}</h3>
              <ul className="space-y-2">
                {d.documents.map(doc => (
                  <li key={doc.type} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{doc.type}</span>
                      <span className="text-[10px] font-bold text-emerald-700">{doc.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-700">{doc.name}</p>
                    <p className="text-[10px] text-slate-400">{t('documentsParsed', { count: doc.parsedFields })}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('editHistoryTitle')}</h3>
              {d.editHistory.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">{t('editHistoryEmpty')}</p>
              ) : (
                <ul className="max-h-[260px] space-y-1.5 overflow-y-auto">
                  {d.editHistory.map(e => (
                    <li key={e.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-700">{tEvent(e.event as 'INSTRUCTED')}</span>
                        <span className="text-[10px] text-slate-400">{fmtTs(e.at)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{e.actor ?? 'system'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <label className={cn('flex items-start gap-3 rounded-xl border p-4', blocked ? 'border-slate-100 bg-slate-50 opacity-50' : 'border-slate-200 bg-white cursor-pointer')}>
              <input
                type="checkbox" checked={reviewedChecked}
                disabled={blocked}
                onChange={e => setReviewedChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-black text-slate-900">{t('finalCheckTitle')}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{t('finalCheckDesc')}</p>
              </div>
            </label>

            <button
              onClick={submit} disabled={blocked || !reviewedChecked || submitting || !d.canSubmit}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition',
                (blocked || !reviewedChecked || !d.canSubmit) ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('submitButton')}
            </button>
            {(blocked || !d.canSubmit) && (
              <div className="mt-2 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 text-rose-500" />
                <p className="text-[10px] text-rose-500">{t('submitFooterNote')}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-black', highlight ? 'text-rose-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-black text-slate-700">{n}. {title}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
    </div>
  );
}
