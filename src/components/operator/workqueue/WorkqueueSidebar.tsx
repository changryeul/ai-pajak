'use client';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import styles from './workqueue.module.css';
import type { TaxView } from './types';

interface Props {
  taxTabs: Array<{ key: TaxView; label: string; icon: string }>;
  taxView: TaxView;
  onTaxView: (v: TaxView) => void;
}

/**
 * 아이콘 레일 사이드바 (수정요청 3·4·5번, 2026-08-05 / 27번 자리교환 2026-08-07):
 * 기본 64px 접힘 + hover 시 펼침.
 * - 27번: 세목 전환(개인소득세·원천세…)을 사이드바로, 상태필터(전체·미검토…)를 상단으로.
 * - 38번: 텍스트 마크 대신 공식 로고(/logo.png).
 * '직원 인사 기록' 뷰는 메뉴에서 제외(5번) — 화면·API 는 유지(딥링크/후속 재사용).
 */
export function WorkqueueSidebar({ taxTabs, taxView, onTaxView }: Props) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  return (
    <aside className={styles.side}>
      <div className={styles.brand}>
        <Image src="/logo.png" alt="AI Pajak" width={132} height={47} className={styles.brandLogo} priority />
      </div>
      <div className={`${styles.st} ${styles.lbl}`}>세목</div>
      {taxTabs.map(tab => (
        <button key={tab.key} className={`${styles.nav} ${taxView === tab.key ? styles.active : ''}`}
          aria-pressed={taxView === tab.key} onClick={() => onTaxView(tab.key)} title={tab.label}>
          <span className={styles.ico} aria-hidden="true">{tab.icon}</span>
          <span className={styles.lbl}>{tab.label}</span>
        </button>
      ))}
      <div className={`${styles.st} ${styles.lbl}`}>상담원 처리업무</div>
      <a className={styles.nav} href={`/${locale}/operator/billing-issuance`} title="ID Billing 발행">
        <span className={styles.ico} aria-hidden="true">🧾</span>
        <span className={styles.lbl}>ID Billing 발행</span>
      </a>
      {/* 수정요청 12번 — 하단 플로팅 '고객 인박스 열기' 대신 사이드 메뉴로 */}
      <a className={styles.nav} href={`/${locale}/operator/customer-inbox`} title="고객 인박스">
        <span className={styles.ico} aria-hidden="true">💬</span>
        <span className={styles.lbl}>고객 인박스</span>
      </a>
    </aside>
  );
}
