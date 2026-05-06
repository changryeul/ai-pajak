'use client';

/**
 * 감사로그 / 변경이력 (PDF p.22 명세 기준 + Phase 5/6 풍부 이벤트)
 *
 * case_audit_log 테이블의 모든 이벤트를 카드로 표시. 시드 직후처럼 명시적
 * 이벤트가 없는 케이스는 CASE_CREATED 합성 이벤트로 보완.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface AuditRow {
  id: string;
  case_id: string;
  case_code: string | null;
  customer_name: string;
  event_type: string;
  actor_label: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, { text: string; cls: string }> = {
  CASE_CREATED:        { text: '케이스 생성',          cls: 'bg-slate-100 text-slate-700' },
  ASSIGNED:            { text: '상담원 배정',          cls: 'bg-emerald-100 text-emerald-700' },
  REASSIGNED:          { text: '상담원 재배정',        cls: 'bg-blue-100 text-blue-700' },
  RECALLED:            { text: '환수',                 cls: 'bg-rose-100 text-rose-700' },
  TRANSFERRED_TO_SV:   { text: 'Supervisor 이관',      cls: 'bg-purple-100 text-purple-700' },
  BULK_TRANSFERRED:    { text: '퇴사 Bulk Transfer',   cls: 'bg-rose-100 text-rose-700' },
  APPROVED:            { text: '승인',                 cls: 'bg-blue-100 text-blue-700' },
  REJECTED:            { text: '반려',                 cls: 'bg-rose-100 text-rose-700' },
  INSTRUCTED:          { text: '상담원 지시',          cls: 'bg-amber-100 text-amber-800' },
};

const fmtTs = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

const summarizePayload = (event: string, p: Record<string, unknown> | null): string => {
  if (!p || Object.keys(p).length === 0) return '';
  switch (event) {
    case 'ASSIGNED':
    case 'REASSIGNED':
      return p.mode ? `방식: ${p.mode}` : '';
    case 'RECALLED':
      return p.reason ? `사유: ${p.reason}` : '';
    case 'TRANSFERRED_TO_SV':
      return 'Supervisor 변경';
    case 'BULK_TRANSFERRED':
      return p.mode ? `${p.mode === 'operator' ? '상담원' : 'Supervisor'} 퇴사 일괄 이관` : '퇴사 Bulk';
    case 'APPROVED':
      return p.note ? `메모: ${p.note}` : '';
    case 'REJECTED':
      return p.reason ? `사유: ${p.reason}` : '';
    case 'INSTRUCTED':
      return p.note ? `지시: ${p.note}` : '';
    default:
      return '';
  }
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/audit?limit=300');
      const j = await r.json();
      if (j.success) setItems(j.data.items as AuditRow[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? items : items.filter(i => i.event_type === filter);

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1200px]">
      <PageTitle title="감사로그 / 변경이력" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">감사로그 / 변경이력</h1>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>전체 {items.length}</FilterChip>
        {Object.keys(EVENT_LABEL).map(ev => {
          const count = items.filter(i => i.event_type === ev).length;
          if (count === 0) return null;
          return (
            <FilterChip key={ev} active={filter === ev} onClick={() => setFilter(ev)}>
              {EVENT_LABEL[ev].text} {count}
            </FilterChip>
          );
        })}
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">기록된 이벤트가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(e => {
              const lbl = EVENT_LABEL[e.event_type] ?? { text: e.event_type, cls: 'bg-slate-100 text-slate-700' };
              const summary = summarizePayload(e.event_type, e.payload);
              return (
                <li key={e.id} className="grid grid-cols-[110px_120px_1fr_140px] items-start gap-3 px-2 py-3">
                  <span className="text-[11px] text-slate-400 font-mono">{fmtTs(e.created_at)}</span>
                  <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${lbl.cls}`}>{lbl.text}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {e.case_code ?? '—'} · {e.customer_name}
                    </p>
                    {summary && <p className="text-[11px] text-slate-500 mt-0.5">{summary}</p>}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate text-right">{e.actor_label ?? 'system'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}
