'use client';

/**
 * 업무 배정/회수 — Supervisor 콘솔 (PDF p.3-6 명세 기준).
 *
 * 3-column layout:
 *   좌  : 신규/배정 대상 케이스 리스트
 *   중앙: 업무요청 상담원 배정 콘솔 — 우선지원 / 자동배정 / 제외 / 환수 / SV 이관
 *   우  : 선택 케이스 상세 + Sticky Assignment + 상담원 지시
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { Loader2, AlertTriangle, CheckCircle, Users, BarChart3, RefreshCw, Send, ArrowRightLeft, Sparkles } from 'lucide-react';

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

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  PENDING_DOCS: '자료요청',
  DATA_REVIEW: '검토중',
  PENDING_APPROVAL: '승인요청',
  APPROVED: '승인',
  EBILLING_GENERATED: 'eBilling',
  PAYMENT_PENDING: '납부대기',
  PAYMENT_UPLOADED: '납부영수증',
  PAYMENT_VERIFIED: '납부확인',
  DJP_SUBMITTED: 'DJP제출',
  BPE_UPLOADED: 'BPE',
  COMPLETED: '신고완료',
  FAILED: '실패',
};

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

const WORK_STATE_LABEL: Record<string, string> = {
  available: '대기',
  consulting: '상담중',
  reviewing: '검토중',
  coretax: 'Coretax작업중',
  break: '휴식',
  offline: '오프라인',
  resigned: '퇴사',
};

export default function WorkloadPage() {
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
        setMessage({ type: 'err', text: json.error || `${action} 실패` });
      } else {
        setMessage({ type: 'ok', text: `${action} 처리됨` });
        await loadAll();
        await loadDetail(selectedCaseId);
      }
    } finally {
      setBusy(false);
    }
  };

  const myCases = cases.filter(c => session?.userId && c.supervisor?.employee_id);
  // Note: we can't directly compare supervisor user_id from the row alone here;
  // use API scope=mine instead in a future iteration. For now, "내 SV 대기" =
  // unassigned cases (supervisor 자동배분 받았지만 operator 미지정).
  const unassignedCount = cases.filter(c => !c.operator_id).length;
  const todayLoggedIn = operators.filter(o => o.work_state !== 'offline').length;
  const autoEligible = operators.filter(o => o.auto_assign_enabled && (o.work_state === 'available' || o.work_state === 'reviewing' || o.work_state === 'consulting')).length;

  if (!session) {
    return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1500px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">업무 배정/회수</h1>
          <p className="text-sm text-slate-500 mt-1">신규 업무는 Supervisor에게 균등 자동배분되고, 상담이력 고객은 기존 상담원에게 우선 자동배정됩니다.</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 새로고침
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
        <KpiCard label="내 Supervisor 대기" value={String(myCases.filter(c => !c.operator_id).length)} />
        <KpiCard label="오늘 로그인 상담원" value={`${todayLoggedIn}명`} />
        <KpiCard label="자동배정 가능" value={`${autoEligible}명`} />
        <KpiCard label="자동배정 제외" value={`${excludedOperators.length}명`} />
        <KpiCard label="선택 케이스" value={detail?.case_code || '-'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-4">
        {/* Left: case list */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">신규/배정 대상</h2>
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
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {c.case_code ?? '-'} · {c.service_label || c.tax_type}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    담당 {c.operator?.employee_id ?? '미배정'}
                    <span className={`ml-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_COLOR[c.priority || 'NORMAL']}`}>
                      {c.priority || 'NORMAL'}
                    </span>
                  </p>
                </button>
              );
            })}
            {cases.length === 0 && !loading && (
              <p className="text-xs text-slate-400 text-center py-8">케이스가 없습니다.</p>
            )}
          </div>
        </section>

        {/* Center: assignment console */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-3">업무요청 상담원 배정 콘솔</h2>
          <p className="text-xs text-slate-500 mb-4">이 리스트는 이미 Supervisor에게 자동 배분된 고객 요청입니다. 여기서는 어느 상담원에게 배정할지만 결정합니다.</p>

          {!detail ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              왼쪽에서 케이스를 선택하면 배정 옵션이 나타납니다.
            </div>
          ) : (
            <div className="space-y-5">
              {/* 선택 업무 배정 결정 */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">선택 업무 배정 결정</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <Field label="현재 Supervisor" value={detail.supervisor ? `${detail.supervisor.name} (${detail.supervisor.employee_id})` : '미배분'} />
                  <Field label="현재 상담원" value={detail.operator ? detail.operator.employee_id : '미배정'} />
                  <Field label="배정방식" value={detail.operator_id ? '자동배정' : '미배정'} />
                  <Field label="요청접수" value={detail.created_at?.slice(0, 10) || '-'} />
                </div>
              </div>

              {/* 1. 우선지원 상담원 */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">1. 우선지원 상담원 <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Preferred</span></h3>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">같은 고객을 과거 처리한 상담원을 최우선으로 배정합니다.</p>
                <div className="text-xs text-slate-700 mb-3">
                  우선지원 후보: <span className="font-bold">
                    {detail.preferredOperatorId
                      ? (operators.find(o => o.id === detail.preferredOperatorId)?.name ?? detail.preferredOperatorId)
                      : '없음'}
                  </span>
                </div>
                <button
                  disabled={!detail.preferredOperatorId || busy}
                  onClick={() => caseAction('assign-preferred')}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  우선지원 상담원에게 배정
                </button>
              </div>

              {/* 2. 자동배정 */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">2. 자동배정 <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Auto</span></h3>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">제외 상담원을 빼고, 상태/부하 기준으로 가장 적합한 상담원을 추천합니다.</p>
                <button
                  disabled={busy}
                  onClick={() => caseAction('auto-assign')}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  자동배정 확정
                </button>
              </div>

              {/* 3. 자동배정 제외 설정 */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">3. 자동배정 제외 설정</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">제외 {excludedOperators.length}명</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">특정 상담원을 자동배정 후보에서 제외합니다. 제외해도 수동배정은 가능합니다.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {operators.map(o => {
                    const excluded = !o.auto_assign_enabled || o.work_state === 'break' || o.work_state === 'offline' || o.work_state === 'resigned';
                    return (
                      <div key={o.id} className={`rounded-lg border p-2 text-xs ${excluded ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200 bg-white'}`}>
                        <div className="font-bold text-slate-900">{o.name} <span className="text-slate-400 font-normal">{o.employee_id}</span></div>
                        <div className="text-[10px] text-slate-500 mt-0.5">상태 {WORK_STATE_LABEL[o.work_state] || o.work_state} · 배정 {o.active_load}건</div>
                        <div className={`text-[10px] mt-0.5 font-bold ${excluded ? 'text-slate-400' : 'text-emerald-700'}`}>
                          {excluded ? '자동배정 제외' : '자동배정 후보'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. 환수 / 수동 재배정 */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900">4. 환수 / 수동 재배정</h3>
                  <button
                    disabled={!detail.operator_id || busy}
                    onClick={() => caseAction('recall')}
                    className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    현재 배정 환수
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">이미 배정된 업무를 Supervisor가 환수하거나, 특정 상담원에게 직접 재배정합니다.</p>
                <div className="flex flex-col gap-2">
                  <select
                    value={pickedOperatorId}
                    onChange={(e) => setPickedOperatorId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">오늘 로그인 상담원 선택…</option>
                    {eligibleOperators.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.employee_id}) · {WORK_STATE_LABEL[o.work_state] || o.work_state} · 배정 {o.active_load}건
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!pickedOperatorId || busy}
                    onClick={() => caseAction('assign', { operatorId: pickedOperatorId })}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    선택 상담원에게 배정
                  </button>
                </div>
              </div>

              {/* Supervisor 이관 */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
                <h3 className="text-sm font-black text-slate-900 mb-2">Supervisor 이관</h3>
                <p className="text-[11px] text-slate-600 mb-3">이 고객 요청 자체를 다른 Supervisor에게 넘길 때 사용합니다.</p>
                <div className="flex flex-wrap gap-2">
                  {supervisors.map(sv => (
                    <button
                      key={sv.id}
                      disabled={busy || sv.id === detail.supervisor_id}
                      onClick={() => caseAction('transfer-supervisor', { supervisorId: sv.id })}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${sv.id === detail.supervisor_id ? 'bg-slate-200 text-slate-500' : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'}`}
                    >
                      {sv.name} ({sv.active_load}건)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: case detail + sticky info + supervisor instruction */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-3">선택 케이스 상세</h2>
          {!detail ? (
            <p className="text-xs text-slate-400">선택된 케이스가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-slate-500">{detail.case_code} · {detail.service_label || detail.tax_type}</p>
                <p className="text-lg font-black text-slate-900">{detail.customer?.company_name || detail.customer?.full_name || '—'}</p>
                <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[detail.status] || 'bg-slate-100 text-slate-700'}`}>
                  {STATUS_LABEL[detail.status] || detail.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="담당 상담원" value={detail.operator?.employee_id ?? '—'} />
                <Field label="담당 Supervisor" value={detail.supervisor?.employee_id ?? '—'} />
                <Field label="우선순위" value={detail.priority ?? 'NORMAL'} />
                <Field label="Due" value={detail.due_date ? formatDue(detail.due_date) : '-'} />
              </div>

              {/* Sticky Assignment / 동일 상담원 우선배정 */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-black text-slate-900">동일 상담원 우선배정</p>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Sticky Assignment</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">같은 고객의 과거 케이스 {detail.pastCases.length}건. 우선 상담원: <b>{detail.preferredOperatorId ? operators.find(o => o.id === detail.preferredOperatorId)?.name ?? '—' : '없음'}</b></p>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {detail.pastCases.slice(0, 5).map(p => (
                    <li key={p.id}>· {p.case_code ?? '-'} · {STATUS_LABEL[p.status] || p.status} · {p.operator?.employee_id ?? '미배정'}</li>
                  ))}
                  {detail.pastCases.length === 0 && <li className="text-slate-400">과거 케이스 없음.</li>}
                </ul>
              </div>

              {/* Supervisor instruction */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-black text-slate-900 mb-1">상담원 지시</p>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  placeholder="예: Coretax ID Billing 발행 후 고객 화면에 반영"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <button
                  disabled={busy || !instruction.trim()}
                  onClick={async () => { await caseAction('instruct', { note: instruction }); setInstruction(''); }}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-3 w-3 inline mr-1" /> 지시
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
  const [mode, setMode] = useState<'operator' | 'supervisor'>('operator');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [preview, setPreview] = useState<{ activeCount?: number; completedCount?: number; managedOperatorCount?: number; customerCount?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const list = mode === 'operator' ? operators : supervisors;

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
    if (!confirm(`정말 이관 실행하시겠습니까? 퇴사 처리도 함께 진행됩니다.`)) return;
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
        setMsg(j.error || '이관 실패');
      } else {
        setMsg(`${j.data?.transferred ?? 0}건 이관 완료`);
        await onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-3">
      <div className="flex items-center gap-1 text-[11px] font-black text-rose-800 mb-2">
        <ArrowRightLeft className="h-3 w-3" /> 퇴사자 고객 / 업무 전체 이관
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] flex items-center gap-1">
          <input type="radio" checked={mode === 'operator'} onChange={() => setMode('operator')} /> 상담원
        </label>
        <label className="text-[11px] flex items-center gap-1">
          <input type="radio" checked={mode === 'supervisor'} onChange={() => setMode('supervisor')} /> Supervisor
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="">퇴사자 선택…</option>
          {list.map(o => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.employee_id}) · {WORK_STATE_LABEL[o.work_state] || o.work_state}
            </option>
          ))}
        </select>
        <select value={toId} onChange={(e) => setToId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="">받을 사람 선택…</option>
          {list.filter(o => o.id !== fromId && o.work_state !== 'resigned' && o.work_state !== 'offline').map(o => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.employee_id}) · {WORK_STATE_LABEL[o.work_state] || o.work_state}
            </option>
          ))}
        </select>
      </div>
      {preview && (
        <div className="mt-2 rounded-lg bg-white p-2 text-[10px] text-slate-700 space-y-0.5">
          {mode === 'operator' && (
            <>
              <p>이관 대상 활성 케이스: <b>{preview.activeCount ?? 0}건</b></p>
              <p>현재 담당 고객: <b>{preview.customerCount ?? 0}곳</b></p>
            </>
          )}
          {mode === 'supervisor' && (
            <>
              <p>이관 대상 활성 케이스: <b>{preview.activeCount ?? 0}건</b></p>
              <p>완료 케이스(이력): <b>{preview.completedCount ?? 0}건</b></p>
              <p>관리 상담원 수: <b>{preview.managedOperatorCount ?? 0}명</b></p>
            </>
          )}
        </div>
      )}
      <button
        disabled={!fromId || !toId || busy}
        onClick={run}
        className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {busy ? '이관 중…' : '전체 이관 실행'}
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
