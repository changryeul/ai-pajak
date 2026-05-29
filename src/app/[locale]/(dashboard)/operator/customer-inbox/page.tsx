import { getTranslations } from 'next-intl/server';
import { PageTitle } from '@/components/layout/PageTitle';
import { CustomerInboxClient } from './_components/CustomerInboxClient';

export default async function OperatorCustomerInboxPage() {
  const t = await getTranslations('operatorCustomerInbox');
  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('title')} />
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      </div>
      <CustomerInboxClient />
    </div>
  );
}
