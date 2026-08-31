'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { type WithholdingRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const regimeText = (r: string) => (r === 'PPH4_2' ? 'PPh 4(2)' : 'PPh 23');
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

interface Props {
  rows: WithholdingRow[];
  onRequest: (row: WithholdingRow) => void;
  onViewPhoto: (row: WithholdingRow) => void;
  onOpenDetail?: (row: WithholdingRow) => void; // 더블클릭 상세 팝업 (요청 15)
}

export function WithholdingReviewTable({ rows, onRequest, onViewPhoto, onOpenDetail }: Props) {
  const tw = useTranslations('workqueue');
  const reviewText = (level: string) =>
    level === 'green' ? tw('reviewDone') : level === 'red' ? tw('reviewIssue') : tw('reviewUnconfirmed');
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>{tw('colStatus')}</th><th>{tw('colCounterparty')}</th><th>{tw('colNpwp')}</th><th>{tw('colTaxType')}</th><th>{tw('colTxnDate')}</th>
          <th className={styles.money}>{tw('colGross')}</th><th>{tw('colTaxRate')}</th><th className={styles.money}>{tw('colTax')}</th>
          <th>{tw('colEvidence')}</th><th>{tw('colIssue')}</th><th>{tw('request')}</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onDoubleClick={() => onOpenDetail?.(r)} title={tw('dblClickEdit')} style={{ cursor: onOpenDetail ? 'pointer' : undefined }}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewText(r.flags.level)}</span></td>
              <td className={styles.name}><b>{r.counterpartyName}</b><span>{r.incomeType}</span></td>
              <td>{r.counterpartyNpwp ?? tw('noNpwp')}</td>
              <td>{regimeText(r.regime)}</td>
              <td>{r.transactionDate ?? '—'}</td>
              <td className={styles.money}>{rp(r.grossAmount)}</td>
              <td>{pct(r.taxRate)}</td>
              <td className={styles.money}>{rp(r.taxAmount)}</td>
              <td>
                {r.hasInvoicePhoto
                  ? <button className={styles.btn} onClick={() => onViewPhoto(r)}>{tw('attached')}</button>
                  : <span style={{ color: '#9ca3af' }}>{tw('notAttached')}</span>}
              </td>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
              <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>{tw('request')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
