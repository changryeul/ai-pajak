'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import type { EmployeeHrRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

export function EmployeeHrTable({ rows, onRequest }:
  { rows: EmployeeHrRow[]; onRequest: (row: EmployeeHrRow) => void }) {
  const tw = useTranslations('workqueue');
  return (
    <div className={styles.tbl}>
      <table>
        <thead>
          <tr>
            <th>{tw('colEmployee')}</th><th>{tw('colPositionDept')}</th><th>NIK</th><th>NPWP</th><th>PTKP</th>
            <th>{tw('colHireDate')}</th><th className={styles.money}>{tw('colMonthlySalary')}</th><th>{tw('colStatus')}</th><th>{tw('colIssue')}</th><th>{tw('request')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={10} style={{ color: '#6b7280' }}>{tw('noEmployees')}</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className={styles.name}><b>{r.name}</b><span>{r.employeeNumber ?? tw('noEmployeeNumber')}</span></td>
              <td>{[r.position, r.department].filter(Boolean).join(' / ') || '—'}</td>
              <td>{r.nik ?? '—'}</td>
              <td>{r.npwp ?? '—'}</td>
              <td>{r.ptkp ?? '—'}</td>
              <td>{r.hireDate ?? '—'}</td>
              <td className={styles.money}>{rp(r.grossSalary)}</td>
              <td><span className={`${styles.badge} ${r.isActive ? styles.green : styles.gray}`}>{r.isActive ? tw('active') : tw('inactive')}</span></td>
              <td>
                <span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span>
                {r.flags.issues.length > 1 && <span style={{ fontSize: 11, color: '#6b7280' }}> {tw('andMore', { count: r.flags.issues.length - 1 })}</span>}
              </td>
              <td><button className={styles.btn} onClick={() => onRequest(r)}>{tw('request')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
