'use client';

/**
 * Workload assignment / recall — Supervisor console (PDF p.3-6).
 *
 * 3-column layout:
 *   left   : new / unassigned case list
 *   center : operator-assignment console — preferred / auto / exclude / recall / SV transfer
 *   right  : selected case detail + Sticky Assignment + operator instruction
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, Send, ArrowRightLeft } from 'lucide-react';

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  tax_type: string;
  service_label: string | null;
  amount: number;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | null;
  operator_id: string | null;
  supervisor_id: string | null;
  due_date: string | null;
  created_at: string;
  customer: { id: string; full_name: string; company_name: string | null; npwp: string | null } | null;
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
}

interface CaseDetail extends CaseRow {
  notes: string | null;
  pastCases: Array<{ id: string; case_code: string | null; status: string; operator: { employee_id: string; name: string } | null }>;
  preferredOperatorId: string | null;
}

interface OperatorRow {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  work_state: string;
  auto_assign_enabled: boolean;
  status: string;
  active_load: number;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  PENDING_DOCS: 'bg-amber-100 text-amber-800',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'text-rose-700 bg-rose-50 border-rose-200',
  HIGH: 'text-orange-700 bg-orange-50 border-orange-200',
  NORMAL: 'text-slate-600 bg-slate-50 border-slate-200',
  LOW: 'text-slate-500 bg-slate-50 border-slate-200',
};

export default function WorkloadPage() {
  const t = useTranslations('operatorWorkload');
  const { session } = useSession();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [supervisors, setSupervisors] = useState<OperatorRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pickedOperatorId, setPickedOperatorId] = useState<string>('');
  const [instruction, setInstruction] = useState('');

  // Safe enum label helpers — next-intl throws on missing keys, and the
  // model may return unknown enum values from the API.
  const statusLabel = (key: string) => {
    try { return t(`status.${key}`); } catch { return key; }
  };
  const workStateLabel = (key: string) => {
    try { return t(`workState.${key}`); } catch { return key; }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [casesRes, opsRes] = await Promise.all([
        fetch('/api/operator/cases?scope=all'),
        fetch('/api/operator/workload'),
      ]);
      const casesJson = await casesRes.json();
      const opsJson = await opsRes.json();
      if (casesJson.success) setCases(casesJson.data.items as CaseRow[]);
      if (opsJson.success) {
        const ops = (opsJson.data.operators ?? []) as Array<{ id: string; name: string; employee_id: string; role: string; status: string; active_items?: number; work_state?: string; auto_assign_enabled?: boolean }>;
        const all: OperatorRow[] = ops.map(o => ({
          id: o.id,
          employee_id: o.employee_id,
          name: o.name,
          role: o.role,
          work_state: o.work_state ?? 'available',
          auto_assign_enabled: o.auto_assign_enabled ?? true,
          status: o.status,
          active_load: o.active_items ?? 0,
        }));
        setOperators(all.filter(o => o.role === 'tax_operator'));
        setSupervisors(all.filter(o => o.role === 'tax_operator_supervisor'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/operator/cases/${id}`);
    const json = await res.json();
    if (json.success) setDetail(json.data as CaseDetail);
  }, []);

  useEffect(() => {
    if (!selectedCaseId) { setDetail(null); return; }
    loadDetail(selectedCaseId);
  }, [selectedCaseId, loadDetail]);

  const eligibleOperators = useMemo(
    () => operators.filter(o => o.work_state !== 'offline' && o.work_state !== 'resigned'),
    [operators],
  );
  const excludedOperators = useMemo(
    () => operators.filter(o => !o.auto_assign_enabled || o.work_state === 'break' || o.work_state === 'offline' || o.work_state === 'resigned'),
    [operators],
  );

  const caseAction = async (action: string, body: Record<string, unknown> = {}) => {
    if (!selectedCaseId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/operator/cases/${selectedCaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ type: 'err', text: json.error || t('actionFailed', { action }) });
      } else {
        setMessage({ type: 'ok', text: t('actionDone', { action }) });
        await loadAll();
        await loadDetail(selectedCaseId);
      }
    } finally {
      setBusy(false);
    }
  };

  const myCases = cases.filter(c => session?.userId && c.supervisor?.employee_id);
  const todayLoggedIn = operators.filter(o => o.work_state !== 'offline').length;
  const autoEligible = operators.filter(o => o.auto_assign_enabled && (o.work_state === 'available' || o.work_state === 'reviewing' || o.work_state === 'consulting')).length;

  if (!session) {
    return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1500px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('pageDesc')}</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('refresh')}
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-2 text-sm font-bold ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.type === 'ok' ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
          {message.text}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard label={t('kpi.mySupervisorPending')} value={String(myCases.filter(c => !c.operator_id).length)} />
        <KpiCard label={t('kpi.todayLoggedIn')} value={t('kpi.personSuffix', { n: todayLoggedIn })} />
        <KpiCard label={t('kpi.autoEligible')} value={t('kpi.personSuffix', { n: autoEligible })} />
        <KpiCard label={t('kpi.autoExcluded')} value={t('kpi.personSuffix', { n: excludedOperators.length })} />
        <KpiCard label={t('kpi.selectedCase')} value={detail?.case_code || '-'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-4">
        {/* Left: case list */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">{t('list.title')}</h2>
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
            {cases.map(c => {
              const isSel = c.id === selectedCaseId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${isSel ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {c.customer?.company_name || c.customer?.full_name || '—'}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-700'}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {c.case_code ?? '-'} · {c.service_label || c.tax_type}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('list.assigneePrefix', { id: c.operator?.employee_id ?? t('list.unassigned') })}
                    <span className={`ml-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_COLOR[c.priority || 'NORMAL']}`}>
                      {c.priority || 'NORMAL'}
                    </span>
                  </p>
                </button>
              );
            })}
            {cases.length === 0 && !loading && (
              <p className="text-xs text-slate-400 text-center py-8">{t('list.empty')}</p>
            )}
          </div>
        </section>

        {/* Center: assignment console */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-3">{t('console.title')}</h2>
          <p className="text-xs text-slate-500 mb-4">{t('console.desc')}</p>

          {!detail ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              {t('console.emptyState')}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Decision summary */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t('decision.title')}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <Field label={t('decision.currentSupervisor')} value={detail.supervisor ? `${detail.supervisor.name} (${detail.supervisor.employee_id})` : t('decision.notDistributed')} />
                  <Field label={t('decision.currentOperator')} value={detail.operator ? detail.operator.employee_id : t('decision.unassigned')} />
                  <Field label={t('decision.assignMode')} value={detail.operator_id ? t('decision.autoAssigned') : t('decision.unassigned')} />
                  <Field label={t('decision.requestReceived')} value={detail.created_at?.slice(0, 10) || '-'} />
                </div>
              </div>

              {/* 1. Preferred operator */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t('preferred.title')} <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Preferred</span></h3>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">{t('preferred.desc')}</p>
                <div className="text-xs text-slate-700 mb-3">
                  {t('preferred.candidateLabel')} <span className="font-bold">
                    {detail.preferredOperatorId
                      ? (operators.find(o => o.id === detail.preferredOperatorId)?.name ?? detail.preferredOperatorId)
                      : t('preferred.none')}
                  </span>
                </div>
                <button
                  disabled={!detail.preferredOperatorId || busy}
                  onClick={() => caseAction('assign-preferred')}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('preferred.btn')}
                </button>
              </div>

              {/* 2. Auto assign */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t('auto.title')} <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Auto</span></h3>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">{t('auto.desc')}</p>
                <button
                  disabled={busy}
                  onClick={() => caseAction('auto-assign')}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t('auto.btn')}
                </button>
              </div>

              {/* 3. Exclude */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t('exclude.title')}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t('exclude.excludedBadge', { n: excludedOperators.length })}</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">{t('exclude.desc')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {operators.map(o => {
                    const excluded = !o.auto_assign_enabled || o.work_state === 'break' || o.work_state === 'offline' || o.work_state === 'resigned';
                    return (
                      <div key={o.id} className={`rounded-lg border p-2 text-xs ${excluded ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200 bg-white'}`}>
                        <div className="font-bold text-slate-900">{o.name} <span className="text-slate-400 font-normal">{o.employee_id}</span></div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{t('exclude.statusLabel')} {workStateLabel(o.work_state)} · {t('exclude.loadLabel', { n: o.active_load })}</div>
                        <div className={`text-[10px] mt-0.5 font-bold ${excluded ? 'text-slate-400' : 'text-emerald-700'}`}>
                          {excluded ? t('exclude.excluded') : t('exclude.candidate')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Recall */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t('recall.title')}</h3>
                  <button
                    disabled={!detail.operator_id || busy}
                    onClick={() => caseAction('recall')}
                    className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {t('recall.recallBtn')}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">{t('recall.desc')}</p>
                <div className="flex flex-col gap-2">
                  <select
                    value={pickedOperatorId}
                    onChange={(e) => setPickedOperatorId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{t('recall.selectPlaceholder')}</option>
                    {eligibleOperators.map(o => (
                      <option key={o.id} value={o.id}>
                        {t('recall.selectOption', { name: o.name, id: o.employee_id, state: workStateLabel(o.work_state), n: o.active_load })}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!pickedOperatorId || busy}
                    onClick={() => caseAction('assign', { operatorId: pickedOperatorId })}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {t('recall.assignBtn')}
                  </button>
                </div>
              </div>

              {/* Supervisor transfer */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                <h3 className="text-sm font-black text-slate-900 mb-2">{t('transferSupervisor.title')}</h3>
                <p className="text-[11px] text-slate-600 mb-3">{t('transferSupervisor.desc')}</p>
                <div className="flex flex-wrap gap-2">
                  {supervisors.map(sv => (
                    <button
                      key={sv.id}
                      disabled={busy || sv.id === detail.supervisor_id}
                      onClick={() => caseAction('transfer-supervisor', { supervisorId: sv.id })}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${sv.id === detail.supervisor_id ? 'bg-slate-200 text-slate-500' : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'}`}
                    >
                      {t('transferSupervisor.btn', { name: sv.name, n: sv.active_load })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: case detail + sticky info + supervisor instruction */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-3">{t('detail.title')}</h2>
          {!detail ? (
            <p className="text-xs text-slate-400">{t('detail.empty')}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-slate-500">{detail.case_code} · {detail.service_label || detail.tax_type}</p>
                <p className="text-lg font-black text-slate-900">{detail.customer?.company_name || detail.customer?.full_name || '—'}</p>
                <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[detail.status] || 'bg-slate-100 text-slate-700'}`}>
                  {statusLabel(detail.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label={t('detail.operator')} value={detail.operator?.employee_id ?? '—'} />
                <Field label={t('detail.supervisor')} value={detail.supervisor?.employee_id ?? '—'} />
                <Field label={t('detail.priority')} value={detail.priority ?? 'NORMAL'} />
                <Field label={t('detail.due')} value={detail.due_date ? formatDue(detail.due_date) : '-'} />
              </div>

              {/* Sticky Assignment */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-black text-slate-900">{t('sticky.title')}</p>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{t('sticky.badge')}</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">
                  {t('sticky.summary', { n: detail.pastCases.length })}
                  <b>
                    {detail.preferredOperatorId
                      ? operators.find(o => o.id === detail.preferredOperatorId)?.name ?? '—'
                      : t('preferred.none')}
                  </b>
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {detail.pastCases.slice(0, 5).map(p => (
                    <li key={p.id}>· {p.case_code ?? '-'} · {statusLabel(p.status)} · {p.operator?.employee_id ?? t('list.unassigned')}</li>
                  ))}
                  {detail.pastCases.length === 0 && <li className="text-slate-400">{t('sticky.noPast')}</li>}
                </ul>
              </div>

              {/* Operator instruction */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-black text-slate-900 mb-1">{t('instruction.title')}</p>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  placeholder={t('instruction.placeholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <button
                  disabled={busy || !instruction.trim()}
                  onClick={async () => { await caseAction('instruct', { note: instruction }); setInstruction(''); }}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-3 w-3 inline mr-1" /> {t('instruction.sendBtn')}
                </button>
                {detail.notes && (
                  <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                    {detail.notes}
                  </pre>
                )}
              </div>

              {/* Bulk Transfer */}
              <BulkTransferPanel operators={operators} supervisors={supervisors} onDone={loadAll} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BulkTransferPanel({
  operators, supervisors, onDone,
}: {
  operators: OperatorRow[];
  supervisors: OperatorRow[];
  onDone: () => Promise<void> | void;
}) {
  const t = useTranslations('operatorWorkload');
  const [mode, setMode] = useState<'operator' | 'supervisor'>('operator');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [preview, setPreview] = useState<{ activeCount?: number; completedCount?: number; managedOperatorCount?: number; customerCount?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const list = mode === 'operator' ? operators : supervisors;

  const workStateLabel = (key: string) => {
    try { return t(`workState.${key}`); } catch { return key; }
  };

  useEffect(() => {
    setFromId('');
    setToId('');
    setPreview(null);
    setMsg('');
  }, [mode]);

  useEffect(() => {
    if (!fromId) { setPreview(null); return; }
    const params = new URLSearchParams({ mode, fromId });
    fetch(`/api/operator/team/bulk-transfer?${params}`).then(r => r.json()).then(j => {
      if (j.success) setPreview(j.data);
    }).catch(() => setPreview(null));
  }, [mode, fromId]);

  const run = async () => {
    if (!fromId || !toId) return;
    if (!confirm(t('bulkTransfer.confirm'))) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/operator/team/bulk-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, fromId, toId }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setMsg(j.error || t('bulkTransfer.failed'));
      } else {
        setMsg(t('bulkTransfer.done', { n: j.data?.transferred ?? 0 }));
        await onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-3">
      <div className="flex items-center gap-1 text-[11px] font-black text-rose-800 mb-2">
        <ArrowRightLeft className="h-3 w-3" /> {t('bulkTransfer.title')}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] flex items-center gap-1">
          <input type="radio" checked={mode === 'operator'} onChange={() => setMode('operator')} /> {t('bulkTransfer.operator')}
        </label>
        <label className="text-[11px] flex items-center gap-1">
          <input type="radio" checked={mode === 'supervisor'} onChange={() => setMode('supervisor')} /> {t('bulkTransfer.supervisor')}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="">{t('bulkTransfer.fromPlaceholder')}</option>
          {list.map(o => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.employee_id}) · {workStateLabel(o.work_state)}
            </option>
          ))}
        </select>
        <select value={toId} onChange={(e) => setToId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="">{t('bulkTransfer.toPlaceholder')}</option>
          {list.filter(o => o.id !== fromId && o.work_state !== 'resigned' && o.work_state !== 'offline').map(o => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.employee_id}) · {workStateLabel(o.work_state)}
            </option>
          ))}
        </select>
      </div>
      {preview && (
        <div className="mt-2 rounded-lg bg-white p-2 text-[10px] text-slate-700 space-y-0.5">
          {mode === 'operator' && (
            <>
              <p>{t('bulkTransfer.previewActive')}<b>{t('bulkTransfer.caseUnit', { n: preview.activeCount ?? 0 })}</b></p>
              <p>{t('bulkTransfer.previewCustomer')}<b>{t('bulkTransfer.placeUnit', { n: preview.customerCount ?? 0 })}</b></p>
            </>
          )}
          {mode === 'supervisor' && (
            <>
              <p>{t('bulkTransfer.previewActive')}<b>{t('bulkTransfer.caseUnit', { n: preview.activeCount ?? 0 })}</b></p>
              <p>{t('bulkTransfer.previewCompleted')}<b>{t('bulkTransfer.caseUnit', { n: preview.completedCount ?? 0 })}</b></p>
              <p>{t('bulkTransfer.previewManaged')}<b>{t('bulkTransfer.personUnit', { n: preview.managedOperatorCount ?? 0 })}</b></p>
            </>
          )}
        </div>
      )}
      <button
        disabled={!fromId || !toId || busy}
        onClick={run}
        className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {busy ? t('bulkTransfer.running') : t('bulkTransfer.runBtn')}
      </button>
      {msg && <p className="mt-2 text-[10px] font-bold text-emerald-700">{msg}</p>}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-0.5 truncate">{value}</p>
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
