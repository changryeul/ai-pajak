'use client';
import styles from './workqueue.module.css';
import type { TaxView, StatusFilter } from './types';

interface Props {
  counts: { all: number; unreviewed: number; inReview: number; request: number; reviewed: number };
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  taxView: TaxView;
  onTaxView: (v: TaxView) => void;
}

export function WorkqueueSidebar({ counts, statusFilter, onStatusFilter, taxView, onTaxView }: Props) {
  const statusBtn = (key: StatusFilter, icon: string, label: string, n: number, cls: string) => (
    <button className={`${styles.nav} ${statusFilter === key ? styles.active : ''}`}
      aria-pressed={statusFilter === key} onClick={() => onStatusFilter(key)}>
      <span><span aria-hidden="true">{icon}</span> {label}</span><span className={`${styles.cnt} ${styles[cls]}`}>{n}</span>
    </button>
  );
  const viewBtn = (key: TaxView, label: string, stub = false) => (
    <button className={`${styles.nav} ${taxView === key ? styles.active : ''}`}
      onClick={() => !stub && onTaxView(key)} disabled={stub} title={stub ? '준비 중' : ''}>
      <span>{label}{stub ? ' · 준비 중' : ''}</span>
    </button>
  );
  return (
    <aside className={styles.side}>
      <div className={styles.brand}><div className={styles.logo}>AI</div><div>AI Pajak</div></div>
      <div className={styles.st}>상담원 업무함</div>
      {statusBtn('', '📌', '전체 고객 업무함', counts.all, 'blue')}
      {statusBtn('unreviewed', '🔴', '미검토 고객', counts.unreviewed, 'red')}
      {statusBtn('inReview', '🟡', '검토중', counts.inReview, 'amber')}
      {statusBtn('request', '💬', '수정작업중', counts.request, 'red')}
      {statusBtn('reviewed', '🟢', '검토완료', counts.reviewed, 'green')}
      <div className={styles.st}>고객 입력자료 검토</div>
      <div className={styles.sub}>
        {viewBtn('pph21', '개인소득세 (PPh 21)')}
        {viewBtn('withholding', '원천세 (PPh 4(2), 15, 22, 23, 26)')}
        {viewBtn('umkm', '선납법인세 (PPh Final, 25)')}
        {viewBtn('ppn', '부가세 (PPN)')}
        {viewBtn('annual', '연 신고 (SPT)', true)}
        {viewBtn('employees', '직원 인사 기록', true)}
      </div>
      <div className={styles.st}>상담원 처리업무</div>
      <div className={styles.sub}>
        <a className={styles.nav} href="../billing-issuance"><span>ID Billing 발행</span></a>
      </div>
    </aside>
  );
}
