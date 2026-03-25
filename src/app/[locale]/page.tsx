import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Zap,
  Shield,
  Clock,
  FileCheck,
  Users,
  Building2,
  CheckCircle,
  ArrowRight,
  Star,
} from 'lucide-react';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');

  const features = [
    { icon: Zap, titleKey: 'feature1Title', descKey: 'feature1Desc', color: 'bg-blue-100 text-blue-600' },
    { icon: Shield, titleKey: 'feature2Title', descKey: 'feature2Desc', color: 'bg-green-100 text-green-600' },
    { icon: Clock, titleKey: 'feature3Title', descKey: 'feature3Desc', color: 'bg-purple-100 text-purple-600' },
    { icon: FileCheck, titleKey: 'feature4Title', descKey: 'feature4Desc', color: 'bg-orange-100 text-orange-600' },
  ];

  const plans = [
    { name: t('planFree'), price: 'Rp 0', period: t('planPeriodYear'), features: [t('planFreeF1'), t('planFreeF2'), t('planFreeF3')], cta: t('planFreeCta'), popular: false },
    { name: t('planBasic'), price: 'Rp 199K', period: t('planPeriodMonth'), features: [t('planBasicF1'), t('planBasicF2'), t('planBasicF3'), t('planBasicF4')], cta: t('planBasicCta'), popular: true },
    { name: t('planPro'), price: 'Rp 499K', period: t('planPeriodMonth'), features: [t('planProF1'), t('planProF2'), t('planProF3'), t('planProF4'), t('planProF5')], cta: t('planProCta'), popular: false },
  ];

  const stats = [
    { value: '40M+', label: t('statTaxpayers') },
    { value: '5', label: t('statMinutes') },
    { value: '99.9%', label: t('statUptime') },
    { value: '5', label: t('statLanguages') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PAJAK</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/login`} className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2">
              {t('login')}
            </Link>
            <Link href={`/${locale}/register`} className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2">
              {t('register')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 lg:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm text-blue-700 font-medium mb-6">
            <Star className="h-4 w-4" />
            {t('heroBadge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            {t('heroTitle')}
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/register`} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-white font-medium hover:bg-blue-700 transition-colors">
              {t('heroCtaPrimary')}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href={`/${locale}/login`} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-8 py-3.5 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
              {t('heroCtaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20" id="features">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('featuresTitle')}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('featuresSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.titleKey} className="text-center">
                  <div className={`inline-flex rounded-xl p-3 mb-4 ${f.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t(f.titleKey)}</h3>
                  <p className="text-sm text-gray-500">{t(f.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 px-6 py-20" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('pricingTitle')}</h2>
            <p className="text-gray-500">{t('pricingSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-2xl bg-white p-8 ${plan.popular ? 'ring-2 ring-blue-600 relative' : 'border border-gray-200'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                    {t('mostPopular')}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">/{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/register`}
                  className={`mt-8 block w-full text-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">{t('whoTitle')}</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { icon: Users, titleKey: 'whoIndividual', descKey: 'whoIndividualDesc' },
              { icon: Building2, titleKey: 'whoBusiness', descKey: 'whoBusinessDesc' },
              { icon: Shield, titleKey: 'whoConsultant', descKey: 'whoConsultantDesc' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="p-6 rounded-xl border border-gray-200">
                  <Icon className="h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">{t(item.titleKey)}</h3>
                  <p className="text-sm text-gray-500">{t(item.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 px-6 py-16">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">{t('ctaTitle')}</h2>
          <p className="text-blue-100 mb-8">{t('ctaSubtitle')}</p>
          <Link href={`/${locale}/register`} className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-blue-600 font-medium hover:bg-blue-50 transition-colors">
            {t('ctaButton')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">© 2026 AI Pajak. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href={`/${locale}/privacy`} className="text-sm text-gray-500 hover:text-gray-700">{t('privacy')}</Link>
            <Link href={`/${locale}/terms`} className="text-sm text-gray-500 hover:text-gray-700">{t('terms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
