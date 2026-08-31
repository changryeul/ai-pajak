'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { type UmkmRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const taxText = (t: string) => (t === 'PPh25' ? 'PPh 25' : 'PPh Final');

interface Props {
  rows: UmkmRow[];
  onRequest: (row: UmkmRow) => void;
}

export function UmkmReviewTable({ rows, onRequest }: Props) {
  const tw = useTranslations('workqueue');
  const reviewText = (level: string) =>
    level === 'green' ? tw('reviewDone') : level === 'red' ? tw('reviewIssue') : tw('reviewUnconfirmed');
  // status → [표시문구, badge 색]
  const statusBadge = (status: string | null): [string, string] => {
    switch (status) {
      case 'PAID': return [tw('paid'), 'green'];
      case 'OVERDUE': return [tw('overdue'), 'red'];
      case 'PARTIAL': return [tw('partial'), 'amber'];
      case 'UNPAID': return [tw('unpaid'), 'gray'];
      default: return ['—', 'gray'];
    }
  };
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>{tw('colStatus')}</th><th>{tw('colTaxType')}</th><th>{tw('colPaymentDeadline')}</th><th>{tw('colReportingDeadline')}</th>
          <th className={styles.money}>{tw('colAmountDue')}</th><th className={styles.money}>{tw('colAmountPaid')}</th><th className={styles.money}>{tw('colPenalty')}</th>
          <th>kode billing</th><th>{tw('colPaymentStatus')}</th><th>{tw('colIssue')}</th><th>{tw('request')}</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const [stText, stCls] = statusBadge(r.paymentStatus);
            return (
              <tr key={r.id}>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewText(r.flags.level)}</span></td>
                <td className={styles.name}><b>{taxText(r.taxType)}</b></td>
                <td>{r.paymentDeadline ?? '—'}</td>
                <td>{r.reportingDeadline ?? '—'}</td>
                <td className={styles.money}>{rp(r.amountDue)}</td>
                <td className={styles.money}>{rp(r.amountPaid)}</td>
                <td className={styles.money}>{r.penaltyAmount > 0 ? rp(r.penaltyAmount) : '—'}</td>
                <td>{r.kodeBilling ?? tw('notIssued')}</td>
                <td><span className={`${styles.badge} ${styles[stCls]}`}>{stText}</span></td>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
                <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>{tw('request')}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
