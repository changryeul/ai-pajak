'use client';

/**
 * 상담원 업무 화면 — 내 업무 (오늘 처리할 고객).
 *
 * PDF 「AI Pajak 백오피스_상담원」 p.1-2 그대로 재현.
 *   - 4 KPI 스트립 (긴급 / 검토필요 / 승인대기 / Coretax 대기)
 *   - 우선순위 정렬된 케이스 카드 (검토필요/자료요청/승인/NTPN 4 메트릭 + 다음 작업 다크 배너)
 *   - 우측 사이드: 빠른 필터 + 사용 방법 가이드
 *
 * 카드를 클릭하면 localStorage('aip.operator.lastCase')에 영속화하고
 * /operator/review-case/[id] 로 이동.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, FileText, ShieldCheck, Hourglass } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface CaseItem {
  id: string;
  case_code: string | null;
  service_label: string;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  due_date: string | null;
  d_day: string;
  customer: { id: string; name: string; type: string | null };
  operator_emp_id: string;
  metrics: {
    review_required: number;
    doc_requested: number;
    approval: '미요청' | '요청중' | '승인됨' | '반려';
    ntpn: string | null;
  };
  next_action: string;
}

interface Kpi {
  urgent: number;
  needsReview: number;
  awaitingApproval: number;
  coretaxReady: number;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING:            { text: '대기',      cls: 'bg-slate-100 text-slate-600' },
  PENDING_DOCS:       { text: '자료요청',  cls: 'bg-amber-100 text-amber-700' },
  DATA_REVIEW:        { text: '검토중',    cls: 'bg-indigo-100 text-indigo-700' },
  PENDING_APPROVAL:   { text: '승인요청',  cls: 'bg-violet-100 text-violet-700' },
  APPROVED:           { text: '승인완료',  cls: 'bg-emerald-100 text-emerald-700' },
  EBILLING_GENERATED: { text: 'ID Billing', cls: 'bg-blue-100 text-blue-700' },
  PAYMENT_PENDING:    { text: '납부대기',  cls: 'bg-amber-100 text-amber-700' },
  PAYMENT_UPLOADED:   { text: '납부확인중', cls: 'bg-blue-100 text-blue-700' },
  PAYMENT_VERIFIED:   { text: '납부완료',  cls: 'bg-emerald-100 text-emerald-700' },
  DJP_SUBMITTED:      { text: 'DJP 제출',  cls: 'bg-blue-100 text-blue-700' },
  BPE_UPLOADED:       { text: 'BPE 등록',  cls: 'bg-cyan-100 text-cyan-700' },
};

type FilterKey = 'ALL' | 'APPROVAL' | 'CORETAX' | 'DOCS_PENDING';

export default function MyWorkPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [items, setItems] = useState<CaseItem[]>([]);
  const [kpi, setKpi] = useState<Kpi>({ urgent: 0, needsReview: 0, awaitingApproval: 0, coretaxReady: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/my-cases');
      const j = await r.json();
      if (j.success) {
        setItems(j.data.items as CaseItem[]);
        setKpi(j.data.kpi as Kpi);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickCase = (c: CaseItem) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer.name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/review-case/${c.id}`);
  };

  const filtered = useMemo(() => {
    if (filter === 'APPROVAL') return items.filter(i => i.status === 'PENDING_APPROVAL');
    if (filter === 'CORETAX') return items.filter(i => ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(i.status));
    if (filter === 'DOCS_PENDING') return items.filter(i => i.status === 'PENDING_DOCS');
    return items;
  }, [items, filter]);

  const counts = useMemo(() => ({
    APPROVAL: items.filter(i => i.status === 'PENDING_APPROVAL').length,
    CORETAX: items.filter(i => ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(i.status)).length,
    DOCS_PENDING: items.filter(i => i.status === 'PENDING_DOCS').length,
  }), [items]);

  if (loading) return (
    <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>
  );

  return (
    <div>
      <PageTitle title="상담원 업무 화면 — 내 업무" />
      <h1 className="mb-1 text-2xl font-black text-slate-900">상담원 업무 화면</h1>
      <p className="mb-6 text-sm text-slate-500">
        복잡한 내부 메뉴 대신, 고객 한 명을 선택하고 5단계만 순서대로 처리합니다.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* 좌: 메인 컬럼 */}
        <div>
          {/* 헤더 */}
          <section className="mb-3 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">오늘 처리할 고객</h2>
                <p className="text-xs text-slate-500">긴급도와 현재 상태 기준으로 상담원이 먼저 처리해야 할 고객을 정렬했습니다.</p>
              </div>
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{items.length}건</span>
            </div>

            {/* 4 KPI */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Kpi icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}    label="긴급"        value={`${kpi.urgent}건`} />
              <Kpi icon={<FileText className="h-4 w-4 text-indigo-500" />}        label="검토필요"    value={`${kpi.needsReview}건`} />
              <Kpi icon={<ShieldCheck className="h-4 w-4 text-violet-500" />}     label="승인대기"    value={`${kpi.awaitingApproval}건`} />
              <Kpi icon={<Hourglass className="h-4 w-4 text-blue-500" />}         label="Coretax 대기" value={`${kpi.coretaxReady}건`} />
            </div>
          </section>

          {/* 케이스 카드 리스트 */}
          {filtered.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
              {filter === 'ALL' ? '처리할 고객이 없습니다.' : '필터 조건에 해당하는 케이스가 없습니다.'}
            </section>
          ) : (
            <ul className="space-y-3">
              {filtered.map(c => <CaseCard key={c.id} c={c} onPick={pickCase} />)}
            </ul>
          )}
        </div>

        {/* 우: 빠른 필터 + 사용 방법 */}
        <aside className="space-y-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">빠른 필터</h3>
            <div className="space-y-2">
              <FilterButton
                active={filter === 'APPROVAL'}
                onClick={() => setFilter(filter === 'APPROVAL' ? 'ALL' : 'APPROVAL')}
                label="승인요청 상태"
                count={counts.APPROVAL}
                empty="해당 없음"
              />
              <FilterButton
                active={filter === 'CORETAX'}
                onClick={() => setFilter(filter === 'CORETAX' ? 'ALL' : 'CORETAX')}
                label="Coretax 처리 가능"
                count={counts.CORETAX}
                empty="해당 없음"
              />
              <FilterButton
                active={filter === 'DOCS_PENDING'}
                onClick={() => setFilter(filter === 'DOCS_PENDING' ? 'ALL' : 'DOCS_PENDING')}
                label="자료요청/고객응답 대기"
                count={counts.DOCS_PENDING}
                empty="해당 없음"
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">사용 방법</h3>
            <ol className="space-y-1.5 text-xs text-slate-600">
              <li>1. 오늘 처리할 고객 카드에서 고객을 선택합니다.</li>
              <li>2. 다음 작업 표시를 보고 검토/승인/Coretax 처리를 진행합니다.</li>
              <li>3. 처리 후 이력 메뉴에서 상담/처리 기록을 확인합니다.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1.5">{icon}<span className="text-[11px] font-bold text-slate-500">{label}</span></div>
      <p className="mt-0.5 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label, count, empty }: { active: boolean; onClick: () => void; label: string; count: number; empty: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
        active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className={cn('text-[11px] font-bold', count > 0 ? 'text-blue-600' : 'text-slate-400')}>{count}건</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">{count === 0 ? empty : `${count}건 대기 중`}</p>
    </button>
  );
}

function CaseCard({ c, onPick }: { c: CaseItem; onPick: (c: CaseItem) => void }) {
  const status = STATUS_LABEL[c.status] ?? { text: c.status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <li
      onClick={() => onPick(c)}
      className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-blue-200"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">{c.customer.name}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', status.cls)}>{status.text}</span>
            {c.priority === 'URGENT' && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">긴급</span>}
            {c.priority === 'HIGH' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">High</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {c.case_code ?? '—'} · {c.service_label}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-black', c.d_day.startsWith('D-') && Number(c.d_day.slice(2)) <= 1 ? 'text-rose-600' : 'text-slate-700')}>
            {c.d_day}
          </p>
          <p className="text-[10px] text-slate-400">담당 {c.operator_emp_id}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Metric label="검토필요" value={`${c.metrics.review_required}`} highlight={c.metrics.review_required > 0} />
        <Metric label="자료요청" value={`${c.metrics.doc_requested}`} highlight={c.metrics.doc_requested > 0} />
        <Metric label="승인" value={c.metrics.approval} />
        <Metric label="NTPN" value={c.metrics.ntpn ?? '—'} mono />
      </div>

      <div className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white">
        다음 작업: {c.next_action}
      </div>
    </li>
  );
}

function Metric({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn(
        'mt-0.5 truncate font-black',
        mono ? 'text-[11px] font-mono text-slate-700' : 'text-sm',
        highlight ? 'text-blue-600' : 'text-slate-800',
      )}>{value}</p>
    </div>
  );
}
