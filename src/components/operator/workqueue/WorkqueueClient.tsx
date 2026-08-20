'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './workqueue.module.css';
import { OperatorRail } from './OperatorRail';
import { CustomerWorklist } from './CustomerWorklist';
import { Pph21ReviewPanel } from './Pph21ReviewPanel';
import { WithholdingReviewPanel } from './WithholdingReviewPanel';
import { PpnReviewPanel } from './PpnReviewPanel';
import { UmkmReviewPanel } from './UmkmReviewPanel';
import { AnnualReviewPanel } from './AnnualReviewPanel';
import { EmployeeHrPanel } from './EmployeeHrPanel';
import { STATUS_LABEL_MAP, TAX_TABS, TAX_VIEW_TO_TYPE, type QueueListItem, type StatusFilter, type TaxView } from './types';

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

// 상태 필터 (수정요청 27번: 사이드바 → 상단 가로). all 은 key='' (필터 해제).
const STATUS_TABS: Array<{ key: StatusFilter; icon: string; label: string; cls: string; countKey: 'all' | 'unreviewed' | 'inReview' | 'request' | 'reviewed' }> = [
  { key: '', icon: '📌', label: '전체', cls: 'blue', countKey: 'all' },
  { key: 'unreviewed', icon: '🔴', label: '미검토', cls: 'red', countKey: 'unreviewed' },
  { key: 'inReview', icon: '🟡', label: '검토중', cls: 'amber', countKey: 'inReview' },
  { key: 'request', icon: '💬', label: '수정작업중', cls: 'red', countKey: 'request' },
  { key: 'reviewed', icon: '🟢', label: '검토완료', cls: 'green', countKey: 'reviewed' },
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
  // 수정요청 58 — 발행보드/인박스 사이드바에서 세목 클릭 시 ?view=key 로 진입 → 해당 뷰로.
  // useSearchParams 대신 mount 시 location 읽기 (Suspense wrapper 불필요).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v && (TAX_TABS.some(t => t.key === v))) setTaxView(v as TaxView);
  }, []);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<QueueListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthNum = Number(period.split('-')[1]);

  // 수정요청 55 — 검색이 세목/월 범위에만 걸려 다른 월 고객을 못 찾던 문제.
  // 서버는 연 단위(taxType+year)로 로드하고, 선택 월 좁힘은 클라이언트에서 —
  // 검색어가 있으면 월 제한을 풀어 그 해 전체에서 고객명/NPWP 로 찾는다.
  const listUrl = useCallback(() => {
    const [y] = period.split('-');
    return `/api/operator/queue?taxType=${TAX_VIEW_TO_TYPE[taxView]}&year=${y}&limit=200`;
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

  // 카운트/기본 목록은 선택 월 기준 (연신고는 연 단위라 전체).
  const monthScoped = useMemo(
    () => (taxView === 'annual' ? items : items.filter(it => it.tax_period_month === monthNum)),
    [items, monthNum, taxView]);

  const counts = useMemo(() => {
    const c = { all: monthScoped.length, unreviewed: 0, inReview: 0, request: 0, reviewed: 0 };
    for (const it of monthScoped) {
      const lbl = STATUS_LABEL_MAP[it.status];
      if (lbl === 'unreviewed') c.unreviewed++;
      else if (lbl === 'inReview') c.inReview++;
      else if (lbl === 'request') c.request++;
      else if (lbl === 'reviewed') c.reviewed++;
    }
    return c;
  }, [monthScoped]);

  // 검색어가 있으면 그 해 전체(items)에서, 없으면 선택 월(monthScoped)에서 필터.
  // 상태 필터와 AND. (고객명 / NPWP)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? items : monthScoped;
    if (statusFilter) list = list.filter(it => STATUS_LABEL_MAP[it.status] === statusFilter);
    if (q) {
      list = list.filter(it =>
        (it.customer?.customer_name ?? '').toLowerCase().includes(q) ||
        (it.customer?.npwp ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [items, monthScoped, statusFilter, search]);

  return (
    <div className={styles.root}>
      <div className={styles.app}>
        <OperatorRail active="workqueue" taxView={taxView}
          onTaxView={(v) => { setSelectedId(null); setTaxView(v); }} />
        <main>
          <div className={styles.top}>
            <div className={styles.role}>
              {/* 수정요청 8/20 #21 — 이 화면은 상담원 업무함. 수퍼바이저가 봐도 화면 정체성은 '상담원'. */}
              <button className={`${styles.pill} ${styles.active}`}>상담원 업무함</button>
            </div>
            {/* 수정요청 27번 — 상태 필터를 상단 가로 배치 (세목 탭은 사이드바로 이동) */}
            <div className={styles.taxtabs} role="tablist" aria-label="검토 상태">
              {STATUS_TABS.map(tab => (
                <button key={tab.key || 'all'} role="tab" aria-selected={statusFilter === tab.key}
                  className={`${styles.pill} ${statusFilter === tab.key ? styles.active : ''}`}
                  onClick={() => setStatusFilter(tab.key)}>
                  <span aria-hidden="true">{tab.icon}</span> {tab.label}
                  <span className={`${styles.topcnt} ${styles[tab.cls]}`}>{counts[tab.countKey]}</span>
                </button>
              ))}
            </div>
            <div className={styles.tools}>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
              <input placeholder="고객명, NPWP 검색 (연 단위)" value={search} onChange={e => setSearch(e.target.value)} />
              {/* 수정요청 54 — 집(🏠) 버튼은 예전 대시보드 화면으로 이동해 혼란 → 제거. */}
              {isSupervisor && (
                <a className={styles.btn} href={`/${locale}/operator/supervisor-console`}
                  title="수퍼바이저 콘솔">🛡️ 콘솔</a>
              )}
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
    </div>
  );
}
