'use client';
import styles from './workqueue.module.css';
import type { PpnRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const lvlText = (l: string) => (l === 'green' ? '완료' : l === 'red' ? '요청' : '검토');
const dirText = (t: string) => (t === 'MASUKAN' ? '매입' : '매출');

// recon_status → [표시문구, badge 색 클래스]
function reconBadge(status: string | null): [string, string] {
  switch (status) {
    case 'MATCH': return ['일치', 'green'];
    case 'DIFF': return ['불일치', 'red'];
    case 'MISSING_CORETAX': return ['Coretax 누락', 'amber'];
    case 'MISSING_CUSTOMER': return ['고객자료 누락', 'amber'];
    default: return ['미대조', 'gray'];
  }
}

interface Props {
  rows: PpnRow[];
  onRequest: (row: PpnRow) => void;
}

export function PpnReviewTable({ rows, onRequest }: Props) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>방향</th><th>faktur 번호</th><th>거래처</th><th>NPWP</th>
          <th className={styles.money}>DPP</th><th className={styles.money}>PPN</th>
          <th>Coretax 대조</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const [reconText, reconCls] = reconBadge(r.reconStatus);
            return (
              <tr key={r.id}>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{lvlText(r.flags.level)}</span></td>
                <td>{dirText(r.fakturType)}</td>
                <td className={styles.name}><b>{r.fakturNumber ?? '번호 없음'}</b><span>{r.fakturDate ?? ''}</span></td>
                <td>{r.counterpartyName}</td>
                <td>{r.counterpartyNpwp ?? 'NPWP 없음'}</td>
                <td className={styles.money}>{rp(r.dpp)}</td>
                <td className={styles.money}>{rp(r.ppn)}</td>
                <td><span className={`${styles.badge} ${styles[reconCls]}`}>{reconText}</span></td>
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
