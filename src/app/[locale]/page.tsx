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
  Sparkles,
  FileSpreadsheet,
  Lightbulb,
  BarChart3,
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
    { icon: Zap, titleKey: 'feature1Title', descKey: 'feature1Desc', gradient: 'from-blue-500 to-cyan-500' },
    { icon: Shield, titleKey: 'feature2Title', descKey: 'feature2Desc', gradient: 'from-green-500 to-emerald-500' },
    { icon: Clock, titleKey: 'feature3Title', descKey: 'feature3Desc', gradient: 'from-purple-500 to-violet-500' },
    { icon: FileCheck, titleKey: 'feature4Title', descKey: 'feature4Desc', gradient: 'from-orange-500 to-red-500' },
  ];

  const aiFeatures = [
    { icon: Zap, titleKey: 'aiFeature1Title', descKey: 'aiFeature1Desc', gradient: 'from-blue-600 to-indigo-600' },
    { icon: FileSpreadsheet, titleKey: 'aiFeature2Title', descKey: 'aiFeature2Desc', gradient: 'from-emerald-500 to-green-600' },
    { icon: Sparkles, titleKey: 'aiFeature3Title', descKey: 'aiFeature3Desc', gradient: 'from-purple-500 to-pink-500' },
    { icon: Lightbulb, titleKey: 'aiFeature4Title', descKey: 'aiFeature4Desc', gradient: 'from-amber-500 to-orange-500' },
    { icon: BarChart3, titleKey: 'aiFeature5Title', descKey: 'aiFeature5Desc', gradient: 'from-green-500 to-teal-500' },
    { icon: Shield, titleKey: 'aiFeature6Title', descKey: 'aiFeature6Desc', gradient: 'from-red-500 to-rose-600' },
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">PAJAK</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/login`} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 transition-colors">
              {t('login')}
            </Link>
            <Link href={`/${locale}/register`} className="text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl px-5 py-2.5 shadow-md shadow-blue-500/20 transition-all">
              {t('register')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-4 py-1.5 text-sm text-blue-700 font-medium mb-8 shadow-sm">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            {t('heroBadge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] mb-6 tracking-tight">
            {t('heroTitle')}
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/register`} className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25">
              {t('heroCtaPrimary')}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href={`/${locale}/login`} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-8 py-4 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
              {t('heroCtaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Features - NEW SECTION */}
      <section className="px-6 py-20 bg-gradient-to-b from-white to-gray-50" id="ai-features">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-50 border border-yellow-200 px-4 py-1.5 text-sm text-yellow-700 font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              {t('aiPowered')}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">{t('aiFeaturesTitle')}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('aiFeaturesSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {aiFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.titleKey} className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${f.gradient} shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1 text-lg">{t(f.titleKey)}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{t(f.descKey)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-gray-50" id="features">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">{t('featuresTitle')}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('featuresSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.titleKey} className="text-center bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className={`inline-flex rounded-xl p-3 mb-4 bg-gradient-to-br ${f.gradient} shadow-sm`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t(f.titleKey)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(f.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">{t('pricingTitle')}</h2>
            <p className="text-gray-500">{t('pricingSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-2xl bg-white p-8 transition-all duration-300 hover:shadow-xl ${plan.popular ? 'ring-2 ring-blue-600 relative shadow-lg scale-105' : 'border border-gray-200 hover:-translate-y-1'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium px-4 py-1 rounded-full shadow-md">
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
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/register`}
                  className={`mt-8 block w-full text-center rounded-xl py-3 text-sm font-medium transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
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
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 tracking-tight">{t('whoTitle')}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Users, titleKey: 'whoIndividual', descKey: 'whoIndividualDesc', gradient: 'from-blue-500 to-cyan-500' },
              { icon: Building2, titleKey: 'whoBusiness', descKey: 'whoBusinessDesc', gradient: 'from-green-500 to-emerald-500' },
              { icon: Shield, titleKey: 'whoConsultant', descKey: 'whoConsultantDesc', gradient: 'from-purple-500 to-violet-500' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titleKey} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm mb-4`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t(item.titleKey)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(item.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="max-w-3xl mx-auto text-center text-white relative z-10">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">{t('ctaTitle')}</h2>
          <p className="text-blue-200 mb-8 text-lg">{t('ctaSubtitle')}</p>
          <Link href={`/${locale}/register`} className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-blue-700 font-medium hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/20">
            {t('ctaButton')}
            <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 bg-gray-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">AI</span>
            </div>
            <span className="text-sm text-gray-500">© 2026 AI Pajak. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link href={`/${locale}/privacy`} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{t('privacy')}</Link>
            <Link href={`/${locale}/terms`} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">{t('terms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
