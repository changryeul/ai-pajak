'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, FileText, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  confidence: number | null;
  source_summary: string | null;
  rationale_summary: string | null;
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

  const { session, customer, consultant, documents, calcs, parseRows, parseCounts, approvals } = data;

  const totalCalc = calcs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const submissionCount = approvals.filter((a) => a.action === 'SUBMIT').length;
  const docFilledCount = documents.filter((d) => !!d.original_filename).length;
  const reviewedCount = parseRows.filter((p) => p.is_resolved).length;
  const reviewedComplete = parseRows.length === 0 || reviewedCount === parseRows.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-slate-950 text-white p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
              {session.status === 'PENDING_APPROVAL' ? '수퍼바이저 승인대기' : session.status}
            </p>
            <p className="mt-1 text-2xl font-black">
              {customer?.company_name || customer?.full_name || '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {session.filing_kind} {session.tax_period.slice(0, 7)}
              {customer?.npwp && ` · ${customer.npwp}`}
              {consultant && ` · 담당 ${consultant.full_name}`}
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
                {reviewedComplete ? t('reviewedComplete') : '진행중'}
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
          value={`${t('caseConfirmNeeded')} ${parseCounts.info}건`}
          tone="#075985"
        />
        <StatChip
          label={t('caseCompleteness')}
          value={reviewedComplete ? t('reviewedComplete') : `${reviewedCount}/${parseRows.length}`}
          tone={reviewedComplete ? '#00684D' : '#92400E'}
        />
      </section>

      {/* Auto-calc results */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-950 mb-3">{t('calcsHeading')}</p>
        {calcs.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {calcs.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">{c.kind}</p>
                  {c.confidence != null && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: '#D0F0E5', color: '#00684D' }}
                    >
                      {t('calcConfidence')} {c.confidence}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-black text-emerald-700 mt-2">{fmtRp(Number(c.amount))}</p>
                {c.source_summary && <p className="text-[10px] text-slate-500 mt-1">{c.source_summary}</p>}
                {c.rationale_summary && <p className="text-[10px] text-slate-400 mt-0.5">{c.rationale_summary}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

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
          <KV label={t('decisionResubmitCount')} value={`${submissionCount}회`} />
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
            disabled={!!busy || session.status !== 'PENDING_APPROVAL'}
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
