'use client';

/**
 * 검토 화면 — 3-pane (PDF 「백오피스_상담원」 p.3-4).
 *
 *   좌(280px): 내 고객 리스트 — 현재 선택은 하이라이트
 *   중앙(flex): 케이스 헤더 + 「확인할 항목」 카드 + 메신저 + 자료 Preview
 *   우(320px, sticky): 「다음 작업」 패널 4 액션 + NTPN 입력 + 검토필요 알림
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, ExternalLink, CheckCircle2, FileText, ArrowRight, Send, Upload, Sparkles } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface ReviewItem {
  invoice?: string;
  vendor?: string;
  taxKind?: string;
  taxCode?: string;
  tax?: number;
  dpp?: number;
  state?: string;
  reason?: string;
  checkedAt?: string;
  requestedAt?: string;
  note?: string | null;
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

interface Detail {
  case: { id: string; case_code: string | null; status: string; priority: string | null; due_date: string | null; notes: string | null };
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string } | null;
  service: { label: string; taxType: string; period: { month: number; year: number }; totalTax: number };
  approval: { state: '미요청' | '요청중' | '승인됨' | '반려'; supervisor: { employee_id: string; name: string } | null };
  operator: { employee_id: string; name: string } | null;
  reviewItems: ReviewItem[];
  reviewRequired: number;
  submitted: { ntpn: string | null; buktiFile: string | null; submittedAt: string | null };
  documents: Array<{ type: string; name: string; parsedFields: number; status: string }>;
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

const fmtRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const ITEM_STATE_CLS: Record<string, string> = {
  '자동확인':     'border-emerald-200 bg-emerald-50',
  '불확실 높음': 'border-rose-200 bg-rose-50',
  '정보부족':    'border-rose-200 bg-rose-50',
  '자료요청':    'border-amber-200 bg-amber-50',
  'AI 확인필요': 'border-violet-200 bg-violet-50',
};

export default function ReviewCasePage() {
  const router = useRouter();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const t = useTranslations('operatorStaff.review');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const tApproval = useTranslations('operatorStaff.approvalState');
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoice, setBusyInvoice] = useState<string | null>(null);
  const [ntpnInput, setNtpnInput] = useState('');
  const [previewItem, setPreviewItem] = useState<ReviewItem | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrLastResult, setOcrLastResult] = useState<{ taxKind: string; taxCode: string; confidence: number; reason: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/operator/cases/${id}/review-detail`);
      const j = await r.json();
      if (j.success) {
        setD(j.data as Detail);
        setNtpnInput((j.data as Detail).submitted.ntpn ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);
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
    router.push(`/${locale}/operator/review-case/${c.id}`);
  };

  const itemAction = async (invoice: string, action: 'mark-checked' | 'request-docs') => {
    setBusyInvoice(invoice);
    try {
      const r = await fetch(`/api/operator/cases/${id}/review-item`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice, action }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? t('ocrAlertGenericFailed'));
        return;
      }
      await load();
    } finally {
      setBusyInvoice(null);
    }
  };

  const handleOcrFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(t('ocrAlertFileSize'));
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      alert(t('ocrAlertFileType'));
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.split(',')[1] ?? r);
      };
      reader.onerror = () => reject(new Error(t('ocrAlertReadFailed')));
      reader.readAsDataURL(file);
    });

    setOcrBusy(true);
    setOcrLastResult(null);
    try {
      const r = await fetch(`/api/operator/cases/${id}/invoices/ocr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mimeType: file.type }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? t('ocrAlertGeneric'));
        return;
      }
      setOcrLastResult({
        taxKind: j.data.item.taxKind,
        taxCode: j.data.item.taxCode,
        confidence: j.data.classification.confidence,
        reason: j.data.classification.resolution.reason,
      });
      await load();
    } finally {
      setOcrBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const requestApproval = async () => {
    if (!d) return;
    if (d.reviewRequired > 0) {
      alert(t('ocrAlertReviewRequired', { count: d.reviewRequired }));
      return;
    }
    if (!confirm(t('ocrConfirmApproval'))) return;
    const r = await fetch(`/api/operator/cases/${id}/request-approval`, { method: 'PUT' });
    const j = await r.json();
    if (!j.success) {
      alert(j.error ?? t('ocrAlertGenericFailed'));
      return;
    }
    router.push(`/${locale}/operator/approval-request`);
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!d) return <div className="py-20 text-center text-sm text-slate-400">{t('loadFailed')}</div>;

  const statusCls = STATUS_CLASS[d.case.status] ?? 'bg-slate-100 text-slate-600';
  const customerName = d.customer?.company_name || d.customer?.full_name || '—';
  const canRequestApproval = d.reviewRequired === 0 && ['PENDING', 'PENDING_DOCS', 'DATA_REVIEW'].includes(d.case.status);
  const canCoretax = ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING'].includes(d.case.status);

  return (
    <div>
      <PageTitle title={`${t('pageTitlePrefix')} ${customerName}`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr_320px]">
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
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition',
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-black', sel ? 'text-white' : 'text-slate-900')}>{c.customer_name}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', sel ? 'bg-white/20 text-white' : sCls)}>{tStatus(c.status as 'PENDING')}</span>
                    </div>
                    <p className={cn('mt-0.5 text-[10px]', sel ? 'text-white/70' : 'text-slate-500')}>{c.case_code ?? '—'} · {c.service_label}</p>
                    <p className={cn('mt-1 text-[10px]', sel ? 'text-white/70' : 'text-slate-400')}>
                      {t('assignee')} {d.operator?.employee_id ?? '—'} · {t('reviewRequiredCount', { count: c.review_required })}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* 중앙: 검토 본문 */}
        <main className="space-y-3">
          {/* 헤더 */}
          <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">{t('subHeaderHint')}</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-black">{customerName}</h2>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusCls)}>{tStatus(d.case.status as 'PENDING')}</span>
            </div>
            <p className="mt-1 text-sm text-white/80">{d.service.label}</p>
          </section>

          {/* 메타 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <Meta label={t('metaService')} value={d.service.label.includes('Tahunan') ? t('serviceTypeAnnual') : t('serviceTypeMonthly')} />
              <Meta label={t('metaWithholdingTotal')} value={fmtRupiah(d.service.totalTax)} highlight />
              <Meta label={t('metaSupervisorApproval')} value={tApproval(d.approval.state)} highlight={d.approval.state === '승인됨'} />
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-[13px] font-bold text-amber-900">{t('alertTitle')}</p>
              <p className="text-[11px] text-amber-700">{t('alertHint')}</p>
            </div>
          </section>

          {/* 확인할 항목 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">{t('checkItemsTitle')}</h3>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFile(f); }}
                />
                <button
                  disabled={ocrBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                    ocrBusy ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700',
                  )}
                >
                  {ocrBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" /><Sparkles className="h-3 w-3" /></>}
                  {t('btnAddOcr')}
                </button>
              </div>
            </div>
            {ocrLastResult && (
              <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                <p className="text-[11px] font-black text-violet-900">
                  {t('ocrResultClassification')} {ocrLastResult.taxKind} · {t('ocrResultTaxCode')} {ocrLastResult.taxCode} · {t('ocrResultConfidence')} {Math.round(ocrLastResult.confidence * 100)}%
                </p>
                <p className="text-[10px] text-violet-700">{ocrLastResult.reason}</p>
              </div>
            )}
            {d.reviewItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">{t('checkItemsEmpty')}</p>
            ) : (
              <ul className="space-y-2.5">
                {d.reviewItems.map(it => {
                  const wrapCls = ITEM_STATE_CLS[it.state ?? ''] ?? 'border-slate-200 bg-white';
                  const checked = it.state === '자동확인';
                  const requested = it.state === '자료요청';
                  return (
                    <li key={it.invoice} className={cn('rounded-xl border p-3', wrapCls)}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900">
                            {it.invoice} · <span className="font-bold">{it.vendor}</span>
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {it.taxKind} · Tax Code {it.taxCode} · DPP {fmtRupiah(it.dpp ?? 0)}
                          </p>
                          {it.reason && <p className="mt-1 text-[11px] font-bold text-rose-600">{it.reason}</p>}
                          {it.note && <p className="mt-1 text-[11px] text-amber-700">📨 {it.note}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => setPreviewItem(it)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                          >{t('btnViewDoc')}</button>
                          <button
                            disabled={checked || busyInvoice === it.invoice}
                            onClick={() => itemAction(it.invoice!, 'mark-checked')}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                              checked ? 'bg-emerald-200 text-emerald-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                              busyInvoice === it.invoice && 'opacity-50',
                            )}
                          >{checked ? t('btnMarkCheckedDone') : t('btnMarkChecked')}</button>
                          <button
                            disabled={requested || busyInvoice === it.invoice}
                            onClick={() => itemAction(it.invoice!, 'request-docs')}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                              requested ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                              busyInvoice === it.invoice && 'opacity-50',
                            )}
                          >{requested ? t('btnRequestDocsDone') : t('btnRequestDocs')}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 자료 Preview */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('previewTitle')}</h3>
            {previewItem ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-900">{previewItem.invoice} · {previewItem.vendor}</p>
                <p className="text-[11px] text-slate-500">{previewItem.taxKind} · Tax Code {previewItem.taxCode}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">{t('previewDpp')}: <span className="font-bold">{fmtRupiah(previewItem.dpp ?? 0)}</span></div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">{t('previewTax')}: <span className="font-bold">{fmtRupiah(previewItem.tax ?? 0)}</span></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{t('previewNote')}</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">
                {t('previewEmpty')}
              </p>
            )}
          </section>
        </main>

        {/* 우: Sticky 다음 작업 */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('nextActionTitle')}</h3>
            <p className="mb-3 text-[11px] text-slate-500">{t('nextActionHint')}</p>
            <div className="space-y-2">
              <ActionButton color="emerald" disabled={!canRequestApproval} onClick={requestApproval}
                icon={<Send className="h-3.5 w-3.5" />} label={t('actionRequestApproval')} />
              <ActionButton color="blue" disabled={!canCoretax} onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<ExternalLink className="h-3.5 w-3.5" />} label={t('actionOpenCoretax')} />
              <ActionButton color="slate" disabled={!canCoretax} onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<ArrowRight className="h-3.5 w-3.5" />} label={t('actionGoCoretax')} />
              <ActionButton color="slate" disabled={d.case.status !== 'EBILLING_GENERATED' && d.case.status !== 'PAYMENT_PENDING'}
                onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={t('actionRecordBilling')} />
              <ActionButton color="violet" disabled={d.case.status !== 'PAYMENT_PENDING'}
                onClick={() => router.push(`/${locale}/operator/coretax`)}
                icon={<FileText className="h-3.5 w-3.5" />} label={t('actionRecordCompletion')} />
            </div>
          </section>

          {/* 고객 NTPN */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold text-slate-500">{t('ntpnSubmittedLabel')}</p>
            <p className="mt-1 text-base font-black text-slate-900">{d.submitted.ntpn ?? '—'}</p>
            {d.submitted.buktiFile && (
              <p className="mt-0.5 text-[10px] text-slate-400">
                {t('ntpnEvidenceFile')}: {d.submitted.buktiFile} · {t('ntpnSubmittedAt')}: {d.submitted.submittedAt ? new Date(d.submitted.submittedAt).toLocaleString() : '—'}
              </p>
            )}
            <p className="mt-3 text-[11px] font-bold text-slate-500">{t('ntpnEditLabel')}</p>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={ntpnInput} onChange={e => setNtpnInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
              />
              <button className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600">{t('ntpnConfirm')}</button>
            </div>
          </section>

          {/* 검토필요 알림 */}
          {d.reviewRequired > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                <p className="text-[12px] font-bold text-rose-900">{t('alertReviewRequired', { count: d.reviewRequired })}</p>
              </div>
            </section>
          )}

          {/* Coretax 안내 */}
          {!canCoretax && (
            <section className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] text-slate-600">{t('coretaxNote')}</p>
            </section>
          )}
        </aside>
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

type ActionColor = 'emerald' | 'blue' | 'slate' | 'violet';
const COLOR_CLS: Record<ActionColor, string> = {
  emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  blue:    'bg-blue-600 hover:bg-blue-700 text-white',
  slate:   'bg-slate-900 hover:bg-slate-800 text-white',
  violet:  'bg-violet-600 hover:bg-violet-700 text-white',
};

function ActionButton({ color, disabled, onClick, icon, label }: { color: ActionColor; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      disabled={disabled} onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition',
        disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : COLOR_CLS[color],
      )}
    >
      {icon}{label}
    </button>
  );
}
