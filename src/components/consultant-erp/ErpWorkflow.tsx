'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { CalcCardsPanel } from './CalcCardsPanel';
import { ParseReviewPanel } from './ParseReviewPanel';

type SessionStatus =
  | 'DRAFT' | 'UPLOADING' | 'PARSING' | 'REVIEWING'
  | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

interface SessionRow {
  id: string;
  customer_id: string;
  consultant_id: string;
  supervisor_id: string | null;
  filing_kind: 'MONTHLY' | 'ANNUAL';
  tax_period: string;
  current_step: number;
  status: SessionStatus;
  total_estimated_tax: number | null;
}

interface DocumentRow {
  id: string;
  slot: string;
  original_filename: string;
  version: number;
  parse_status: string;
  uploaded_at: string;
}

interface ApprovalRow {
  id: string;
  action: string;
  actor_role: string;
  comment: string | null;
  created_at: string;
}

interface CoretaxRow {
  id_billing: string | null;
  ntpn: string | null;
  bpe_file_path: string | null;
  recorded_at: string | null;
}

interface InvoiceLineRow {
  id: string;
  document_id: string;
  line_no: number;
  invoice_number: string | null;
  invoice_date: string | null;
  counterparty_name: string | null;
  counterparty_npwp: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  vat_amount: number | null;
  withholding_amount: number | null;
  total: number | null;
}

const SLOT_KEYS: { key: string; required: boolean }[] = [
  { key: 'PAYROLL', required: true },
  { key: 'WITHHOLDING_INVOICE', required: true },
  { key: 'CORP_TAX_INPUT', required: true },
  { key: 'VAT_IN_OUT', required: true },
  { key: 'OTHER_REFERENCE', required: false },
  { key: 'BANK_STATEMENT', required: true },
];

const STEP_KEYS = ['stepCustomer', 'stepUpload', 'stepParseCalc', 'stepApproval', 'stepCoretax'] as const;

export function ErpWorkflow({ isSupervisor: isSupervisorProp }: { isSupervisor?: boolean } = {}) {
  const t = useTranslations('consultantErp');
  const { session: clientSession } = useSession();
  const isSupervisor =
    isSupervisorProp ?? clientSession?.role === UserRole.TAX_OPERATOR_SUPERVISOR;
  const params = useSearchParams();
  const customerId = params.get('customerId');
  const sessionIdParam = params.get('sessionId');

  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
  const [filingKind, setFilingKind] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [taxPeriod, setTaxPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [session, setSession] = useState<SessionRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [coretax, setCoretax] = useState<CoretaxRow | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineRow[]>([]);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${id}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error ?? 'load failed');
      setSession(j.data.session);
      setDocuments(j.data.documents ?? []);
      setApprovals(j.data.approvals ?? []);
      setCoretax(j.data.coretax ?? null);
      setInvoiceLines(j.data.invoiceLines ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId) void loadSession(sessionId);
  }, [sessionId, loadSession]);

  const startSession = async () => {
    if (!customerId) {
      setError(t('workflow.startHint'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/consultant-erp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, filingKind, taxPeriod }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          const list = await fetch(`/api/consultant-erp/sessions?customerId=${customerId}`).then((x) => x.json());
          const found = (list.data ?? []).find(
            (s: SessionRow) => s.filing_kind === filingKind && s.tax_period.startsWith(taxPeriod),
          );
          if (found) setSessionId(found.id);
          else throw new Error(j.error ?? 'conflict');
        } else throw new Error(j.error ?? 'create failed');
      } else {
        setSessionId(j.data.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const runParseInvoice = async (documentId: string) => {
    if (!sessionId) return;
    setParsingDocId(documentId);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/parse-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error || 'parse failed');
      } else {
        await loadSession(sessionId);
      }
    } finally {
      setParsingDocId(null);
    }
  };

  const uploadFile = async (slot: string, file: File) => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('slot', slot);
      form.append('file', file);
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/documents/upload`, {
        method: 'POST',
        body: form,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'upload failed');
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const submitApproval = async (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW') => {
    if (!sessionId) return;
    const comment =
      action === 'REJECT' || action === 'WITHDRAW'
        ? window.prompt(t('workflow.approveCommentPrompt', { action })) ?? undefined
        : undefined;
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `${action} failed`);
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const [crIdBilling, setCrIdBilling] = useState('');
  const [crNtpn, setCrNtpn] = useState('');
  const [crBpe, setCrBpe] = useState('');

  const submitCoretax = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/coretax-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idBilling: crIdBilling,
          ntpn: crNtpn,
          bpeFilePath: crBpe || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'coretax record failed');
      await loadSession(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const currentStep = session?.current_step ?? 1;
  const docsBySlot = useMemo(() => {
    const m = new Map<string, DocumentRow>();
    documents.forEach((d) => m.set(d.slot, d));
    return m;
  }, [documents]);
  const requiredFilled = SLOT_KEYS.filter((s) => s.required && docsBySlot.has(s.key)).length;
  const requiredTotal = SLOT_KEYS.filter((s) => s.required).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {!session && !isSupervisor && (
        <Card className="border-dashed">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-700">{t('workflow.startHeading')}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t('workflow.startHint')}{' '}
                {t('workflow.startCurrentCustomer')}: <code className="rounded bg-slate-100 px-1.5 py-0.5">{customerId ?? t('workflow.startNoCustomer')}</code>
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">{t('workflow.startFilingKindLabel')}</p>
                <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                  {(['MONTHLY', 'ANNUAL'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setFilingKind(k)}
                      className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
                        filingKind === k ? 'bg-slate-950 text-white' : 'text-slate-600'
                      }`}
                    >
                      {t(`filingKind.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">{t('workflow.startTaxPeriodLabel')}</p>
                <Input
                  type="month"
                  value={taxPeriod}
                  onChange={(e) => setTaxPeriod(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={startSession} disabled={busy || !customerId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('startMonthly')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!session && isSupervisor && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-slate-500">
            {t('supervisor.openSessionHint')}
          </CardContent>
        </Card>
      )}

      {session && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  {session.filing_kind === 'ANNUAL' ? t('filingKind.ANNUAL') : t('filingKind.MONTHLY')} · {session.tax_period.slice(0, 7)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t('workflow.statusLabel')}:{' '}
                  <span className="font-black text-slate-950">{session.status}</span>
                </p>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {STEP_KEYS.map((stepKey, i) => {
                const stepNum = i + 1;
                const on = currentStep === stepNum;
                const done = currentStep > stepNum;
                return (
                  <span
                    key={stepKey}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                      on
                        ? 'bg-slate-950 text-white'
                        : done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done && <CheckCircle2 className="h-3 w-3" />}
                    {stepNum}. {t(stepKey)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Step 2: 자료 업로드 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{t('workflow.step2Title')}</p>
                  <p className="text-xs text-slate-500">{t('workflow.step2Required', { filled: requiredFilled, total: requiredTotal })}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {t('workflow.step2P1Hint')}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {SLOT_KEYS.map((slot) => {
                  const doc = docsBySlot.get(slot.key);
                  return (
                    <div
                      key={slot.key}
                      className={`rounded-xl border p-4 ${doc ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-black text-slate-950">{t(`slot.${slot.key}`)}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            slot.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {slot.required ? t('slot.required') : t('slot.optional')}
                        </span>
                      </div>
                      {doc ? (
                        <p className="text-xs text-slate-600">
                          <FileText className="mr-1 inline h-3 w-3" />
                          {doc.original_filename} · v{doc.version}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">{t('slot.notUploaded')}</p>
                      )}
                      {!isSupervisor && (
                        <label className="mt-3 block">
                          <input
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.zip,.txt"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadFile(slot.key, f);
                              e.target.value = '';
                            }}
                            disabled={busy}
                          />
                          <span className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">
                            {doc ? t('slot.replaceUpload') : t('slot.selectAndUpload')}
                          </span>
                        </label>
                      )}
                      {doc && (slot.key === 'WITHHOLDING_INVOICE' || slot.key === 'VAT_IN_OUT') && (
                        <button
                          onClick={() => void runParseInvoice(doc.id)}
                          disabled={parsingDocId === doc.id || busy}
                          className="mt-2 block w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {parsingDocId === doc.id ? (
                            <Loader2 className="inline h-3 w-3 animate-spin" />
                          ) : null}{' '}
                          {t('slot.parseInvoice')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Invoice line items extracted by AI */}
              {invoiceLines.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-black text-slate-950">{t('slot.invoiceLinesHeading')}</p>
                    <p className="text-[10px] text-slate-500">
                      {invoiceLines.length} {t('slot.invoiceLinesUnit')}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2 py-1.5 text-left">#</th>
                          <th className="px-2 py-1.5 text-left">{t('slot.invoiceLinesCounterparty')}</th>
                          <th className="px-2 py-1.5 text-left">{t('slot.invoiceLinesInvoice')}</th>
                          <th className="px-2 py-1.5 text-left">{t('slot.invoiceLinesDescription')}</th>
                          <th className="px-2 py-1.5 text-right">{t('slot.invoiceLinesSubtotal')}</th>
                          <th className="px-2 py-1.5 text-right">{t('slot.invoiceLinesVat')}</th>
                          <th className="px-2 py-1.5 text-right">{t('slot.invoiceLinesTotal')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceLines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{l.line_no}</td>
                            <td className="px-2 py-1.5">
                              <p className="font-bold text-slate-900">{l.counterparty_name ?? '—'}</p>
                              {l.counterparty_npwp && (
                                <p className="text-[9px] font-mono text-slate-500">{l.counterparty_npwp}</p>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <p className="text-slate-800">{l.invoice_number ?? '—'}</p>
                              {l.invoice_date && <p className="text-[9px] text-slate-500">{l.invoice_date}</p>}
                            </td>
                            <td className="max-w-[200px] truncate px-2 py-1.5 text-slate-700">
                              {l.description ?? '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                              {l.subtotal != null ? `Rp ${Math.round(Number(l.subtotal)).toLocaleString('id-ID')}` : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                              {l.vat_amount != null ? `Rp ${Math.round(Number(l.vat_amount)).toLocaleString('id-ID')}` : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                              {l.total != null ? `Rp ${Math.round(Number(l.total)).toLocaleString('id-ID')}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3-1: AI 파싱 검토 */}
          <ParseReviewPanel sessionId={session.id} />

          {/* Step 3-2: 파싱검토 / 자동계산 */}
          <CalcCardsPanel sessionId={session.id} />

          {/* Step 4: 결재 */}
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-black text-slate-950 mb-3">{t('workflow.step4Title')}</p>
              <p className="text-xs text-slate-500 mb-4">
                {t('workflow.step4StatusLabel')}: <span className="font-bold text-slate-950">{session.status}</span>
                {session.supervisor_id && ` · ${t('workflow.step4SupervisorPrefix')}: ${session.supervisor_id.slice(0, 8)}…`}
              </p>
              <div className="flex flex-wrap gap-2">
                {session.status !== 'PENDING_APPROVAL' && session.status !== 'APPROVED' && session.status !== 'COMPLETED' && (
                  <Button onClick={() => submitApproval('SUBMIT')} disabled={busy}>
                    {t('workflow.approveSubmit')}
                  </Button>
                )}
                {session.status === 'PENDING_APPROVAL' && (
                  <Button variant="outline" onClick={() => submitApproval('WITHDRAW')} disabled={busy}>
                    {t('workflow.approveWithdraw')}
                  </Button>
                )}
                {isSupervisor && session.status === 'PENDING_APPROVAL' && (
                  <>
                    <Button onClick={() => submitApproval('APPROVE')} disabled={busy}>
                      {t('workflow.approveApprove')}
                    </Button>
                    <Button variant="destructive" onClick={() => submitApproval('REJECT')} disabled={busy}>
                      {t('workflow.approveReject')}
                    </Button>
                  </>
                )}
              </div>

              {approvals.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    {t('workflow.approveHistory')}
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {approvals.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <span className="font-bold">{a.action}</span> · {a.actor_role} ·{' '}
                        {new Date(a.created_at).toLocaleString()}
                        {a.comment && <span className="text-slate-500"> — {a.comment}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 5: Coretax 수기 기록 */}
          {(session.status === 'APPROVED' || session.status === 'COMPLETED') && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-black text-slate-950 mb-1">{t('workflow.step5Title')}</p>
                <p className="text-xs text-slate-500 mb-4">
                  {t('workflow.step5Hint')}
                </p>
                {coretax?.recorded_at ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2 className="mr-1 inline h-4 w-4" />
                    {t('workflow.step5RecordedPrefix')}: ID Billing {coretax.id_billing} · NTPN {coretax.ntpn}
                    {coretax.bpe_file_path && <div className="mt-1 text-xs">BPE: {coretax.bpe_file_path}</div>}
                  </div>
                ) : isSupervisor ? (
                  <p className="text-xs text-slate-500">
                    {t('supervisor.coretaxReadOnlyHint')}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder={t('workflow.step5IdBillingPlaceholder')}
                      value={crIdBilling}
                      onChange={(e) => setCrIdBilling(e.target.value)}
                    />
                    <Input
                      placeholder={t('workflow.step5NtpnPlaceholder')}
                      value={crNtpn}
                      onChange={(e) => setCrNtpn(e.target.value)}
                    />
                    <Input
                      placeholder={t('workflow.step5BpePlaceholder')}
                      value={crBpe}
                      onChange={(e) => setCrBpe(e.target.value)}
                    />
                    <div className="col-span-full">
                      <Button onClick={submitCoretax} disabled={busy || !crIdBilling || !crNtpn}>
                        {t('workflow.step5Submit')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
