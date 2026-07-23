'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, FileText, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CHART_ACCENT_POSITIVE } from '@/lib/charts/palette';

interface Session {
  id: string;
  filing_kind: 'MONTHLY' | 'ANNUAL';
  tax_period: string;
  status: string;
  current_step: number;
  total_estimated_tax: number | null;
  supervisor_id: string | null;
  created_at: string;
}
interface Customer {
  id: string;
  full_name: string | null;
  company_name: string | null;
  npwp: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
}
interface ConsultantInfo {
  id: string;
  full_name: string;
}
interface Doc {
  id: string;
  slot: string;
  original_filename: string;
  version: number;
  parse_status: string;
  uploaded_at: string;
}
interface Calc {
  id: string;
  kind: string;
  amount: number;
  customer_input_amount: number | null;
  ai_amount: number | null;
  consultant_amount: number | null;
  approved_amount: number | null;
  confidence: number | null;
  source_summary: string | null;
  rationale_summary: string | null;
}
interface ReviewRequest {
  id: string;
  calc_kind: string | null;
  item_label: string;
  reason: string;
  status: 'OPEN' | 'ANSWERED' | 'RESOLVED';
  supervisor_comment: string | null;
  answered_at: string | null;
  created_at: string;
}
interface ParseRow {
  id: string;
  document_id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
  entity_label: string | null;
  field_name: string;
  field_value: unknown;
  message_ko: string | null;
  message_id: string | null;
  is_resolved: boolean;
}
interface Approval {
  id: string;
  action: 'SUBMIT' | 'REJECT' | 'APPROVE' | 'WITHDRAW';
  actor_role: string;
  comment: string | null;
  created_at: string;
}
interface TrendPoint {
  period: string;
  sessionId: string | null;
  status: string | null;
  totalCalc: number;
  byKind: Record<string, number>;
}
interface InvoiceLine {
  id: string;
  document_id: string;
  line_no: number;
  invoice_number: string | null;
  invoice_date: string | null;
  counterparty_name: string | null;
  counterparty_npwp: string | null;
  currency: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  vat_amount: number | null;
  withholding_amount: number | null;
  total: number | null;
  parse_confidence: number | null;
  is_reviewed: boolean;
  reviewer_note: string | null;
}
interface Resp {
  session: Session;
  customer: Customer | null;
  consultant: ConsultantInfo | null;
  documents: Doc[];
  calcs: Calc[];
  parseRows: ParseRow[];
  parseCounts: { critical: number; warning: number; info: number };
  approvals: Approval[];
  coretax: { id_billing: string | null; ntpn: string | null; bpe_file_path: string | null } | null;
  trend?: TrendPoint[];
  invoiceLines?: InvoiceLine[];
  reviewRequests?: ReviewRequest[];
}

const SEVERITY_STYLE = {
  CRITICAL: { bg: '#FBE0D0', color: '#A04400', icon: AlertCircle },
  WARNING: { bg: '#FEF3C7', color: '#92400E', icon: AlertTriangle },
  INFO: { bg: '#E0F2FE', color: '#075985', icon: Info },
  OK: { bg: '#D0F0E5', color: '#00684D', icon: CheckCircle },
} as const;

const fmtRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export function SupervisorApprovalDetail({ sessionId }: { sessionId: string }) {
  const t = useTranslations('supervisorErp');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [reviewingLineId, setReviewingLineId] = useState<string | null>(null);
  const [bulkReviewBusy, setBulkReviewBusy] = useState(false);
  // v13 §4 — 검토요청 의견 입력 상태
  const [rrComment, setRrComment] = useState<Record<string, string>>({});
  const [rrBusy, setRrBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/consultant-erp/supervisor/approval/${sessionId}`);
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error || 'failed');
        return;
      }
      setData(j.data as Resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleLineReviewed = useCallback(
    async (lineId: string, next: boolean) => {
      setReviewingLineId(lineId);
      try {
        const r = await fetch(
          `/api/consultant-erp/sessions/${sessionId}/invoice-lines/${lineId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_reviewed: next }),
          },
        );
        const j = await r.json();
        if (!r.ok || !j.success) {
          toast.error(j.error || 'review toggle failed');
        } else {
          await load();
        }
      } finally {
        setReviewingLineId(null);
      }
    },
    [sessionId, load],
  );

  const bulkSetReviewed = useCallback(
    async (next: boolean) => {
      const lines = data?.invoiceLines ?? [];
      if (lines.length === 0) return;
      // Only flip rows that actually need flipping — no-op PATCH wastes
      // round-trips and pollutes the audit log.
      const targets = lines.filter((l) => l.is_reviewed !== next);
      if (targets.length === 0) return;
      setBulkReviewBusy(true);
      try {
        const results = await Promise.allSettled(
          targets.map((l) =>
            fetch(`/api/consultant-erp/sessions/${sessionId}/invoice-lines/${l.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_reviewed: next }),
            }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`${failed} / ${targets.length} ${t('invoiceLinesBulkFailed')}`);
        }
        await load();
      } finally {
        setBulkReviewBusy(false);
      }
    },
    [sessionId, data, load, t],
  );

  const editLineNote = useCallback(
    async (lineId: string, current: string | null) => {
      const input = window.prompt(t('invoiceLinesNotePrompt'), current ?? '');
      if (input === null) return; // user cancelled
      const trimmed = input.trim();
      const next = trimmed === '' ? null : trimmed.slice(0, 500);
      setReviewingLineId(lineId);
      try {
        const r = await fetch(
          `/api/consultant-erp/sessions/${sessionId}/invoice-lines/${lineId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewer_note: next }),
          },
        );
        const j = await r.json();
        if (!r.ok || !j.success) {
          toast.error(j.error || 'note save failed');
        } else {
          await load();
        }
      } finally {
        setReviewingLineId(null);
      }
    },
    [sessionId, load, t],
  );

  const runParseInvoice = useCallback(
    async (documentId: string, filename: string) => {
      setParsingDocId(documentId);
      try {
        const r = await fetch(
          `/api/consultant-erp/sessions/${sessionId}/parse-invoice`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId }),
          },
        );
        const j = await r.json();
        if (!r.ok || !j.success) {
          toast.error(j.error || t('parseInvoiceFailed', { filename }));
        } else {
          const { inserted, mode, reason } = j.data;
          if (mode === 'CLAUDE') {
            toast.success(`${filename}: ${inserted} ${t('invoiceLinesUnit')}`);
          } else {
            toast.warning(`${filename}: ${reason ?? mode}`);
          }
          await load();
        }
      } finally {
        setParsingDocId(null);
      }
    },
    [sessionId, load, t],
  );

  const decide = useCallback(
    async (action: 'APPROVE' | 'REJECT') => {
      if (action === 'REJECT' && !comment.trim()) {
        toast.error(t('decisionCommentPlaceholder'));
        return;
      }
      setBusy(action);
      try {
        const r = await fetch(`/api/consultant-erp/sessions/${sessionId}/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, comment: comment.trim() || undefined }),
        });
        const j = await r.json();
        if (!r.ok || !j.success) {
          toast.error(j.error || 'failed');
        } else {
          toast.success(action === 'APPROVE' ? t('approveSuccess') : t('rejectSuccess'));
          setComment('');
          await load();
        }
      } finally {
        setBusy(null);
      }
    },
    [sessionId, comment, load, t],
  );

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-rose-600">{error ?? 'no data'}</p>;
  }

  const { session, customer, consultant, documents, calcs, parseRows, parseCounts, approvals, trend, invoiceLines } = data;
  const reviewRequests = data.reviewRequests ?? [];
  const openRequests = reviewRequests.filter((r) => r.status === 'OPEN');

  const answerRequest = async (id: string) => {
    const commentText = (rrComment[id] ?? '').trim();
    if (!commentText) return;
    setRrBusy(id);
    try {
      const r = await fetch(`/api/consultant-erp/supervisor/review-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorComment: commentText, status: 'ANSWERED' }),
      });
      const j = await r.json();
      if (j.success) {
        toast.success(t('rrAnswered'));
        setRrComment((prev) => ({ ...prev, [id]: '' }));
        load();
      } else {
        toast.error(j.error ?? 'error');
      }
    } catch {
      toast.error(t('rrAnswerFailed'));
    } finally {
      setRrBusy(null);
    }
  };

  const invoiceDocs = documents.filter(
    (d) => d.slot === 'WITHHOLDING_INVOICE' || d.slot === 'VAT_IN_OUT',
  );

  const totalCalc = calcs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const submissionCount = approvals.filter((a) => a.action === 'SUBMIT').length;
  const docFilledCount = documents.filter((d) => !!d.original_filename).length;
  const reviewedCount = parseRows.filter((p) => p.is_resolved).length;
  const reviewedComplete = parseRows.length === 0 || reviewedCount === parseRows.length;

  // Trend chart data: drop leading zero-only periods so we don't bury the
  // signal under months that pre-date this customer's relationship with us.
  const trendData = (trend ?? []).map((p) => ({
    period: p.period.slice(2), // 'YY-MM'
    totalCalc: p.totalCalc,
    isCurrent: p.sessionId === session.id,
  }));
  const trendNonZero = trendData.filter((p) => p.totalCalc > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-slate-950 text-white p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
              {session.status === 'PENDING_APPROVAL' ? t('supervisorApprovalPending') : session.status}
            </p>
            <p className="mt-1 text-2xl font-black">
              {customer?.company_name || customer?.full_name || '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {session.filing_kind} {session.tax_period.slice(0, 7)}
              {customer?.npwp && ` · ${customer.npwp}`}
              {consultant && t('assigneePrefix', { name: consultant.full_name })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center min-w-[300px]">
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400">{t('caseTotalCalc')}</p>
              <p className="text-xl font-black mt-1">{fmtRp(totalCalc)}</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400">{t('caseDocReview')}</p>
              <p className="text-xl font-black mt-1">{docFilledCount}/{documents.length || 5}</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400">{t('caseConfirmNeeded')}</p>
              <p
                className="text-xl font-black mt-1"
                style={{ color: parseCounts.critical + parseCounts.warning > 0 ? '#FCA5A5' : '#FFFFFF' }}
              >
                {parseCounts.critical + parseCounts.warning}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400">{t('caseCompleteness')}</p>
              <p className="text-xs font-bold mt-1" style={{ color: reviewedComplete ? '#86EFAC' : '#FCD34D' }}>
                {reviewedComplete ? t('reviewedComplete') : t('inProgress')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Findings strip */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatChip
          label={t('casePayrollAudit')}
          value={`${t('findingsCritical')} ${parseCounts.critical} · ${t('findingsWarning')} ${parseCounts.warning}`}
          tone={parseCounts.critical > 0 ? '#A04400' : '#92400E'}
        />
        <StatChip
          label={t('caseBankRecon')}
          value={`${t('caseConfirmNeeded')} ${t('countSuffix', { n: parseCounts.info })}`}
          tone="#075985"
        />
        <StatChip
          label={t('caseCompleteness')}
          value={reviewedComplete ? t('reviewedComplete') : `${reviewedCount}/${parseRows.length}`}
          tone={reviewedComplete ? '#00684D' : '#92400E'}
        />
      </section>

      {/* v13 §4 — 고객 입력값 / AI 계산값 / 상담원 처리값 / 최종값 비교 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('diffHeading')}</p>
        {calcs.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">{t('diffColItem')}</th>
                  <th className="px-2 py-2 text-right">{t('diffColCustomer')}</th>
                  <th className="px-2 py-2 text-right">{t('diffColAi')}</th>
                  <th className="px-2 py-2 text-right">{t('diffColConsultant')}</th>
                  <th className="px-2 py-2 text-right">{t('diffColFinal')}</th>
                </tr>
              </thead>
              <tbody>
                {calcs.map((c) => {
                  const aiVal = c.ai_amount ?? c.amount;
                  const edited = c.consultant_amount != null && Number(c.consultant_amount) !== Number(aiVal);
                  const finalVal = c.approved_amount ?? c.amount;
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-2 py-2.5">
                        <p className="font-bold text-slate-700">{c.kind}</p>
                        {c.rationale_summary && <p className="text-[10px] text-slate-400">{c.rationale_summary}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-500">
                        {c.customer_input_amount != null ? fmtRp(Number(c.customer_input_amount)) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-700">{fmtRp(Number(aiVal))}</td>
                      <td className={`px-2 py-2.5 text-right ${edited ? 'font-bold text-amber-700' : 'text-slate-400'}`}>
                        {c.consultant_amount != null ? fmtRp(Number(c.consultant_amount)) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-black text-emerald-700">
                        {fmtRp(Number(finalVal))}
                        {c.approved_amount != null && (
                          <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            {t('diffApprovedBadge')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-slate-400">{t('diffFootnote')}</p>
          </div>
        )}
      </section>

      {/* v13 §4 — 상담원 수퍼바이저 검토요청 */}
      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-950">{t('rrHeading')}</p>
          {openRequests.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {t('rrOpenBadge', { count: openRequests.length })}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {t('rrAllAnswered')}
            </span>
          )}
        </div>
        {openRequests.length > 0 && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {t('rrApproveBlocked')}
          </p>
        )}
        {reviewRequests.length === 0 ? (
          <p className="text-xs text-slate-400">{t('rrEmpty')}</p>
        ) : (
          <div className="space-y-2.5">
            {reviewRequests.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {r.item_label}
                      {r.calc_kind && <span className="ml-1.5 text-[10px] font-normal text-slate-400">({r.calc_kind})</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">{r.reason}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {r.status === 'OPEN' ? t('rrStatusOpen') : t('rrStatusAnswered')}
                  </span>
                </div>
                {r.status === 'OPEN' ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[11px] outline-none focus:border-violet-300"
                      placeholder={t('rrCommentPlaceholder')}
                      value={rrComment[r.id] ?? ''}
                      onChange={(e) => setRrComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <button
                      className="h-8 rounded-lg bg-violet-600 px-3 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                      disabled={rrBusy === r.id || !(rrComment[r.id] ?? '').trim()}
                      onClick={() => answerRequest(r.id)}
                    >
                      {rrBusy === r.id ? '…' : t('rrAnswerBtn')}
                    </button>
                  </div>
                ) : (
                  r.supervisor_comment && (
                    <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] text-violet-800">
                      💬 {r.supervisor_comment}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6-month trend (MONTHLY only) */}
      {session.filing_kind === 'MONTHLY' && trendData.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-slate-950">{t('trendHeading')}</p>
            <p className="text-[10px] text-slate-500">{t('trendSubtitle')}</p>
          </div>
          {trendNonZero === 0 ? (
            <p className="text-xs text-slate-400">{t('trendEmpty')}</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickFormatter={(v) => {
                      const n = typeof v === 'number' ? v : 0;
                      if (n >= 1_000_000_000) return `${Math.round(n / 100_000_000) / 10}B`;
                      if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
                      if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
                      return String(n);
                    }}
                  />
                  <Tooltip
                    formatter={(v) => fmtRp(typeof v === 'number' ? v : 0)}
                    labelFormatter={(l) => `${t('trendTooltipPeriodPrefix')} ${l}`}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalCalc"
                    stroke={CHART_ACCENT_POSITIVE}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_ACCENT_POSITIVE }}
                    activeDot={{ r: 5 }}
                    name={t('trendLineLabel')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {/* Findings */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <p className="text-sm font-black text-slate-950">{t('findingsHeading')}</p>
          <div className="flex gap-2 text-[11px]">
            <Pill text={`${t('findingsCritical')} ${parseCounts.critical}`} bg="#FBE0D0" color="#A04400" />
            <Pill text={`${t('findingsWarning')} ${parseCounts.warning}`} bg="#FEF3C7" color="#92400E" />
            <Pill text={`${t('findingsInfo')} ${parseCounts.info}`} bg="#E0F2FE" color="#075985" />
          </div>
        </div>
        {parseRows.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <ul className="space-y-2">
            {parseRows.slice(0, 15).map((r) => {
              const cfg = SEVERITY_STYLE[r.severity];
              const Icon = cfg.icon;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border p-2 flex items-start gap-2 text-xs"
                  style={{ borderColor: cfg.color + '30', backgroundColor: cfg.bg + '40' }}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: cfg.color }} />
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">
                      {r.field_name}
                      {r.entity_label && <span className="font-normal text-slate-600"> · {r.entity_label}</span>}
                    </p>
                    {r.message_ko && <p className="text-slate-700 text-[11px]">{r.message_ko}</p>}
                  </div>
                  {r.is_resolved && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ backgroundColor: '#D0F0E5', color: '#00684D' }}
                    >
                      {t('findingsResolved')}
                    </span>
                  )}
                </li>
              );
            })}
            {parseRows.length > 15 && (
              <li className="text-[10px] text-slate-500 text-center pt-1">
                … +{parseRows.length - 15}
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Invoice line-items (PDF p.4) */}
      {(invoiceDocs.length > 0 || (invoiceLines && invoiceLines.length > 0)) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-black text-slate-950">{t('invoiceLinesHeading')}</p>
            <div className="flex items-center gap-3">
              {invoiceLines && invoiceLines.length > 0 && (() => {
                const reviewedCount = invoiceLines.filter((l) => l.is_reviewed).length;
                const allReviewed = reviewedCount === invoiceLines.length;
                return (
                  <button
                    onClick={() => void bulkSetReviewed(!allReviewed)}
                    disabled={bulkReviewBusy}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {bulkReviewBusy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}{' '}
                    {allReviewed ? t('invoiceLinesBulkUnreview') : t('invoiceLinesBulkReview')}
                  </button>
                );
              })()}
              <p className="text-[10px] text-slate-500">
                {invoiceLines?.length ?? 0} {t('invoiceLinesUnit')}
                {invoiceLines && invoiceLines.length > 0 && (
                  <span className="ml-2 text-emerald-700">
                    · {invoiceLines.filter((l) => l.is_reviewed).length} {t('invoiceLinesReviewedCount')}
                  </span>
                )}
              </p>
            </div>
          </div>
          {invoiceDocs.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {invoiceDocs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => runParseInvoice(d.id, d.original_filename)}
                  disabled={parsingDocId === d.id}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  {parsingDocId === d.id ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="inline h-3 w-3" />
                  )}{' '}
                  {t('invoiceLinesParse')} · {d.original_filename}
                </button>
              ))}
            </div>
          )}
          {(!invoiceLines || invoiceLines.length === 0) ? (
            <p className="text-xs text-slate-400">{t('invoiceLinesEmpty')}</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-2 px-2 w-8">✓</th>
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">{t('invoiceLinesCounterparty')}</th>
                  <th className="text-left py-2 px-2">{t('invoiceLinesInvoice')}</th>
                  <th className="text-left py-2 px-2">{t('invoiceLinesDescription')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesQty')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesUnitPrice')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesSubtotal')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesVat')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesWithholding')}</th>
                  <th className="text-right py-2 px-2">{t('invoiceLinesTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceLines.map((l) => (
                  <tr key={l.id} className={l.is_reviewed ? 'bg-emerald-50/40' : ''}>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={l.is_reviewed}
                        disabled={reviewingLineId === l.id}
                        onChange={(e) => void toggleLineReviewed(l.id, e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer accent-emerald-600 disabled:opacity-50"
                      />
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{l.line_no}</td>
                    <td className="py-1.5 px-2">
                      <p className="font-bold text-slate-900">{l.counterparty_name ?? '—'}</p>
                      {l.counterparty_npwp && (
                        <p className="text-[9px] font-mono text-slate-500">{l.counterparty_npwp}</p>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <p className="text-slate-800">{l.invoice_number ?? '—'}</p>
                      {l.invoice_date && (
                        <p className="text-[9px] text-slate-500">{l.invoice_date}</p>
                      )}
                    </td>
                    <td className="py-1.5 px-2 max-w-[220px] text-slate-700">
                      <div className="flex items-start gap-1.5">
                        <p className="flex-1 truncate">{l.description ?? '—'}</p>
                        <button
                          onClick={() => void editLineNote(l.id, l.reviewer_note)}
                          disabled={reviewingLineId === l.id}
                          title={t('invoiceLinesNoteBtn')}
                          className="rounded-full px-1 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-50"
                        >
                          {l.reviewer_note ? '✎' : '+'}
                        </button>
                      </div>
                      {l.reviewer_note && (
                        <p className="mt-0.5 text-[10px] italic text-emerald-700">
                          📝 {l.reviewer_note}
                        </p>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700">
                      {l.quantity != null ? Number(l.quantity).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700 font-mono">
                      {l.unit_price != null ? fmtRp(Number(l.unit_price)) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700 font-mono">
                      {l.subtotal != null ? fmtRp(Number(l.subtotal)) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700 font-mono">
                      {l.vat_amount != null ? fmtRp(Number(l.vat_amount)) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-700 font-mono">
                      {l.withholding_amount != null ? fmtRp(Number(l.withholding_amount)) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-slate-900 font-mono">
                      {l.total != null ? fmtRp(Number(l.total)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={7} className="py-2 px-2 text-right text-slate-700">
                    {t('invoiceLinesGrandTotal')}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900">
                    {fmtRp(invoiceLines.reduce((s, l) => s + Number(l.subtotal ?? 0), 0))}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900">
                    {fmtRp(invoiceLines.reduce((s, l) => s + Number(l.vat_amount ?? 0), 0))}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900">
                    {fmtRp(invoiceLines.reduce((s, l) => s + Number(l.withholding_amount ?? 0), 0))}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900">
                    {fmtRp(invoiceLines.reduce((s, l) => s + Number(l.total ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </section>
      )}

      {/* Documents */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('documentsHeading')}</p>
        {documents.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-3">{t('thSlot')}</th>
                <th className="text-left py-2 px-3">{t('thFilename')}</th>
                <th className="text-center py-2 px-3">{t('thVersion')}</th>
                <th className="text-center py-2 px-3">{t('thParseStatus')}</th>
                <th className="text-left py-2 px-3">{t('thUploadedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="py-2 px-3 font-bold text-slate-900">{d.slot}</td>
                  <td className="py-2 px-3">
                    <p className="flex items-center gap-1 text-slate-700">
                      <FileText className="h-3 w-3" /> {d.original_filename}
                    </p>
                  </td>
                  <td className="py-2 px-3 text-center text-slate-700">v{d.version}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={
                        d.parse_status === 'PARSED'
                          ? { backgroundColor: '#D0F0E5', color: '#00684D' }
                          : { backgroundColor: '#F1F5F9', color: '#64748B' }
                      }
                    >
                      {d.parse_status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[10px] text-slate-500 font-mono">
                    {new Date(d.uploaded_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Decision */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('decisionHeading')}</p>
        <div className="grid gap-3 sm:grid-cols-3 mb-4 text-xs">
          <KV label={t('decisionStatus')} value={session.status} />
          <KV label={t('decisionResubmitCount')} value={t('timesSuffix', { n: submissionCount })} />
          <KV label={t('decisionAssignee')} value={consultant?.full_name ?? '—'} />
        </div>
        <label className="text-[11px] text-slate-600">{t('decisionCommentLabel')}</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('decisionCommentPlaceholder')}
          disabled={session.status !== 'PENDING_APPROVAL'}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            onClick={() => decide('APPROVE')}
            disabled={!!busy || session.status !== 'PENDING_APPROVAL' || openRequests.length > 0}
            title={openRequests.length > 0 ? t('rrApproveBlocked') : undefined}
            style={{ backgroundColor: '#009E73' }}
            className="min-h-11 text-white"
          >
            {busy === 'APPROVE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            {t('decisionApprove')}
          </Button>
          <Button
            onClick={() => decide('REJECT')}
            disabled={!!busy || session.status !== 'PENDING_APPROVAL'}
            style={{ backgroundColor: '#D55E00' }}
            className="min-h-11 text-white"
          >
            {busy === 'REJECT' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
            {t('decisionReject')}
          </Button>
        </div>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('historyHeading')}</p>
        {approvals.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={
                      a.action === 'APPROVE'
                        ? { backgroundColor: '#D0F0E5', color: '#00684D' }
                        : a.action === 'REJECT'
                          ? { backgroundColor: '#FBE0D0', color: '#A04400' }
                          : a.action === 'WITHDRAW'
                            ? { backgroundColor: '#F1F5F9', color: '#475569' }
                            : { backgroundColor: '#DBEAFE', color: '#1D4ED8' }
                    }
                  >
                    {a.action}
                  </span>
                  <span className="text-slate-700">{a.actor_role}</span>
                  {a.comment && <span className="text-slate-500">— {a.comment}</span>}
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-black mt-0.5" style={{ color: tone }}>{value}</p>
    </div>
  );
}
function Pill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 font-bold" style={{ backgroundColor: bg, color }}>
      {text}
    </span>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
