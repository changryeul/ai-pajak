'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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

export function WorkqueueClient({ role }: { role?: string }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
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
        <WorkqueueSidebar counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          taxView={taxView} onTaxView={(v) => { setSelectedId(null); setTaxView(v); }} />
        <main>
          <div className={styles.top}>
            <div className={styles.role}>
              <button className={`${styles.pill} ${styles.active}`}>{isSupervisor ? '수퍼바이저' : '상담원'}</button>
            </div>
            <div className={styles.tools}>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
              <input placeholder="고객명, NPWP 검색" value={search} onChange={e => setSearch(e.target.value)} />
              {/* /operator 인덱스 페이지는 없다 — 역할별 실제 홈으로 나간다. */}
              <a className={styles.btn}
                href={`/${locale}/operator/${isSupervisor ? 'dashboard' : 'my-work'}`}
                title="운영팀 대시보드로 나가기">← 나가기</a>
            </div>
          </div>
          <section className={styles.content}>
            {error && <div className={styles.blocked}>{error}</div>}
            <div className={styles.grid}>
              <CustomerWorklist items={filtered} selectedId={selectedId} onSelect={setSelectedId} counts={counts} />
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
