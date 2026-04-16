'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Shield, Clock, FileCheck, Zap } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { TrustBadges } from '@/components/trust/TrustBadges';

export default function LoginPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [identifier, setIdentifier] = useState(''); // email or NPWP
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex-col justify-center px-12 xl:px-20 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-blue-400/10 rounded-full" />

        <div className="max-w-lg relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="AI Pajak" className="h-12 brightness-0 invert" />
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            {t('login.heroTitle')}
          </h1>
          <p className="text-lg text-blue-100 mb-10">
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
                    <p className="text-sm text-blue-200">{t(feature.descKey)}</p>
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
            <div className="lg:hidden mx-auto mb-4 h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">AI</span>
            </div>
            <CardTitle className="text-2xl">{t('common.appName')}</CardTitle>
            <CardDescription>{t('auth.login')}</CardDescription>
          </CardHeader>

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
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25" disabled={isLoading}>
                {isLoading ? t('common.loading') : t('auth.login')}
              </Button>

              <p className="text-center text-sm text-gray-600">
                {t('login.noAccount')}{' '}
                <Link
                  href={`/${locale}/register`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {t('auth.register')}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Trust badges below form */}
        <div className="mt-6">
          <TrustBadges />
        </div>
      </div>
    </div>
  );
}
