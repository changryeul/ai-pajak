'use client';
import styles from './workqueue.module.css';
import { reviewStateText, type UmkmRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const taxText = (t: string) => (t === 'PPh25' ? 'PPh 25' : 'PPh Final');

// status → [표시문구, badge 색]
function statusBadge(status: string | null): [string, string] {
  switch (status) {
    case 'PAID': return ['완납', 'green'];
    case 'OVERDUE': return ['연체', 'red'];
    case 'PARTIAL': return ['부분납', 'amber'];
    case 'UNPAID': return ['미납', 'gray'];
    default: return ['—', 'gray'];
  }
}

interface Props {
  rows: UmkmRow[];
  onRequest: (row: UmkmRow) => void;
}

export function UmkmReviewTable({ rows, onRequest }: Props) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>세목</th><th>납부기한</th><th>신고기한</th>
          <th className={styles.money}>납부할 세액</th><th className={styles.money}>납부액</th><th className={styles.money}>가산세</th>
          <th>kode billing</th><th>납부상태</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const [stText, stCls] = statusBadge(r.paymentStatus);
            return (
              <tr key={r.id}>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewStateText(r.flags.level)}</span></td>
                <td className={styles.name}><b>{taxText(r.taxType)}</b></td>
                <td>{r.paymentDeadline ?? '—'}</td>
                <td>{r.reportingDeadline ?? '—'}</td>
                <td className={styles.money}>{rp(r.amountDue)}</td>
                <td className={styles.money}>{rp(r.amountPaid)}</td>
                <td className={styles.money}>{r.penaltyAmount > 0 ? rp(r.penaltyAmount) : '—'}</td>
                <td>{r.kodeBilling ?? '미발급'}</td>
                <td><span className={`${styles.badge} ${styles[stCls]}`}>{stText}</span></td>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
                <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>요청</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
