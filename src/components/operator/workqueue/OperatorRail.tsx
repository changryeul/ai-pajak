'use client';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import styles from './workqueue.module.css';

/**
 * 수정요청 51·53 — 발행보드/고객인박스에도 워크큐와 동일한 아이콘 레일 사이드바.
 * 8/10 에 대시보드 사이드바(예전 메뉴)를 떼면서 상단바만 뒀는데, 사이드 메뉴가
 * 아예 사라졌다는 피드백 → 워크큐 레일을 공용으로 재사용(옛 대시보드 메뉴 아님).
 */
export function OperatorRail({ active }: { active: 'workqueue' | 'billing' | 'inbox' }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const router = useRouter();
  const logout = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };
  const link = (href: string, icon: string, label: string, key: string) => (
    <a className={`${styles.nav} ${active === key ? styles.active : ''}`}
      href={`/${locale}/operator/${href}`} title={label}>
      <span className={styles.ico} aria-hidden="true">{icon}</span>
      <span className={styles.lbl}>{label}</span>
    </a>
  );
  return (
    <aside className={styles.side}>
      <div className={styles.brand}>
        <Image src="/logo.png" alt="AI Pajak" width={132} height={47} className={styles.brandLogo} priority />
      </div>
      <div className={`${styles.st} ${styles.lbl}`}>상담원</div>
      {link('workqueue', '📋', '상담원 업무함', 'workqueue')}
      {link('billing-issuance', '🧾', 'ID Billing 발행', 'billing')}
      {link('customer-inbox', '💬', '고객 인박스', 'inbox')}
      <button className={styles.nav} onClick={logout} title="로그아웃" style={{ marginTop: 'auto' }}>
        <span className={styles.ico} aria-hidden="true">⏻</span>
        <span className={styles.lbl}>로그아웃</span>
      </button>
    </aside>
  );
}
