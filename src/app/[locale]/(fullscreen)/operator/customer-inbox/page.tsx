import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/layout/PageTitle';
import { OperatorFullscreenBar } from '@/components/operator/OperatorFullscreenBar';
import { CustomerInboxClient } from './_components/CustomerInboxClient';

/**
 * 수정요청 44 — 대시보드 사이드바(예전 메뉴) 대신 워크큐 맥락의 상단바.
 * 접근 게이트는 (fullscreen) layout 이 담당.
 */
export default async function OperatorCustomerInboxPage() {
  const t = await getTranslations('operatorCustomerInbox');
  return (
    <div className="min-h-screen bg-gray-50">
      <OperatorFullscreenBar title={t('title')} />
      <div className="container mx-auto py-6 px-4 max-w-[1400px]">
        <PageTitle title={t('title')} />
        <div className="mb-5">
          <h1 className="text-2xl font-black text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
        </div>
        <CustomerInboxClient />
      </div>
    </div>
  );
}
