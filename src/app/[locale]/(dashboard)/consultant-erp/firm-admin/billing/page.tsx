import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CreditCard } from 'lucide-react';
import { FirmAdminBillingView } from '@/components/consultant-erp/firm-admin/FirmAdminBillingView';

export default async function FirmAdminBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('firmAdmin');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {t('eyebrow')}
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('billingTitle')}</h1>
        <p className="text-indigo-100 text-sm mt-1">{t('billingDesc')}</p>
      </div>

      <FirmAdminBillingView />
    </div>
  );
}
