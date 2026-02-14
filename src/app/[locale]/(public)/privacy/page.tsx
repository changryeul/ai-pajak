'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal');
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <Link href={`/${locale}`} className="inline-flex items-center gap-2 mb-6">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">AI</span>
                </div>
                <span className="text-xl font-bold text-gray-900">AI Pajak</span>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{t('privacyPolicy.title')}</h1>
              <p className="text-gray-500 mt-2">{t('privacyPolicy.lastUpdated')}: 14 Februari 2026</p>
            </div>

            {/* Content */}
            <div className="prose prose-gray max-w-none">
              {/* Introduction */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.introduction.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.introduction.content')}
                </p>
              </section>

              {/* Data Collection */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataCollection.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('privacyPolicy.dataCollection.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('privacyPolicy.dataCollection.items.identity')}</li>
                  <li>{t('privacyPolicy.dataCollection.items.contact')}</li>
                  <li>{t('privacyPolicy.dataCollection.items.tax')}</li>
                  <li>{t('privacyPolicy.dataCollection.items.financial')}</li>
                  <li>{t('privacyPolicy.dataCollection.items.usage')}</li>
                </ul>
              </section>

              {/* Data Usage */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataUsage.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('privacyPolicy.dataUsage.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('privacyPolicy.dataUsage.items.taxServices')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.communication')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.improvement')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.legal')}</li>
                </ul>
              </section>

              {/* Data Protection */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataProtection.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.dataProtection.content')}
                </p>
              </section>

              {/* Data Retention */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataRetention.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.dataRetention.content')}
                </p>
              </section>

              {/* User Rights */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.userRights.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('privacyPolicy.userRights.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('privacyPolicy.userRights.items.access')}</li>
                  <li>{t('privacyPolicy.userRights.items.correction')}</li>
                  <li>{t('privacyPolicy.userRights.items.deletion')}</li>
                  <li>{t('privacyPolicy.userRights.items.objection')}</li>
                </ul>
              </section>

              {/* Third Party */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.thirdParty.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.thirdParty.content')}
                </p>
              </section>

              {/* Contact */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.contact.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.contact.content')}
                </p>
                <p className="text-gray-600 mt-4">
                  Email: <a href="mailto:privacy@aipajak.com" className="text-blue-600 hover:underline">privacy@aipajak.com</a>
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <Link
                href={`/${locale}/login`}
                className="text-blue-600 hover:underline"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
