'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './workqueue.module.css';
import { WorkqueueSidebar } from './WorkqueueSidebar';
import { CustomerWorklist } from './CustomerWorklist';
import { Pph21ReviewPanel } from './Pph21ReviewPanel';
import { WithholdingReviewPanel } from './WithholdingReviewPanel';
import { PpnReviewPanel } from './PpnReviewPanel';
import { UmkmReviewPanel } from './UmkmReviewPanel';
import { AnnualReviewPanel } from './AnnualReviewPanel';
import { EmployeeHrPanel } from './EmployeeHrPanel';
import { RequestDrawer } from './RequestDrawer';
import { STATUS_LABEL_MAP, TAX_VIEW_TO_TYPE, type QueueListItem, type StatusFilter, type TaxView } from './types';

// taxView → 우측 상세 패널. 새 세목 추가 시 여기에 한 줄만 등록.
const PANEL_BY_VIEW: Partial<Record<TaxView, typeof Pph21ReviewPanel>> = {
  pph21: Pph21ReviewPanel,
  withholding: WithholdingReviewPanel,
  ppn: PpnReviewPanel,
  umkm: UmkmReviewPanel,
  annual: AnnualReviewPanel,
  employees: EmployeeHrPanel,
};

const now = new Date();
const DEFAULT_PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

// 상단 가로 세목 탭 (수정요청 4번). '직원 인사 기록'은 메뉴에서 제외(5번) —
// PANEL_BY_VIEW/API 는 유지하므로 후속(개인소득세 팝업 등)에서 재사용 가능.
const TAX_TABS: Array<{ key: TaxView; label: string }> = [
  { key: 'pph21', label: '개인소득세' },
  { key: 'withholding', label: '원천세' },
  { key: 'umkm', label: '선납법인세' },
  { key: 'ppn', label: '부가세' },
  { key: 'annual', label: '연 신고' },
];

export function WorkqueueClient({ role }: { role?: string }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const router = useRouter();
  // 수정요청 13번 — 워크큐에 로그아웃 경로가 없었음
  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };
  const isSupervisor = !!role && SUPERVISOR_ROLES.includes(role);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [taxView, setTaxView] = useState<TaxView>('pph21');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<QueueListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 연 신고(annual)는 회계연도 단위라 월 필터를 걸지 않는다 (큐 행은 모두
  // month=12). 나머지 세목은 (year, month) 귀속월 필터.
  const listUrl = useCallback(() => {
    const [y, m] = period.split('-');
    const base = `/api/operator/queue?taxType=${TAX_VIEW_TO_TYPE[taxView]}&year=${y}&limit=200`;
    return taxView === 'annual' ? base : `${base}&month=${Number(m)}`;
  }, [period, taxView]);

  // NOTE: limit=200 — counts and the status filter are computed client-side over
  // this single page of results. A period with >200 PPh21 queue items would
  // under-count (no silent cap: this is the documented MVP ceiling).
  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        const r = await fetch(listUrl());
        const j = await r.json();
        if (active && j.success) setItems(j.data.items as QueueListItem[]);
        else if (active && !j.success) setError('목록을 불러오지 못했습니다.');
      } catch { if (active) setError('목록을 불러오지 못했습니다.'); }
    })();
    return () => { active = false; };
  }, [listUrl]);

  // One-shot refresh handed to Pph21ReviewPanel as onChanged (no active flag —
  // it's not tied to an effect lifecycle). Catches so onChanged={load} never
  // leaves a floating rejected promise.
  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(listUrl());
      const j = await r.json();
      if (j.success) setItems(j.data.items as QueueListItem[]);
      else setError('목록을 불러오지 못했습니다.');
    } catch { setError('목록을 불러오지 못했습니다.'); }
  }, [listUrl]);

  const counts = useMemo(() => {
    const c = { all: items.length, unreviewed: 0, inReview: 0, request: 0, reviewed: 0 };
    for (const it of items) {
      const lbl = STATUS_LABEL_MAP[it.status];
      if (lbl === 'unreviewed') c.unreviewed++;
      else if (lbl === 'inReview') c.inReview++;
      else if (lbl === 'request') c.request++;
      else if (lbl === 'reviewed') c.reviewed++;
    }
    return c;
  }, [items]);

  // 검색은 로드된 200건 안에서 클라이언트 필터 (고객명 / NPWP). 상태 필터와 AND.
  const filtered = useMemo(() => {
    let list = statusFilter ? items.filter(it => STATUS_LABEL_MAP[it.status] === statusFilter) : items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(it =>
        (it.customer?.customer_name ?? '').toLowerCase().includes(q) ||
        (it.customer?.npwp ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [items, statusFilter, search]);

  return (
    <div className={styles.root}>
      <div className={styles.app}>
        <WorkqueueSidebar counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter} />
        <main>
          <div className={styles.top}>
            <div className={styles.role}>
              <button className={`${styles.pill} ${styles.active}`}>{isSupervisor ? '수퍼바이저' : '상담원'}</button>
            </div>
            {/* 수정요청 4번 — 세목 전환 탭을 상단 가로 배치 */}
            <div className={styles.taxtabs} role="tablist" aria-label="세목">
              {TAX_TABS.map(tab => (
                <button key={tab.key} role="tab" aria-selected={taxView === tab.key}
                  className={`${styles.pill} ${taxView === tab.key ? styles.active : ''}`}
                  onClick={() => { setSelectedId(null); setTaxView(tab.key); }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={styles.tools}>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
              <input placeholder="고객명, NPWP 검색" value={search} onChange={e => setSearch(e.target.value)} />
              {/* 수정요청 1·13번 — 나가기 대신 홈/로그아웃 (역할별 실제 홈) */}
              <a className={styles.btn}
                href={`/${locale}/operator/${isSupervisor ? 'dashboard' : 'my-work'}`}
                title="운영팀 대시보드">🏠</a>
              <button className={styles.btn} onClick={handleLogout} title="로그아웃">로그아웃</button>
            </div>
          </div>
          <section className={styles.content}>
            {error && <div className={styles.blocked}>{error}</div>}
            <div className={styles.grid}>
              <CustomerWorklist items={filtered} selectedId={selectedId} onSelect={setSelectedId} />
              <div>
                {selectedId
                  ? (() => {
                      const Panel = PANEL_BY_VIEW[taxView] ?? Pph21ReviewPanel;
                      return <Panel key={selectedId} queueId={selectedId} onChanged={load} />;
                    })()
                  : <div className={styles.card}><div className={styles.body}>왼쪽에서 고객 업무를 선택하세요.</div></div>}
              </div>
            </div>
          </section>
        </main>
      </div>
      <RequestDrawer />
    </div>
  );
}
