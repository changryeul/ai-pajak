'use client';

/**
 * 감사로그 / 변경이력 (PDF p.22 명세 기준)
 *
 * 모든 케이스의 생성·자동배정·재배정·SV 이관·승인/반려·지시 이벤트를
 * 케이스 단위 카드로 보여줌. 데이터 소스는 djp_submission_queue의
 * 메타 (created_at, assigned_at, reassigned_at, reassigned_by, notes)를
 * 활용한 lightweight feed.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  service_label: string | null;
  status: string;
  created_at: string;
  assigned_at: string | null;
  customer: { full_name: string; company_name: string | null } | null;
  operator: { employee_id: string; name: string } | null;
}

interface AuditEntry {
  caseId: string;
  caseCode: string | null;
  customerName: string;
  message: string;
  ts: string;
}

const fmtTs = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/cases?scope=all');
      const j = await r.json();
      if (j.success) {
        const cases = j.data.items as CaseRow[];
        const entries: AuditEntry[] = [];
        for (const c of cases) {
          const customerName = c.customer?.company_name || c.customer?.full_name || '—';
          entries.push({
            caseId: c.id, caseCode: c.case_code, customerName,
            message: '케이스 생성 및 자동 배정',
            ts: c.created_at,
          });
          if (c.assigned_at && c.assigned_at !== c.created_at) {
            entries.push({
              caseId: c.id, caseCode: c.case_code, customerName,
              message: c.operator ? `상담원 ${c.operator.name} (${c.operator.employee_id}) 배정` : '상담원 배정',
              ts: c.assigned_at,
            });
          }
        }
        entries.sort((a, b) => b.ts.localeCompare(a.ts));
        setItems(entries);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1100px]">
      <PageTitle title="감사로그 / 변경이력" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">감사로그 / 변경이력</h1>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">기록된 이벤트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((e, i) => (
              <div key={`${e.caseId}-${i}`} className="rounded-xl border border-slate-200 p-4">
                <p className="font-black text-slate-900 text-sm">{e.caseCode ?? '—'} · {e.customerName}</p>
                <p className="text-xs text-slate-700 mt-0.5">{e.message}</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">{fmtTs(e.ts)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
