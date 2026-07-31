'use client';
import styles from './workqueue.module.css';
import type { Pph21Row } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const lvlText = (l: string) => (l === 'green' ? '완료' : l === 'red' ? '요청' : '검토');
const subText = (s: string) => (s === 'FINALIZED' || s === 'FILED' ? '완료' : '작성중');

interface Props {
  rows: Pph21Row[];
  selectedId: string | null;
  onSelect: (employeeId: string) => void;
  onRequest: (row: Pph21Row) => void;
}

export function EmployeeReviewTable({ rows, selectedId, onSelect, onRequest }: Props) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>직원</th><th>NPWP</th><th>PTKP</th><th className={styles.money}>총 지급</th>
          <th>BPJS</th><th>THR/보너스</th><th>TER</th><th className={styles.money}>PPH21</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.payslipId}
              className={selectedId === r.employeeId ? styles.sel : ''}
              role="button" tabIndex={0}
              aria-selected={selectedId === r.employeeId}
              onClick={() => onSelect(r.employeeId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  onSelect(r.employeeId);
                }
              }}
              style={{ cursor: 'pointer' }}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{lvlText(r.flags.level)}</span></td>
              <td className={styles.name}><b>{r.name}</b><span>{subText(r.payslipStatus)}</span></td>
              <td>{r.npwp ?? 'NPWP 없음'}</td>
              <td>{r.ptkp}</td>
              <td className={styles.money}>{rp(r.totalGross)}</td>
              <td>{r.bpjs > 0 ? '입력완료' : '미입력'}</td>
              <td>{r.thr > 0 ? rp(r.thr) : '없음'}</td>
              <td>Kategori {r.terCategory}</td>
              <td className={styles.money}>{rp(r.pph21)}</td>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
              <td><button className={`${styles.btn} ${styles.blue}`}
                onClick={(e) => { e.stopPropagation(); onRequest(r); }}>요청</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
