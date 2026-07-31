'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './workqueue.module.css';
import { WorkqueueSidebar } from './WorkqueueSidebar';
import { CustomerWorklist } from './CustomerWorklist';
import { Pph21ReviewPanel } from './Pph21ReviewPanel';
import { RequestDrawer } from './RequestDrawer';
import { STATUS_LABEL_MAP, type QueueListItem, type StatusFilter, type TaxView } from './types';

const now = new Date();
const DEFAULT_PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export function WorkqueueClient() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [taxView, setTaxView] = useState<TaxView>('pph21');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [items, setItems] = useState<QueueListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // NOTE: limit=200 — counts and the status filter are computed client-side over
  // this single page of results. A period with >200 PPh21 queue items would
  // under-count (no silent cap: this is the documented MVP ceiling).
  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        const [y, m] = period.split('-');
        const r = await fetch(`/api/operator/queue?taxType=PPh21&year=${y}&month=${Number(m)}&limit=200`);
        const j = await r.json();
        if (active && j.success) setItems(j.data.items as QueueListItem[]);
        else if (active && !j.success) setError('목록을 불러오지 못했습니다.');
      } catch { if (active) setError('목록을 불러오지 못했습니다.'); }
    })();
    return () => { active = false; };
  }, [period]);

  // One-shot refresh handed to Pph21ReviewPanel as onChanged (no active flag —
  // it's not tied to an effect lifecycle). Catches so onChanged={load} never
  // leaves a floating rejected promise.
  const load = useCallback(async () => {
    setError(null);
    try {
      const [y, m] = period.split('-');
      const r = await fetch(`/api/operator/queue?taxType=PPh21&year=${y}&month=${Number(m)}&limit=200`);
      const j = await r.json();
      if (j.success) setItems(j.data.items as QueueListItem[]);
      else setError('목록을 불러오지 못했습니다.');
    } catch { setError('목록을 불러오지 못했습니다.'); }
  }, [period]);

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

  const filtered = useMemo(
    () => statusFilter ? items.filter(it => STATUS_LABEL_MAP[it.status] === statusFilter) : items,
    [items, statusFilter],
  );

  return (
    <div className={styles.root}>
      <div className={styles.app}>
        <WorkqueueSidebar counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          taxView={taxView} onTaxView={setTaxView} />
        <main>
          <div className={styles.top}>
            <div className={styles.role}><button className={`${styles.pill} ${styles.active}`}>상담원</button></div>
            <div className={styles.tools}>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
              <input placeholder="고객명, NPWP, 담당자 검색" />
            </div>
          </div>
          <section className={styles.content}>
            {error && <div className={styles.blocked}>{error}</div>}
            <div className={styles.grid}>
              <CustomerWorklist items={filtered} selectedId={selectedId} onSelect={setSelectedId} counts={counts} />
              <div>
                {selectedId
                  ? <Pph21ReviewPanel queueId={selectedId} onChanged={load} />
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
