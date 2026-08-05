'use client';
import styles from './workqueue.module.css';
import { reviewStateText, type WithholdingRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const regimeText = (r: string) => (r === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23');
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

interface Props {
  rows: WithholdingRow[];
  onRequest: (row: WithholdingRow) => void;
  onViewPhoto: (row: WithholdingRow) => void;
}

export function WithholdingReviewTable({ rows, onRequest, onViewPhoto }: Props) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>거래처</th><th>NPWP</th><th>세목</th><th>거래일</th>
          <th className={styles.money}>총 지급</th><th>세율</th><th className={styles.money}>세액</th>
          <th>증빙</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewStateText(r.flags.level)}</span></td>
              <td className={styles.name}><b>{r.counterpartyName}</b><span>{r.incomeType}</span></td>
              <td>{r.counterpartyNpwp ?? 'NPWP 없음'}</td>
              <td>{regimeText(r.regime)}</td>
              <td>{r.transactionDate ?? '—'}</td>
              <td className={styles.money}>{rp(r.grossAmount)}</td>
              <td>{pct(r.taxRate)}</td>
              <td className={styles.money}>{rp(r.taxAmount)}</td>
              <td>
                {r.hasInvoicePhoto
                  ? <button className={styles.btn} onClick={() => onViewPhoto(r)}>첨부됨</button>
                  : <span style={{ color: '#9ca3af' }}>미첨부</span>}
              </td>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
              <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>요청</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
