'use client';
import styles from './workqueue.module.css';
import { STATUS_LABEL_MAP, type QueueListItem } from './types';

const LABEL_KO: Record<string, [string, string]> = {
  unreviewed: ['미검토', 'red'], inReview: ['검토중', 'amber'],
  request: ['수정작업중', 'red'], reviewed: ['검토완료', 'green'],
};

interface Props {
  items: QueueListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  counts: { all: number; unreviewed: number; inReview: number; request: number; reviewed: number };
}

export function CustomerWorklist({ items, selectedId, onSelect, counts }: Props) {
  return (
    <aside className={styles.qpanel}>
      <div className={styles.card}>
        <div className={styles.head}><div><h1>고객 업무함</h1></div></div>
        <div className={styles.body}>
          <div className={styles.metrics}>
            <div className={styles.metric}><small>미검토</small><b>{counts.unreviewed}</b></div>
            <div className={styles.metric}><small>수정중</small><b>{counts.request}</b></div>
            <div className={styles.metric}><small>전체</small><b>{counts.all}</b></div>
            <div className={styles.metric}><small>기간</small><b>월</b></div>
          </div>
          <div className={styles.qlist}>
            {items.length === 0 && <div className={styles.body}>해당 조건의 고객 업무가 없습니다.</div>}
            {items.map(it => {
              const lbl = STATUS_LABEL_MAP[it.status];
              const [text, cls] = LABEL_KO[lbl] ?? ['기타', 'gray'];
              const isActive = selectedId === it.id;
              return (
                <div key={it.id}
                  className={`${styles.cust} ${isActive ? styles.active : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => onSelect(it.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(it.id);
                    }
                  }}>
                  <div className={styles.ct}>
                    <b>{it.customer?.customer_name ?? '—'}</b>
                    <span className={`${styles.badge} ${styles[cls]}`}>{text}</span>
                  </div>
                  <span>{it.customer?.npwp ?? 'NPWP 없음'} · PPh 21 · {it.tax_period_year}-{String(it.tax_period_month).padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
