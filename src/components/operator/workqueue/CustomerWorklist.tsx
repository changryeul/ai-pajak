'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { STATUS_LABEL_MAP, type QueueListItem } from './types';

const LABEL_CLS: Record<string, string> = {
  unreviewed: 'red', inReview: 'amber', request: 'red', reviewed: 'green',
};
const LABEL_KEY: Record<string, string> = {
  unreviewed: 'statusUnreviewed', inReview: 'statusInReview',
  request: 'statusRequest', reviewed: 'statusReviewed',
};
// djp_submission_queue.tax_type → 카드 표기 (미지 타입은 raw 표기)
const TAX_TYPE_LABELS: Record<string, string> = {
  PPh21: 'PPh 21', PPh23: '원천세', PPN: 'PPN', PPh_FINAL: 'PPh Final',
  PPh25: 'PPh 25', PPh4_2: 'PPh 4(2)', PPh15: 'PPh 15', PPh22: 'PPh 22',
  PPh26: 'PPh 26', SPT_TAHUNAN: '연 신고(SPT)',
};

interface Props {
  items: QueueListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomerWorklist({ items, selectedId, onSelect }: Props) {
  const t = useTranslations('operatorWorkqueue');
  return (
    <aside className={styles.qpanel}>
      <div className={styles.card}>
        <div className={styles.head}><div><h1>{t('title')}</h1></div></div>
        <div className={styles.body}>
          <div className={styles.qlist}>
            {items.length === 0 && <div className={styles.body}>{t('empty')}</div>}
            {items.map(it => {
              const lbl = STATUS_LABEL_MAP[it.status];
              const cls = LABEL_CLS[lbl] ?? 'gray';
              const text = LABEL_KEY[lbl] ? t(LABEL_KEY[lbl]) : '기타';
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
                  <span>{it.customer?.npwp ?? 'NPWP 없음'} · {TAX_TYPE_LABELS[it.tax_type] ?? it.tax_type} · {
                    it.tax_type === 'SPT_TAHUNAN'
                      ? `${it.tax_period_year} 회계연도`
                      : `${it.tax_period_year}-${String(it.tax_period_month).padStart(2, '0')}`
                  }</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
