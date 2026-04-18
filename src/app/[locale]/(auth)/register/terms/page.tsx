'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { PageTitle } from '@/components/layout/PageTitle';

export default function RegisterTermsPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/customer/onboarding/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toStep: 2 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('errors.serverError'));
        return;
      }
      router.push(`/${locale}/register/mandate`);
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <PageTitle title={t('onboarding.termsTitle')} />
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <OnboardingProgress
            steps={[
              { id: 1, label: t('onboarding.stepRegister') },
              { id: 2, label: t('onboarding.stepTerms') },
              { id: 3, label: t('onboarding.stepMandate') },
            ]}
            currentStep={2}
          />
          <CardTitle>{t('onboarding.termsTitle')}</CardTitle>
          <CardDescription>{t('onboarding.termsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="h-64 overflow-auto border rounded p-4 text-sm text-gray-700 space-y-3 bg-gray-50"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setScrolled(true);
              // Also treat short-content case: if no scroll needed, fire on first view below.
            }}
            ref={(el) => {
              if (el && el.scrollHeight <= el.clientHeight) setScrolled(true);
            }}
          >
            <h3 className="font-bold">{t('onboarding.termsSection1Title')}</h3>
            <p>{t('onboarding.termsSection1Body')}</p>
            <h3 className="font-bold">{t('onboarding.termsSection2Title')}</h3>
            <p>{t('onboarding.termsSection2Body')}</p>
            <h3 className="font-bold">{t('onboarding.termsSection3Title')}</h3>
            <p>{t('onboarding.termsSection3Body')}</p>
            <h3 className="font-bold">{t('onboarding.termsSection4Title')}</h3>
            <p>{t('onboarding.termsSection4Body')}</p>
            <h3 className="font-bold">{t('onboarding.termsSection5Title')}</h3>
            <p>{t('onboarding.termsSection5Body')}</p>
          </div>

          <label
            className={`flex items-center gap-2 text-sm ${scrolled ? 'text-gray-800' : 'text-gray-400 cursor-not-allowed'}`}
          >
            <input
              type="checkbox"
              disabled={!scrolled}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            {t('onboarding.termsAgree')}
            {!scrolled && ` (${t('onboarding.termsScrollHint')})`}
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <Button
            className="w-full"
            disabled={!agreed || submitting}
            onClick={handleNext}
          >
            {submitting ? t('common.loading') : t('onboarding.next')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
