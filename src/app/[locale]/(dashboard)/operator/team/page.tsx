'use client';

/**
 * 상담원 관리 (PDF p.8-11 명세 기준)
 *
 * - 상태 카운트 카드 (대기/상담중/검토중/Coretax/휴식/오프라인/퇴사)
 * - Compact 표 (상태/상담원/오늘 로그인/현재 배정/처리완료/관리 Supervisor/상태 변경/자동배정)
 * - Supervisor 관리 인원 설정 (Span of Control) — 3 supervisor 카드
 * - 상담원별 관리 Supervisor 지정 — 12개 카드
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

const WORK_STATE_LABEL: Record<string, string> = {
  available: '대기', consulting: '상담중', reviewing: '검토중',
  coretax: 'Coretax 작업중', break: '휴식', offline: '오프라인', resigned: '퇴사',
};

const WORK_STATE_COLOR: Record<string, string> = {
  available: 'bg-emerald-500',
  consulting: 'bg-blue-500',
  reviewing: 'bg-indigo-500',
  coretax: 'bg-purple-500',
  break: 'bg-amber-500',
  offline: 'bg-slate-400',
  resigned: 'bg-rose-500',
};

interface OperatorRow {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  max_clients: number;
  max_managed: number | null;
  work_state: string;
  auto_assign_enabled: boolean;
  last_login_at: string | null;
  active_load: number;
  completed_count: number;
  supervisor_id: string | null;
}

interface SupervisorRow extends Omit<OperatorRow, 'supervisor_id'> {
  managed_operator_ids: string[];
  managed_count: number;
}

interface TeamData {
  operators: OperatorRow[];
  supervisors: SupervisorRow[];
  stateCounts: Record<string, number>;
  todayLoggedIn: number;
  autoEligibleCount: number;
  activeAssignmentCount: number;
}

const STATE_ORDER = ['available', 'consulting', 'reviewing', 'coretax', 'break', 'offline', 'resigned'] as const;

export default function TeamPage() {
  const { session } = useSession();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/team');
      const j = await r.json();
      if (j.success) setData(j.data as TeamData);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateOperator = async (operatorId: string, patch: Record<string, unknown>) => {
    setBusyId(operatorId);
    try {
      await fetch('/api/operator/team', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId, ...patch }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!session) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const fmtTime = (iso: string | null) => {
    if (!iso) return '미로그인';
    const d = new Date(iso);
    if (Date.now() - d.getTime() > 24 * 60 * 60 * 1000) return '미로그인';
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title="상담원 관리" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">상담원 관리</h1>
          <p className="text-sm text-slate-500 mt-1">상담원 관리는 사람/계정/상태/근무 가능 여부를 관리하는 화면입니다. 성과 비교나 인센티브 산정은 성과/평가 메뉴에서 처리합니다.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {!data ? (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {/* 상태 현황 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">상담원 상태 현황</h2>
                <p className="text-xs text-slate-500 mt-0.5">카드형 상세정보를 줄이고, 한 화면에서 10명 이상을 볼 수 있는 상태판과 표로 단순화했습니다.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-slate-500">오늘 로그인</p><p className="font-black text-base text-slate-900">{data.todayLoggedIn}명</p></div>
                <div><p className="text-slate-500">자동배정 가능</p><p className="font-black text-base text-slate-900">{data.autoEligibleCount}명</p></div>
                <div><p className="text-slate-500">전체 배정업무</p><p className="font-black text-base text-slate-900">{data.activeAssignmentCount}건</p></div>
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-3">
              {STATE_ORDER.map(s => (
                <div key={s} className="rounded-xl border border-slate-100 px-3 py-2 text-center">
                  <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${WORK_STATE_COLOR[s]}`} />
                    {WORK_STATE_LABEL[s]}
                  </p>
                  <p className="text-xl font-black mt-1">{data.stateCounts[s] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.operators.map(o => (
                <span key={o.id} className="inline-flex items-center gap-1 rounded-full border border-slate-100 px-2 py-0.5 text-[11px]">
                  <span className={`h-2 w-2 rounded-full ${WORK_STATE_COLOR[o.work_state]}`} />
                  {o.name}
                </span>
              ))}
            </div>
          </section>

          {/* Compact 표 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">상담원 상태 표</h2>
                <p className="text-xs text-slate-500 mt-0.5">상태 변경과 관리 Supervisor 지정만 표에서 바로 처리합니다. 10명 이상도 한 화면에 표시됩니다.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                    <th className="px-2 py-2 font-bold">상태</th>
                    <th className="px-2 py-2 font-bold">상담원</th>
                    <th className="px-2 py-2 font-bold">오늘 로그인</th>
                    <th className="px-2 py-2 font-bold">현재 배정</th>
                    <th className="px-2 py-2 font-bold">처리완료</th>
                    <th className="px-2 py-2 font-bold">관리 Supervisor</th>
                    <th className="px-2 py-2 font-bold">상태 변경</th>
                    <th className="px-2 py-2 font-bold">자동배정</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operators.map(o => {
                    const isBusy = busyId === o.id;
                    return (
                      <tr key={o.id} className="border-b border-slate-100">
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${WORK_STATE_COLOR[o.work_state]}`}>
                            {WORK_STATE_LABEL[o.work_state] || o.work_state}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-bold text-slate-900">{o.name}</div>
                          <div className="text-[10px] text-slate-400">{o.employee_id}</div>
                        </td>
                        <td className="px-2 py-2 text-slate-600">{fmtTime(o.last_login_at)}</td>
                        <td className="px-2 py-2 font-bold text-slate-900">{o.active_load}건</td>
                        <td className="px-2 py-2 text-slate-600">{o.completed_count}건</td>
                        <td className="px-2 py-2">
                          <select value={o.supervisor_id ?? ''} onChange={(e) => updateOperator(o.id, { supervisorId: e.target.value })}
                            disabled={isBusy} className="w-full rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[11px]">
                            <option value="">— 미지정 —</option>
                            {data.supervisors.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select value={o.work_state} onChange={(e) => updateOperator(o.id, { workState: e.target.value })}
                            disabled={isBusy} className="w-full rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[11px]">
                            {STATE_ORDER.map(s => (
                              <option key={s} value={s}>{WORK_STATE_LABEL[s]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => updateOperator(o.id, { autoAssignEnabled: !o.auto_assign_enabled })}
                            disabled={isBusy}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black ${o.auto_assign_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {o.auto_assign_enabled ? '가능' : '제외'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Span of Control */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-slate-900">Supervisor 관리 인원 설정</h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Span of Control</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Supervisor 1명이 관리하고자 하는 상담원 수를 정하고, 각 상담원을 어느 Supervisor가 관리할지 지정합니다. 이 값은 업무 배분, 과부하 판단, 성과 관리 기준으로 사용됩니다.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.supervisors.map(sv => {
                const exceeded = sv.max_managed != null && sv.managed_count > sv.max_managed;
                return (
                  <div key={sv.id} className={`rounded-xl border p-4 ${exceeded ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-black text-slate-900">{sv.name}</p>
                        <p className="text-[11px] text-slate-500">{sv.employee_id}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${exceeded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {exceeded ? '초과' : '정상'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div><p className="text-slate-500">관리중</p><p className="font-black">{sv.managed_count}명</p></div>
                      <div><p className="text-slate-500">희망 관리인원</p><p className="font-black">{sv.max_managed ?? '—'}명</p></div>
                    </div>
                    <label className="block text-[11px] text-slate-500 mb-1">희망 관리 상담원 수</label>
                    <input
                      type="number" min={0} max={20} defaultValue={sv.max_managed ?? 0}
                      onBlur={(e) => {
                        const v = Number(e.currentTarget.value) || 0;
                        if (v !== sv.max_managed) updateOperator(sv.id, { maxManaged: v });
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-mono"
                    />
                    <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 max-h-24 overflow-y-auto">
                      <p className="font-bold mb-1">관리 상담원</p>
                      {sv.managed_operator_ids.length === 0
                        ? <p className="text-slate-400">없음</p>
                        : sv.managed_operator_ids.map(id => {
                            const o = data.operators.find(x => x.id === id);
                            return o ? <div key={id} className="flex items-center justify-between"><span>{o.name}</span><span className="text-slate-400">{o.employee_id}</span></div> : null;
                          })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 상담원별 관리 Supervisor 지정 */}
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-900 mb-3">상담원별 관리 Supervisor 지정</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.operators.map(o => (
                <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-black text-slate-900">{o.name}</p>
                      <p className="text-[11px] text-slate-500">{o.employee_id} · {WORK_STATE_LABEL[o.work_state]}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.auto_assign_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {o.auto_assign_enabled ? '활성' : '비활성'}
                    </span>
                  </div>
                  <select value={o.supervisor_id ?? ''} onChange={(e) => updateOperator(o.id, { supervisorId: e.target.value })}
                    disabled={busyId === o.id}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                    <option value="">— 미지정 —</option>
                    {data.supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
