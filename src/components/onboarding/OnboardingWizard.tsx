'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Sparkles } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const t = useTranslations('onboarding');

  const handleStart = () => {
    localStorage.setItem('ai-pajak-onboarded', 'true');
    onComplete();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center space-y-6 py-12">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{t('welcomeTitle')}</h1>
        <p className="text-lg text-gray-500 max-w-md mx-auto">{t('welcomeDesc')}</p>
        <button
          onClick={handleStart}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          {t('getStarted')}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
