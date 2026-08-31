'use client';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import styles from './workqueue.module.css';
import { TAX_TABS, type TaxView } from './types';

// 세목 탭 라벨 i18n 키 (types.ts 의 한국어 label 대신 사용)
const TAB_LABEL_KEYS: Record<TaxView, string> = {
  pph21: 'taxTabPph21',
  withholding: 'taxTabWithholding',
  umkm: 'taxTabUmkm',
  ppn: 'taxTabPpn',
  annual: 'taxTabAnnual',
  employees: 'taxTabPph21',
  billing: 'railBillingIssuance',
};

/**
 * 공용 상담원 사이드바 (수정요청 51·53 → 58 통일).
 * 워크큐/발행보드/고객인박스 어디서나 동일한 메뉴(세목 + 처리업무)를 보여준다.
 * - 워크큐: 세목은 로컬 상태 전환(onTaxView), activeSection='workqueue'
 * - 발행보드/인박스: 세목 클릭 시 워크큐로 이동(?view=key), activeSection='billing'|'inbox'
 * 8/12 수정요청 56 라이트 테마(workqueue.module.css .side) 공유.
 */
export function OperatorRail({ active, taxView, onTaxView }: {
  active: 'workqueue' | 'billing' | 'inbox';
  taxView?: TaxView;
  onTaxView?: (v: TaxView) => void;
}) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const tw = useTranslations('workqueue');
  const tabLabel = (key: TaxView) => tw(TAB_LABEL_KEYS[key]);
  const router = useRouter();
  const logout = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };
  const navLink = (href: string, icon: string, label: string, isActive: boolean) => (
    <a className={`${styles.nav} ${isActive ? styles.active : ''}`}
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

      <div className={`${styles.st} ${styles.lbl}`}>{tw('railTaxTypes')}</div>
      {TAX_TABS.map(tab => {
        // 워크큐에선 로컬 전환(버튼), 그 외 화면에선 워크큐로 이동(링크).
        const isActive = active === 'workqueue' && taxView === tab.key;
        if (onTaxView) {
          return (
            <button key={tab.key} className={`${styles.nav} ${isActive ? styles.active : ''}`}
              aria-pressed={isActive} onClick={() => onTaxView(tab.key)} title={tabLabel(tab.key)}>
              <span className={styles.ico} aria-hidden="true">{tab.icon}</span>
              <span className={styles.lbl}>{tabLabel(tab.key)}</span>
            </button>
          );
        }
        return (
          <a key={tab.key} className={styles.nav} href={`/${locale}/operator/workqueue?view=${tab.key}`} title={tabLabel(tab.key)}>
            <span className={styles.ico} aria-hidden="true">{tab.icon}</span>
            <span className={styles.lbl}>{tabLabel(tab.key)}</span>
          </a>
        );
      })}

      <div className={`${styles.st} ${styles.lbl}`}>{tw('railTasks')}</div>
      {navLink('billing-issuance', '🧾', tw('railBillingIssuance'), active === 'billing')}
      {navLink('customer-inbox', '💬', tw('railCustomerInbox'), active === 'inbox')}

      <button className={styles.nav} onClick={logout} title={tw('logout')} style={{ marginTop: 'auto' }}>
        <span className={styles.ico} aria-hidden="true">⏻</span>
        <span className={styles.lbl}>{tw('logout')}</span>
      </button>
    </aside>
  );
}
