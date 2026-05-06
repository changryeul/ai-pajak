'use client';

/**
 * 전체 케이스 (PDF p.21 명세 기준)
 *
 * 좌측: 모든 케이스 리스트 (status badge)
 * 우측: 선택 상세 + 상담원 지시 입력
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  service_label: string | null;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | null;
  due_date: string | null;
  customer: { full_name: string; company_name: string | null } | null;
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
}

interface CaseDetail extends CaseRow {
  notes: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', PENDING_DOCS: '자료요청', DATA_REVIEW: '검토중',
  PENDING_APPROVAL: '승인요청', COMPLETED: '신고완료', FAILED: '실패',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  PENDING_DOCS: 'bg-amber-100 text-amber-800',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export default function AllCasesPage() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [instruction, setInstruction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/cases?scope=all');
      const j = await r.json();
      if (j.success) setItems(j.data.items as CaseRow[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/operator/cases/${selectedId}`).then(r => r.json()).then(j => {
      if (j.success) setDetail(j.data as CaseDetail);
    });
  }, [selectedId]);

  const sendInstruction = async () => {
    if (!selectedId || !instruction.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/operator/cases/${selectedId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'instruct', note: instruction }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) setMsg({ type: 'err', text: j.error || '실패' });
      else { setMsg({ type: 'ok', text: '지시 전달됨' }); setInstruction(''); }
      const r2 = await fetch(`/api/operator/cases/${selectedId}`);
      const j2 = await r2.json();
      if (j2.success) setDetail(j2.data as CaseDetail);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title="전체 케이스" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">전체 케이스</h1>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-2 text-sm font-bold ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {msg.type === 'ok' ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 mb-3">전체 케이스 ({items.length})</h2>
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
            {items.map(c => (
              <button key={c.id} onClick={() => setSelectedId(c.id)}
                className={`w-full text-left rounded-xl border p-3 ${c.id === selectedId ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900 truncate">{c.customer?.company_name || c.customer?.full_name || '—'}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{c.case_code} · {c.service_label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">담당 {c.operator?.employee_id ?? '미배정'} · {c.priority || 'NORMAL'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          {!detail ? (
            <p className="text-center text-sm text-slate-400 py-12">왼쪽에서 케이스를 선택하세요.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-black text-slate-900">{detail.customer?.company_name || detail.customer?.full_name || '—'}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[detail.status] || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABEL[detail.status] || detail.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{detail.case_code} · {detail.service_label}</p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <Field label="담당 상담원" value={detail.operator?.employee_id ?? '—'} />
                  <Field label="담당 Supervisor" value={detail.supervisor?.employee_id ?? '—'} />
                  <Field label="서비스" value={detail.service_label ?? '—'} />
                  <Field label="우선순위" value={detail.priority ?? 'NORMAL'} />
                  <Field label="Due" value={detail.due_date ? formatDue(detail.due_date) : '-'} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-900 mb-2">상담원 지시</h3>
                <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
                  placeholder="예: Coretax ID Billing 발행 후 고객 화면에 반영"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <button onClick={sendInstruction} disabled={busy || !instruction.trim()}
                  className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50">
                  <Send className="h-3 w-3 inline mr-1" /> 지시
                </button>
                {detail.notes && (
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                    {detail.notes}
                  </pre>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
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
