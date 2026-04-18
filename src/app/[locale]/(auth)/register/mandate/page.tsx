'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature/SignaturePad';
import { PageTitle } from '@/components/layout/PageTitle';

export default function RegisterMandatePage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const signatureRef = useRef<SignaturePadHandle>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const dataUrl = signatureRef.current?.getDataUrl();
    if (!dataUrl) {
      setError(t('onboarding.signatureRequired'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. Upload signature → signature_audit row + optional POA row
      const sigRes = await fetch('/api/customer/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          purpose: 'POA_MANDATE',
          dataUrl,
        }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData.success) {
        setError(sigData.error || t('errors.serverError'));
        return;
      }

      // 2. Advance onboarding_step to 3 (complete)
      const advRes = await fetch('/api/customer/onboarding/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toStep: 3 }),
      });
      const advData = await advRes.json();
      if (!advRes.ok || !advData.success) {
        setError(advData.error || t('errors.serverError'));
        return;
      }

      router.push(`/${locale}/dashboard`);
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <PageTitle title={t('onboarding.mandateTitle')} />
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <OnboardingProgress
            steps={[
              { id: 1, label: t('onboarding.stepRegister') },
              { id: 2, label: t('onboarding.stepTerms') },
              { id: 3, label: t('onboarding.stepMandate') },
            ]}
            currentStep={3}
          />
          <CardTitle>{t('onboarding.mandateTitle')}</CardTitle>
          <CardDescription>{t('onboarding.mandateDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded p-4 text-sm text-gray-700 space-y-2 bg-gray-50">
            <p>{t('onboarding.mandateIntro')}</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>{t('onboarding.mandateScope1')}</li>
              <li>{t('onboarding.mandateScope2')}</li>
              <li>{t('onboarding.mandateScope3')}</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">✍️ {t('onboarding.signatureLabel')}</p>
            <SignaturePad
              ref={signatureRef}
              width={600}
              height={150}
              onChange={setHasSignature}
              clearLabel={t('onboarding.signatureClear')}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            {t('onboarding.mandateAgree')}
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <Button
            className="w-full"
            disabled={!agreed || !hasSignature || submitting}
            onClick={handleSubmit}
          >
            {submitting ? t('common.loading') : t('onboarding.startAppUsage')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
