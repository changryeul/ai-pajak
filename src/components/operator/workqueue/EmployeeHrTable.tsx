'use client';
import styles from './workqueue.module.css';
import type { EmployeeHrRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function EmployeeHrTable({ rows, onRequest }:
  { rows: EmployeeHrRow[]; onRequest: (row: EmployeeHrRow) => void }) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead>
          <tr>
            <th>직원</th><th>직책/부서</th><th>NIK</th><th>NPWP</th><th>PTKP</th>
            <th>입사일</th><th className={styles.money}>월 급여</th><th>상태</th><th>이슈</th><th>요청</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={10} style={{ color: '#6b7280' }}>등록된 직원이 없습니다.</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className={styles.name}><b>{r.name}</b><span>{r.employeeNumber ?? '사번 없음'}</span></td>
              <td>{[r.position, r.department].filter(Boolean).join(' / ') || '—'}</td>
              <td>{r.nik ?? '—'}</td>
              <td>{r.npwp ?? '—'}</td>
              <td>{r.ptkp ?? '—'}</td>
              <td>{r.hireDate ?? '—'}</td>
              <td className={styles.money}>{rp(r.grossSalary)}</td>
              <td><span className={`${styles.badge} ${r.isActive ? styles.green : styles.gray}`}>{r.isActive ? '재직' : '퇴사/비활성'}</span></td>
              <td>
                <span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span>
                {r.flags.issues.length > 1 && <span style={{ fontSize: 11, color: '#6b7280' }}> 외 {r.flags.issues.length - 1}</span>}
              </td>
              <td><button className={styles.btn} onClick={() => onRequest(r)}>요청</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
