'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Shield, Clock, FileCheck, Zap, KeyRound } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { TrustBadges } from '@/components/trust/TrustBadges';

// useSearchParams (?mfa=challenge) needs a Suspense boundary for prerender.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [identifier, setIdentifier] = useState(''); // email or NPWP
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // MFA challenge step — shown when the password session is aal1 but the
  // account has a verified TOTP factor (nextLevel aal2). Also entered
  // directly via ?mfa=challenge (operator layout bounces aal1 sessions here).
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // If an already-authenticated aal1 session lands here with ?mfa=challenge,
  // resolve the pending factor and open the challenge step directly.
  useEffect(() => {
    if (searchParams.get('mfa') !== 'challenge') return;
    const supabase = createClient();
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel !== 'aal2' || aal.currentLevel === 'aal2') return;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (totp) setMfaFactorId(totp.id);
    })();
  }, [searchParams]);

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setIsLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError || !challenge) {
        setError(t('auth.mfaInvalidCode'));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) {
        setError(t('auth.mfaInvalidCode'));
        setMfaCode('');
        return;
      }
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaCancel = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setMfaCode('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Check if identifier looks like NPWP (15 digits, possibly with separators)
      const digitsOnly = identifier.replace(/\D/g, '');
      let loginEmail = identifier;

      if (digitsOnly.length === 15 && !identifier.includes('@')) {
        // Resolve NPWP → email via public API
        const resolveRes = await fetch(`/api/auth/resolve-npwp?npwp=${encodeURIComponent(digitsOnly)}`);
        const resolveData = await resolveRes.json();
        if (!resolveRes.ok || !resolveData.success || !resolveData.email) {
          setError(t('auth.npwpNotFound'));
          setIsLoading(false);
          return;
        }
        loginEmail = resolveData.email;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        setError(t('auth.loginError'));
        return;
      }

      // 2FA: if a verified TOTP factor exists, the password session is only
      // aal1 — require the code before entering the app.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified');
        if (totp) {
          setMfaFactorId(totp.id);
          return;
        }
      }

      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Zap, titleKey: 'login.feature1Title', descKey: 'login.feature1Desc' },
    { icon: Shield, titleKey: 'login.feature2Title', descKey: 'login.feature2Desc' },
    { icon: Clock, titleKey: 'login.feature3Title', descKey: 'login.feature3Desc' },
    { icon: FileCheck, titleKey: 'login.feature4Title', descKey: 'login.feature4Desc' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero section (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white flex-col justify-center px-12 xl:px-20 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-emerald-400/10 rounded-full" />

        <div className="max-w-lg relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="AI Pajak" className="h-12 brightness-0 invert" />
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            {t('login.heroTitle')}
          </h1>
          <p className="text-lg text-emerald-100 mb-10">
            {t('login.heroSubtitle')}
          </p>

          <div className="space-y-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.titleKey} className="flex items-start gap-4 group">
                  <div className="rounded-xl bg-white/10 border border-white/10 p-2.5 mt-0.5 group-hover:bg-white/20 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t(feature.titleKey)}</h3>
                    <p className="text-sm text-emerald-200">{t(feature.descKey)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-col w-full lg:w-1/2 items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 sm:p-8">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            {/* Mobile-only logo */}
            <div className="lg:hidden mx-auto mb-4 h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">AI</span>
            </div>
            <CardTitle className="text-2xl">{t('common.appName')}</CardTitle>
            <CardDescription>{mfaFactorId ? t('auth.mfaChallengeTitle') : t('auth.login')}</CardDescription>
          </CardHeader>

          {mfaFactorId ? (
          <form onSubmit={handleMfaVerify}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3">
                <KeyRound className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-800">{t('auth.mfaChallengeDesc')}</p>
              </div>

              <Input
                label={t('auth.mfaCodeLabel')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 shadow-lg shadow-emerald-500/25"
                disabled={isLoading || mfaCode.length !== 6}
              >
                {isLoading ? t('common.loading') : t('auth.mfaVerify')}
              </Button>

              <button
                type="button"
                onClick={handleMfaCancel}
                className="text-center text-sm text-gray-500 hover:text-gray-700 hover:underline"
              >
                {t('auth.mfaUseAnotherAccount')}
              </button>
            </CardFooter>
          </form>
          ) : (
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Input
                label={t('auth.emailOrNpwp')}
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t('auth.emailOrNpwpPlaceholder')}
                required
              />
              <p className="text-[10px] text-gray-400 -mt-2">{t('auth.companyNpwpHint')}</p>

              <Input
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <div className="flex items-center justify-end">
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 shadow-lg shadow-emerald-500/25" disabled={isLoading}>
                {isLoading ? t('common.loading') : t('auth.login')}
              </Button>

              <p className="text-center text-sm text-gray-600">
                {t('login.noAccount')}{' '}
                <Link
                  href={`/${locale}/register`}
                  className="text-emerald-600 hover:underline font-medium"
                >
                  {t('auth.register')}
                </Link>
              </p>
            </CardFooter>
          </form>
          )}
        </Card>

        {/* Trust badges below form */}
        <div className="mt-6">
          <TrustBadges />
        </div>
      </div>
    </div>
  );
}
