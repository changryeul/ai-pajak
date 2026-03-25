'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Briefcase,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type TaxpayerType = 'employee' | 'business' | 'company' | null;
type FilingGoal = 'annual' | 'monthly' | 'both' | null;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const t = useTranslations('onboarding');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [step, setStep] = useState(0);
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType>(null);
  const [filingGoal, setFilingGoal] = useState<FilingGoal>(null);

  const steps = [
    { key: 'welcome', title: t('step1Title') },
    { key: 'type', title: t('step2Title') },
    { key: 'goal', title: t('step3Title') },
    { key: 'ready', title: t('step4Title') },
  ];

  const taxpayerOptions = [
    { value: 'employee' as const, icon: User, titleKey: 'typeEmployee', descKey: 'typeEmployeeDesc' },
    { value: 'business' as const, icon: Briefcase, titleKey: 'typeBusiness', descKey: 'typeBusinessDesc' },
    { value: 'company' as const, icon: Building2, titleKey: 'typeCompany', descKey: 'typeCompanyDesc' },
  ];

  const goalOptions = [
    { value: 'annual' as const, titleKey: 'goalAnnual', descKey: 'goalAnnualDesc' },
    { value: 'monthly' as const, titleKey: 'goalMonthly', descKey: 'goalMonthlyDesc' },
    { value: 'both' as const, titleKey: 'goalBoth', descKey: 'goalBothDesc' },
  ];

  const getRecommendation = () => {
    if (taxpayerType === 'employee') return { form: 'SPT 1770SS', href: '/tax/spt-tahunan/1770ss' };
    if (taxpayerType === 'business') return { form: 'SPT 1770', href: '/tax/spt-tahunan/1770' };
    return { form: 'SPT 1771', href: '/tax/spt-tahunan/1771' };
  };

  const handleFinish = () => {
    localStorage.setItem('ai-pajak-onboarded', 'true');
    onComplete();

    const rec = getRecommendation();
    if (filingGoal === 'annual' || filingGoal === 'both') {
      router.push(`/${locale}${rec.href}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-blue-600' : 'bg-gray-200'
            )} />
          </div>
        ))}
      </div>

      {/* Step 0: Welcome */}
      {step === 0 && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t('welcomeTitle')}</h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto">{t('welcomeDesc')}</p>
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            {t('getStarted')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Step 1: Taxpayer Type */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{t('step2Title')}</h2>
            <p className="text-gray-500 mt-1">{t('step2Desc')}</p>
          </div>
          <div className="grid gap-4">
            {taxpayerOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <Card
                  key={opt.value}
                  className={cn(
                    'cursor-pointer transition-all hover:border-blue-300',
                    taxpayerType === opt.value && 'border-blue-600 ring-2 ring-blue-100'
                  )}
                  onClick={() => setTaxpayerType(opt.value)}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={cn(
                      'rounded-lg p-3',
                      taxpayerType === opt.value ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                      <Icon className={cn(
                        'h-6 w-6',
                        taxpayerType === opt.value ? 'text-blue-600' : 'text-gray-500'
                      )} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{t(opt.titleKey)}</h3>
                      <p className="text-sm text-gray-500">{t(opt.descKey)}</p>
                    </div>
                    {taxpayerType === opt.value && (
                      <CheckCircle2 className="h-6 w-6 text-blue-600" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Filing Goal */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{t('step3Title')}</h2>
            <p className="text-gray-500 mt-1">{t('step3Desc')}</p>
          </div>
          <div className="grid gap-4">
            {goalOptions.map((opt) => (
              <Card
                key={opt.value}
                className={cn(
                  'cursor-pointer transition-all hover:border-blue-300',
                  filingGoal === opt.value && 'border-blue-600 ring-2 ring-blue-100'
                )}
                onClick={() => setFilingGoal(opt.value)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={cn(
                    'rounded-lg p-3',
                    filingGoal === opt.value ? 'bg-blue-100' : 'bg-gray-100'
                  )}>
                    <FileSpreadsheet className={cn(
                      'h-6 w-6',
                      filingGoal === opt.value ? 'text-blue-600' : 'text-gray-500'
                    )} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{t(opt.titleKey)}</h3>
                    <p className="text-sm text-gray-500">{t(opt.descKey)}</p>
                  </div>
                  {filingGoal === opt.value && (
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Ready */}
      {step === 3 && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('readyTitle')}</h2>
          <p className="text-gray-500 max-w-md mx-auto">{t('readyDesc')}</p>

          {/* Recommendation */}
          <Card className="max-w-sm mx-auto border-blue-200 bg-blue-50">
            <CardContent className="p-5 text-left">
              <p className="text-sm font-medium text-blue-800 mb-1">{t('recommendation')}</p>
              <p className="text-lg font-bold text-blue-900">{getRecommendation().form}</p>
              <p className="text-sm text-blue-600 mt-1">
                {taxpayerType === 'employee' && t('recEmployee')}
                {taxpayerType === 'business' && t('recBusiness')}
                {taxpayerType === 'company' && t('recCompany')}
              </p>
            </CardContent>
          </Card>

          <button
            onClick={handleFinish}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            {t('startFiling')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      {step > 0 && step < 3 && (
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>
          <button
            onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !taxpayerType) || (step === 2 && !filingGoal)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-6 py-2.5 font-medium transition-colors',
              ((step === 1 && taxpayerType) || (step === 2 && filingGoal))
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {t('next')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
