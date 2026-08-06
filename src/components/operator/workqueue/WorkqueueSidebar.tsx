'use client';
import styles from './workqueue.module.css';
import type { StatusFilter } from './types';

interface Props {
  counts: { all: number; unreviewed: number; inReview: number; request: number; reviewed: number };
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
}

/**
 * 아이콘 레일 사이드바 (수정요청 3·4·5번, 2026-08-05):
 * 기본 64px 접힘 + hover 시 펼침. 세목 전환은 상단 가로 탭으로 이동했고
 * '직원 인사 기록' 뷰는 메뉴에서 제외(화면·API 는 유지 — 딥링크/후속 재사용).
 */
export function WorkqueueSidebar({ counts, statusFilter, onStatusFilter }: Props) {
  const statusBtn = (key: StatusFilter, icon: string, label: string, n: number, cls: string) => (
    <button className={`${styles.nav} ${statusFilter === key ? styles.active : ''}`}
      aria-pressed={statusFilter === key} onClick={() => onStatusFilter(key)} title={label}>
      <span className={styles.ico} aria-hidden="true">{icon}</span>
      <span className={styles.lbl}>{label}</span>
      <span className={`${styles.cnt} ${styles[cls]} ${styles.lbl}`}>{n}</span>
    </button>
  );
  return (
    <aside className={styles.side}>
      <div className={styles.brand}>
        <div className={styles.logo}>AI</div>
        <div className={styles.lbl}>AI Pajak</div>
      </div>
      <div className={`${styles.st} ${styles.lbl}`}>상담원 업무함</div>
      {statusBtn('', '📌', '전체 고객 업무함', counts.all, 'blue')}
      {statusBtn('unreviewed', '🔴', '미검토 고객', counts.unreviewed, 'red')}
      {statusBtn('inReview', '🟡', '검토중', counts.inReview, 'amber')}
      {statusBtn('request', '💬', '수정작업중', counts.request, 'red')}
      {statusBtn('reviewed', '🟢', '검토완료', counts.reviewed, 'green')}
      <div className={`${styles.st} ${styles.lbl}`}>상담원 처리업무</div>
      <a className={styles.nav} href="../billing-issuance" title="ID Billing 발행">
        <span className={styles.ico} aria-hidden="true">🧾</span>
        <span className={styles.lbl}>ID Billing 발행</span>
      </a>
      {/* 수정요청 12번 — 하단 플로팅 '고객 인박스 열기' 대신 사이드 메뉴로 */}
      <a className={styles.nav} href="../customer-inbox" title="고객 인박스">
        <span className={styles.ico} aria-hidden="true">💬</span>
        <span className={styles.lbl}>고객 인박스</span>
      </a>
    </aside>
  );
}
