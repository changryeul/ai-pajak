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
              <p className="text-gray-500 mt-2">{t('termsOfService.lastUpdated')}: 31 Maret 2026</p>
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
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('termsOfService.services.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('termsOfService.services.items.calculation')}</li>
                  <li>{t('termsOfService.services.items.filing')}</li>
                  <li>{t('termsOfService.services.items.document')}</li>
                  <li>{t('termsOfService.services.items.optimization')}</li>
                  <li>{t('termsOfService.services.items.consultation')}</li>
                  <li>{t('termsOfService.services.items.notifications')}</li>
                </ul>
              </section>

              {/* User Obligations */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.userObligations.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('termsOfService.userObligations.intro')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('termsOfService.userObligations.items.accurate')}</li>
                  <li>{t('termsOfService.userObligations.items.npwp')}</li>
                  <li>{t('termsOfService.userObligations.items.confidential')}</li>
                  <li>{t('termsOfService.userObligations.items.lawful')}</li>
                  <li>{t('termsOfService.userObligations.items.compliance')}</li>
                  <li>{t('termsOfService.userObligations.items.review')}</li>
                  <li>{t('termsOfService.userObligations.items.age')}</li>
                </ul>
              </section>

              {/* AI Disclaimer */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.aiDisclaimer.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('termsOfService.aiDisclaimer.content')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-3">
                  <li className="font-medium">{t('termsOfService.aiDisclaimer.items.notAdvisor')}</li>
                  <li>{t('termsOfService.aiDisclaimer.items.verification')}</li>
                  <li>{t('termsOfService.aiDisclaimer.items.noGuarantee')}</li>
                  <li>{t('termsOfService.aiDisclaimer.items.limitation')}</li>
                  <li>{t('termsOfService.aiDisclaimer.items.humanReview')}</li>
                </ul>
              </section>

              {/* Platform Limitations */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.platformLimitations.title')}</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('termsOfService.platformLimitations.content')}
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>{t('termsOfService.platformLimitations.items.scope')}</li>
                  <li>{t('termsOfService.platformLimitations.items.availability')}</li>
                  <li>{t('termsOfService.platformLimitations.items.djpDependency')}</li>
                  <li>{t('termsOfService.platformLimitations.items.regulations')}</li>
                </ul>
              </section>

              {/* Data Handling */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.dataHandling.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.dataHandling.content')}
                </p>
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

              {/* Intellectual Property */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.intellectualProperty.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.intellectualProperty.content')}
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

              {/* Dispute Resolution */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.disputeResolution.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.disputeResolution.content')}
                </p>
              </section>

              {/* Changes */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.changes.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.changes.content')}
                </p>
              </section>

              {/* Severability */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.severability.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.severability.content')}
                </p>
              </section>

              {/* Contact */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('termsOfService.contact.title')}</h2>
                <p className="text-gray-600 leading-relaxed">
                  {t('termsOfService.contact.content')}
                </p>
                <div className="mt-4 space-y-2 text-gray-600">
                  <p>
                    Email: <a href={`mailto:${t('termsOfService.contact.supportEmail')}`} className="text-blue-600 hover:underline">{t('termsOfService.contact.supportEmail')}</a>
                  </p>
                  <p>
                    Legal: <a href={`mailto:${t('termsOfService.contact.legalEmail')}`} className="text-blue-600 hover:underline">{t('termsOfService.contact.legalEmail')}</a>
                  </p>
                  <p>{t('termsOfService.contact.address')}</p>
                </div>
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
