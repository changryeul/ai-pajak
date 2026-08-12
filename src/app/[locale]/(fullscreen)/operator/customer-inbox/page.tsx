import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/layout/PageTitle';
import { OperatorRail } from '@/components/operator/workqueue/OperatorRail';
import railStyles from '@/components/operator/workqueue/workqueue.module.css';
import { CustomerInboxClient } from './_components/CustomerInboxClient';

/**
 * 수정요청 44·53 — 옛 대시보드 사이드바 대신 워크큐 아이콘 레일.
 * 접근 게이트는 (fullscreen) layout 이 담당.
 */
export default async function OperatorCustomerInboxPage() {
  const t = await getTranslations('operatorCustomerInbox');
  return (
    <div className={railStyles.root}>
      <div className={railStyles.app}>
        <OperatorRail active="inbox" />
        <main className="min-h-screen overflow-x-hidden bg-gray-50 p-4 lg:p-6">
          <PageTitle title={t('title')} />
          <div className="mb-5">
            <h1 className="text-2xl font-black text-slate-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
          </div>
          <CustomerInboxClient />
        </main>
      </div>
    </div>
  );
}
