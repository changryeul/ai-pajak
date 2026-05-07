'use client';

/**
 * Coretax 처리 화면 — PDF p.9-11. 5 locales 다국어.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ExternalLink, Copy, ArrowRight } from 'lucide-react';
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

interface ManualLog { id: string; at: string; actor: string | null; note: string }

interface CoretaxData {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null; service_label: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; expectedAmount: number; coretaxMode: string };
  stepStates: { access: { state: string }; billing: { state: string }; ntpn: { state: string }; complete: { state: string } };
  billing: { state: string; billingId: string | null; amount: number; method: string };
  submitted: { ntpn: string | null; buktiFile: string | null; submittedAt: string | null };
  complete: { ntpnConfirmed: boolean; submitted: boolean; bpeReflected: boolean; bpeNumber: string | null; bpeDate: string | null };
  checklist: Record<string, '대기' | '진행' | '완료' | '미완'>;
  manualLogs: ManualLog[];
  myCases: MyCase[];
  coretaxUrl: string;
  canRecordBilling: boolean;
  closingSessionId: string | null;
  apiEnabled: boolean;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PENDING_DOCS: 'bg-amber-100 text-amber-700',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  EBILLING_GENERATED: 'bg-blue-100 text-blue-700',
  PAYMENT_PENDING: 'bg-amber-100 text-amber-700',
  PAYMENT_UPLOADED: 'bg-blue-100 text-blue-700',
  PAYMENT_VERIFIED: 'bg-emerald-100 text-emerald-700',
  DJP_SUBMITTED: 'bg-blue-100 text-blue-700',
  BPE_UPLOADED: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

const CHECKLIST_ITEMS: Array<{ key: string; titleKey: string; descKey: string }> = [
  { key: 'coretax-login',        titleKey: 'cl_login_t',   descKey: 'cl_login_d' },
  { key: 'id-billing-issue',     titleKey: 'cl_billing_t', descKey: 'cl_billing_d' },
  { key: 'reflect-billing-info', titleKey: 'cl_reflect_t', descKey: 'cl_reflect_d' },
  { key: 'verify-ntpn-bukti',    titleKey: 'cl_verify_t',  descKey: 'cl_verify_d' },
  { key: 'submit-spt-masa',      titleKey: 'cl_submit_t',  descKey: 'cl_submit_d' },
  { key: 'upload-bpe',           titleKey: 'cl_bpe_t',     descKey: 'cl_bpe_d' },
];

const fmtRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtTs = (iso: string) => new Date(iso).toLocaleString();

const STEP_STATE_CLS: Record<string, string> = {
  '진행가능': 'border-blue-200 bg-blue-50 text-blue-700',
  '완료':     'border-emerald-200 bg-emerald-50 text-emerald-700',
  '대기':     'border-slate-200 bg-slate-50 text-slate-500',
  'BPE 대기': 'border-slate-200 bg-slate-50 text-slate-500',
};

function localizeStepState(raw: string, t: (k: string) => string): string {
  switch (raw) {
    case '진행가능': return t('stepStateAvailable');
    case '완료':     return t('stepStateDone');
    case '대기':     return t('stepStateWaiting');
    case 'BPE 대기': return t('stepStateBpeWaiting');
    default:         return raw;
  }
}

export function CoretaxView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.coretax');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const [d, setD] = useState<CoretaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [billingId, setBillingId] = useState('');
  const [ntpn, setNtpn] = useState('');
  const [bpeNumber, setBpeNumber] = useState('');
  const [manualNote, setManualNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/coretax`);
      const j = await r.json();
      if (j.success) {
        const data = j.data as CoretaxData;
        setD(data);
        setNtpn(data.submitted.ntpn ?? '');
        setBillingId(data.billing.billingId ?? '');
        setBpeNumber(data.complete.bpeNumber ?? '');
      }
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

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await fetch(`/api/operator/cases/${caseId}/coretax`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? 'failed');
        return false;
      }
      await load();
      return true;
    } finally { setBusy(null); }
  };

  const switchCase = (c: MyCase) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer_name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/coretax/${c.id}`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">{t('loadFailed')}</div>;

  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const statusCls = STATUS_CLASS[d.case.status] ?? 'bg-slate-100 text-slate-600';

  return (
    <div>
      <PageTitle title={`${t('pageTitlePrefix')} ${customerName}`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        {/* 좌측: 내 고객 */}
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
          {/* 헤더 + 메타 4카드 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">{t('title')}</h2>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    d.apiEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  )}>
                    {d.apiEnabled ? t('modeApi') : t('modeManual')}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t('subtitle')}</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', statusCls)}>{tStatus(d.case.status as 'PENDING')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Meta label={t('metaCustomer')}        value={customerName} />
              <Meta label={t('metaService')}         value={d.service.label} />
              <Meta label={t('metaExpectedAmount')}  value={fmtRupiah(d.service.expectedAmount)} highlight />
              <Meta label={t('metaCoretaxMode')}     value={d.apiEnabled ? t('modeApiAuto') : t('modeManualAccess')} />
            </div>
            {d.closingSessionId && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{t('closingLinkBadge')}</span>
                <p className="text-[11px] text-blue-900">{t('closingLinkNote')}</p>
              </div>
            )}
          </section>

          {/* 처리 순서 4단계 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('stepsTitle')}</h3>
            <div className="grid grid-cols-4 gap-2">
              <StepCard n="1" title={t('step1Title')} subtitle={t('step1Sub')} state={d.stepStates.access.state} stateLabel={localizeStepState(d.stepStates.access.state, t)} />
              <StepCard n="2" title={t('step2Title')} subtitle={t('step2Sub')} state={d.stepStates.billing.state} stateLabel={localizeStepState(d.stepStates.billing.state, t)} />
              <StepCard n="3" title={t('step3Title')} subtitle={t('step3Sub')} state={d.stepStates.ntpn.state} stateLabel={localizeStepState(d.stepStates.ntpn.state, t)} />
              <StepCard n="4" title={t('step4Title')} subtitle={t('step4Sub')} state={d.stepStates.complete.state} stateLabel={localizeStepState(d.stepStates.complete.state, t)} />
            </div>
          </section>

          {/* 1. Coretax 접속 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">{t('section1Title')}</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{t('section1Hint')}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => { window.open(d.coretaxUrl, '_blank'); act('open-coretax'); }}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                >
                  <ExternalLink className="h-3 w-3" /> {t('btnOpenNewTab')}
                </button>
                <button
                  onClick={() => { window.location.href = d.coretaxUrl; }}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                >
                  <ArrowRight className="h-3 w-3" /> {t('btnGoCurrentTab')}
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(d.coretaxUrl).then(() => alert(t('alertCopied')))}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3 w-3" /> {t('btnCopyAddress')}
              </button>
              <span className="text-[11px] text-slate-500">{t('addressLabel')}: <code className="font-mono">{d.coretaxUrl}</code></span>
            </div>
            {!d.canRecordBilling && (
              <p className="mt-2 text-[11px] text-amber-700">{t('noteBeforeApproval')}</p>
            )}
          </section>

          {/* 2. ID Billing + 3. NTPN 확인 */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('section2Title')}</h3>
              <Row label={t('rowIssueState')} value={d.billing.state} />
              <Row label={t('rowBillingId')} value={d.billing.billingId ?? '—'} mono />
              <Row label={t('rowAmount')} value={fmtRupiah(d.billing.amount)} />
              <Row label={t('rowMethod')} value={d.billing.method} />
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={billingId} onChange={e => setBillingId(e.target.value)}
                  placeholder={d.apiEnabled ? t('billingPlaceholderApi') : t('billingPlaceholderManual')}
                  disabled={!d.canRecordBilling}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  disabled={!d.canRecordBilling || (!d.apiEnabled && !billingId.trim()) || busy === 'record-billing'}
                  onClick={() => act('record-billing', { billingId: billingId.trim() || undefined, method: billingId.trim() ? 'Manual' : 'API' })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    (!d.canRecordBilling || (!d.apiEnabled && !billingId.trim())) ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700',
                  )}
                >
                  {d.apiEnabled && !billingId.trim() ? t('btnRecordBillingApi') : t('btnRecordBillingManual')}
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('section3Title')}</h3>
              <p className="text-[11px] text-slate-500">{t('section3Hint')}</p>
              <p className="mt-1 text-base font-black text-slate-900">{d.submitted.ntpn ?? '—'}</p>
              {d.submitted.buktiFile && (
                <p className="text-[10px] text-slate-400">{t('evidenceFile')}: {d.submitted.buktiFile}</p>
              )}
              <p className="mt-3 text-[11px] font-bold text-slate-500">{t('operatorOverride')}</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={ntpn} onChange={e => setNtpn(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  disabled={!ntpn.trim() || busy === 'confirm-ntpn'}
                  onClick={() => act('confirm-ntpn', { ntpn })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    !ntpn.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600',
                  )}
                >{t('btnNtpnConfirm')}</button>
              </div>
            </section>
          </div>

          {/* 4. 신고완료/BPE + 체크리스트 */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('section4Title')}</h3>
              <Row label={t('rowNtpnConfirmed')} value={d.complete.ntpnConfirmed ? t('stateDone') : t('stateWaiting')} />
              <Row label={t('rowFiled')}         value={d.complete.submitted ? t('stateDone') : t('stateUndone')} />
              <Row label={t('rowBpeReflected')}  value={d.complete.bpeReflected ? t('stateDone') : t('stateWaiting')} />
              <Row label={t('rowBpeNumber')}     value={d.complete.bpeNumber ?? '—'} mono />
              <Row label={t('rowBpeDate')}       value={d.complete.bpeDate ?? '—'} />
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={bpeNumber} onChange={e => setBpeNumber(e.target.value)}
                  placeholder={d.apiEnabled ? t('bpePlaceholderApi') : t('bpePlaceholderManual')}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  disabled={(!d.apiEnabled && !bpeNumber.trim()) || busy === 'record-completion'}
                  onClick={() => act('record-completion', { bpeNumber: bpeNumber.trim() || undefined })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                    (!d.apiEnabled && !bpeNumber.trim()) ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700',
                  )}
                >{d.apiEnabled && !bpeNumber.trim() ? t('btnRecordCompletionApi') : t('btnRecordCompletionManual')}</button>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-slate-900">{t('checklistTitle')}</h3>
              <ul className="space-y-2">
                {CHECKLIST_ITEMS.map(it => (
                  <li key={it.key} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-700">{t(it.titleKey)}</p>
                      <p className="text-[10px] text-slate-500">{t(it.descKey)}</p>
                    </div>
                    <select
                      value={d.checklist[it.key] ?? '대기'}
                      onChange={e => act('set-checklist', { key: it.key, state: e.target.value })}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold"
                    >
                      <option value="대기">{t('checkStateWaiting')}</option>
                      <option value="진행">{t('checkStateProgress')}</option>
                      <option value="완료">{t('checkStateDone')}</option>
                      <option value="미완">{t('checkStateUndone')}</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => act('request-access')}
                  className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                >{t('btnRequestAccess')}</button>
                <button
                  onClick={() => act('request-bukti')}
                  className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                >{t('btnRequestBukti')}</button>
              </div>
            </section>
          </div>

          {/* 수동 처리 로그 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('manualLogTitle')}</h3>
            {d.manualLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] text-slate-400">{t('manualLogEmpty')}</p>
            ) : (
              <ul className="mb-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {d.manualLogs.map(l => (
                  <li key={l.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-700">{l.actor ?? 'system'}</span>
                      <span className="text-[10px] text-slate-400">{fmtTs(l.at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-700">{l.note}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <input
                value={manualNote} onChange={e => setManualNote(e.target.value)}
                placeholder={t('manualLogPlaceholder')}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              />
              <button
                disabled={!manualNote.trim() || busy === 'log-manual'}
                onClick={async () => { const ok = await act('log-manual', { note: manualNote }); if (ok) setManualNote(''); }}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11px] font-bold',
                  !manualNote.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >{t('btnAddLog')}</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Meta({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-black', highlight ? 'text-blue-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}

function StepCard({ n, title, subtitle, state, stateLabel }: { n: string; title: string; subtitle: string; state: string; stateLabel: string }) {
  const cls = STEP_STATE_CLS[state] ?? 'border-slate-200 bg-slate-50 text-slate-500';
  return (
    <div className={cn('rounded-xl border p-3', cls)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-700">{n}</span>
        <span className="text-[10px] font-bold">{stateLabel}</span>
      </div>
      <p className="text-[12px] font-black">{title}</p>
      <p className="mt-0.5 text-[10px] opacity-75">{subtitle}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-[11px] last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-bold text-slate-800', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
