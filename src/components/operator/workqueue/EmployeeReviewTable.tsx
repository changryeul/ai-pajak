'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { reviewStateText, type Pph21Row } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const subText = (s: string) => (s === 'FINALIZED' || s === 'FILED' ? '완료' : '작성중');

interface Props {
  rows: Pph21Row[];
  selectedId: string | null;
  // 수정요청 45 — payslipId(고유)로 선택. employeeId 는 미등록 직원이 null/중복이라
  // 어느 행을 눌러도 같은(첫) 행이 잡히던 버그의 원인이었음.
  onSelect: (payslipId: string) => void;
  onRequest: (row: Pph21Row) => void;
}

export function EmployeeReviewTable({ rows, selectedId, onSelect, onRequest }: Props) {
  const t = useTranslations('operatorWorkqueue');
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>{t('colStatus')}</th><th>{t('colEmployee')}</th><th>{t('colNpwp')}</th><th>{t('colPtkp')}</th><th className={styles.money}>{t('colGross')}</th>
          <th>{t('colBpjs')}</th><th>{t('colThr')}</th><th>{t('colTer')}</th><th className={styles.money}>{t('colPph21')}</th><th>{t('colIssue')}</th><th>{t('colRequest')}</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.payslipId}
              className={selectedId === r.payslipId ? styles.sel : ''}
              role="button" tabIndex={0}
              aria-pressed={selectedId === r.payslipId}
              onClick={() => onSelect(r.payslipId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  onSelect(r.payslipId);
                }
              }}
              style={{ cursor: 'pointer' }}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewStateText(r.flags.level)}</span></td>
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
