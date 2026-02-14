'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';

export default function TermsOfServicePage() {
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
              <h1 className="text-3xl font-bold text-gray-900">{t('termsOfService.title')}</h1>
              <p className="text-gray-500 mt-2">{t('termsOfService.lastUpdated')}: 14 Februari 2026</p>
            </div>

            {/* Content */}
            <div className="prose prose-gray max-w-none">
              {/* Acceptance */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.acceptance.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.acceptance.content')}
                </p>
              </section>

              {/* Services */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.services.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.services.content')}
                </p>
              </section>

              {/* User Obligations */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.userObligations.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('termsOfService.userObligations.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('termsOfService.userObligations.items.accurate')}</li>
                  <li>{t('termsOfService.userObligations.items.confidential')}</li>
                  <li>{t('termsOfService.userObligations.items.lawful')}</li>
                  <li>{t('termsOfService.userObligations.items.compliance')}</li>
                </ul>
              </section>

              {/* POA */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.poa.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.poa.content')}
                </p>
              </section>

              {/* Fees */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.fees.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.fees.content')}
                </p>
              </section>

              {/* Liability */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.liability.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.liability.content')}
                </p>
              </section>

              {/* Termination */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.termination.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.termination.content')}
                </p>
              </section>

              {/* Changes */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.changes.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.changes.content')}
                </p>
              </section>

              {/* Contact */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.contact.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.contact.content')}
                </p>
                <p className="text-gray-600 mt-4">
                  Email: <a href="mailto:legal@aipajak.com" className="text-blue-600 hover:underline">legal@aipajak.com</a>
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center gap-6">
              <Link
                href={`/${locale}/privacy`}
                className="text-blue-600 hover:underline"
              >
                {t('privacyPolicy.title')}
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
