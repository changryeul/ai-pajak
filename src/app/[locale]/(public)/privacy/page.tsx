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
              <p className="text-gray-500 mt-2">{t('privacyPolicy.lastUpdated')}: 31 Maret 2026</p>
            </div>

            {/* UU PDP Compliance Badge */}
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 text-center">
                {locale === 'id'
                  ? 'Kebijakan ini disusun sesuai dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)'
                  : 'This policy is prepared in compliance with Indonesian Personal Data Protection Law (UU PDP No. 27/2022)'}
              </p>
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
                <ul className="list-disc pl-6 text-gray-600 space-y-3">
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
                <ul className="list-disc pl-6 text-gray-600 space-y-3">
                  <li>{t('privacyPolicy.dataUsage.items.taxServices')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.aiProcessing')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.communication')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.improvement')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.legal')}</li>
                  <li>{t('privacyPolicy.dataUsage.items.security')}</li>
                </ul>
              </section>

              {/* Data Storage */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataStorage.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.dataStorage.content')}
                </p>
              </section>

              {/* Data Protection / Security */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.dataProtection.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.dataProtection.content')}
                </p>
              </section>

              {/* Third Party */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.thirdParty.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('privacyPolicy.thirdParty.intro')}
                </p>
                <div className="space-y-4 pl-4">
                  <div className="border-l-4 border-blue-200 pl-4">
                    <p className="text-gray-600">{t('privacyPolicy.thirdParty.items.djp')}</p>
                  </div>
                  <div className="border-l-4 border-blue-200 pl-4">
                    <p className="text-gray-600">{t('privacyPolicy.thirdParty.items.anthropic')}</p>
                  </div>
                  <div className="border-l-4 border-blue-200 pl-4">
                    <p className="text-gray-600">{t('privacyPolicy.thirdParty.items.midtrans')}</p>
                  </div>
                  <div className="border-l-4 border-blue-200 pl-4">
                    <p className="text-gray-600">{t('privacyPolicy.thirdParty.items.jtc')}</p>
                  </div>
                </div>
                <p className="text-gray-700 font-medium mt-4">
                  {t('privacyPolicy.thirdParty.noSale')}
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
                <ul className="list-disc pl-6 text-gray-600 space-y-3">
                  <li>{t('privacyPolicy.userRights.items.access')}</li>
                  <li>{t('privacyPolicy.userRights.items.correction')}</li>
                  <li>{t('privacyPolicy.userRights.items.deletion')}</li>
                  <li>{t('privacyPolicy.userRights.items.restriction')}</li>
                  <li>{t('privacyPolicy.userRights.items.objection')}</li>
                  <li>{t('privacyPolicy.userRights.items.portability')}</li>
                  <li>{t('privacyPolicy.userRights.items.withdrawal')}</li>
                </ul>
                <p className="text-gray-600 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {t('privacyPolicy.userRights.howTo')}
                </p>
              </section>

              {/* Cookies */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.cookies.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.cookies.content')}
                </p>
              </section>

              {/* Children */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.children.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.children.content')}
                </p>
              </section>

              {/* Changes */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.changes.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.changes.content')}
                </p>
              </section>

              {/* Contact */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('privacyPolicy.contact.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('privacyPolicy.contact.content')}
                </p>
                <div className="mt-4 space-y-2 text-gray-600">
                  <p>
                    <span className="font-medium">{t('privacyPolicy.contact.dpo')}:</span>{' '}
                    <a href={`mailto:${t('privacyPolicy.contact.dpoEmail')}`} className="text-blue-600 hover:underline">
                      {t('privacyPolicy.contact.dpoEmail')}
                    </a>
                  </p>
                  <p>
                    Support:{' '}
                    <a href={`mailto:${t('privacyPolicy.contact.supportEmail')}`} className="text-blue-600 hover:underline">
                      {t('privacyPolicy.contact.supportEmail')}
                    </a>
                  </p>
                  <p>{t('privacyPolicy.contact.address')}</p>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center gap-6">
              <Link
                href={`/${locale}/terms`}
                className="text-blue-600 hover:underline"
              >
                {t('termsOfService.title')}
              </Link>
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
