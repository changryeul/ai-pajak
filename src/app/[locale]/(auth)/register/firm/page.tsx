'use client';

/**
 * Tax-firm (세무법인) signup — TAX_PARTNER account type.
 *
 * External tax-consultant firms register here to bring their own clients
 * onto AI Pajak. Mirrors the INDIVIDUAL 2-step signup:
 *
 *   Step 1: firm basics (name, license number optional, rep name, email, phone)
 *   Step 2: password
 *
 * Account creation hits /api/auth/signup with accountType='TAX_PARTNER'.
 * The server-side handler also provisions a tax_partner row + EXTERNAL
 * consultant_role so the firm can immediately see their customers list.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RegisterTypeTabs } from '@/components/auth/RegisterTypeTabs';

interface Step1Data {
  firmName: string;
  firmRegistrationNumber: string;
  fullName: string;
  email: string;
  phone: string;
  adminEmail: string;
}

export default function FirmRegisterPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [step, setStep] = useState<1 | 2>(1);
  const [basics, setBasics] = useState<Step1Data>({
    firmName: '',
    firmRegistrationNumber: '',
    fullName: '',
    email: '',
    phone: '',
    adminEmail: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  function validateStep1(): string | null {
    if (!basics.firmName.trim()) return t('firmSignupPage.errMissingFirm');
    if (!basics.fullName.trim()) return t('auth.errMissingName');
    if (!basics.email.trim() || !basics.email.includes('@')) return t('auth.errInvalidEmail');
    if (!basics.phone.trim()) return t('auth.errMissingPhone');
    const adminEmail = basics.adminEmail.trim();
    if (adminEmail && !adminEmail.includes('@')) return t('auth.errInvalidEmail');
    if (adminEmail && adminEmail === basics.email.trim())
      return t('firmSignupPage.errAdminEmailSameAsRep');
    return null;
  }

  function step1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validateStep1();
    if (err) { setError(err); return; }
    setStep(2);
  }

  async function step2Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(t('errors.passwordTooShort')); return; }
    if (password !== confirmPassword) { setError(t('errors.passwordMismatch')); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: basics.email.trim(),
          password,
          fullName: basics.fullName.trim(),
          phone: basics.phone.trim() || undefined,
          accountType: 'TAX_PARTNER',
          firmName: basics.firmName.trim(),
          firmRegistrationNumber: basics.firmRegistrationNumber.trim() || undefined,
          adminEmail: basics.adminEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const code = data.errorCode as string | undefined;
        const localized = code ? t(`errors.signup.${code}` as 'errors.signup.UNKNOWN') : null;
        setError(localized || data.error || t('errors.serverError'));
        return;
      }
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: basics.email.trim(),
        password,
      });
      if (signInError) {
        // 2026-06-28: signIn silent 실패 시 사용자에게 명시.
        setError(t('errors.autoSigninFailedRetry'));
        setTimeout(() => router.push(`/${locale}/login`), 1500);
        return;
      }
      // 2026-06-28: 컨설턴트 첫 진입은 ERP 대시보드 (고객/세션 작업이 핵심).
      // ?welcome=1 시그널로 첫 진입 안내 가능.
      router.push(`/${locale}/consultant-erp/dashboard?welcome=1`);
      router.refresh();
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-fuchsia-100 p-4 py-10">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6 md:p-8">
            {step === 1 && <RegisterTypeTabs active="firm" />}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-sm">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    {step === 1 ? t('firmSignupPage.title') : t('auth.setPassword')}
                  </h1>
                  <p className="text-xs text-gray-500">{t('firmSignupPage.subtitle')}</p>
                </div>
              </div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {t('auth.back')}
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={step1Submit} className="space-y-4">
                <Input
                  name="firmName"
                  type="text"
                  placeholder={t('firmSignupPage.firmNamePlaceholder')}
                  value={basics.firmName}
                  onChange={(e) => setBasics({ ...basics, firmName: e.target.value })}
                />
                <Input
                  name="firmRegistrationNumber"
                  type="text"
                  placeholder={t('firmSignupPage.licensePlaceholder')}
                  value={basics.firmRegistrationNumber}
                  onChange={(e) => setBasics({ ...basics, firmRegistrationNumber: e.target.value })}
                />
                <Input
                  name="fullName"
                  type="text"
                  placeholder={t('firmSignupPage.repNamePlaceholder')}
                  value={basics.fullName}
                  onChange={(e) => setBasics({ ...basics, fullName: e.target.value })}
                />
                <Input
                  name="email"
                  type="email"
                  placeholder={t('auth.email')}
                  value={basics.email}
                  onChange={(e) => setBasics({ ...basics, email: e.target.value })}
                />
                <Input
                  name="phone"
                  type="tel"
                  placeholder={t('auth.phone')}
                  value={basics.phone}
                  onChange={(e) => setBasics({ ...basics, phone: e.target.value })}
                />
                <div>
                  <Input
                    name="adminEmail"
                    type="email"
                    placeholder={t('firmSignupPage.adminEmailPlaceholder')}
                    value={basics.adminEmail}
                    onChange={(e) => setBasics({ ...basics, adminEmail: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                    {t('firmSignupPage.adminEmailHint')}
                  </p>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  * {t('firmSignupPage.note')}
                </p>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0 shadow-sm"
                >
                  {t('auth.next')}
                </Button>

                <p className="text-center text-sm text-gray-600 pt-2">
                  {t('auth.alreadyHaveAccount')}{' '}
                  <Link href={`/${locale}/login`} className="text-purple-600 hover:underline font-medium">
                    {t('auth.login')}
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={step2Submit} className="space-y-4">
                <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 text-xs text-purple-800">
                  <div className="font-semibold truncate">{basics.firmName}</div>
                  <div className="text-purple-700/80 truncate">{basics.fullName} · {basics.email}</div>
                </div>

                <Input
                  name="password"
                  type="password"
                  placeholder={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  name="confirmPassword"
                  type="password"
                  placeholder={t('auth.confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500">{t('auth.passwordHint8')}</p>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white border-0 shadow-sm"
                  disabled={isLoading || password.length < 8 || password !== confirmPassword}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common.submitting')}</>
                  ) : (
                    t('auth.register')
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
