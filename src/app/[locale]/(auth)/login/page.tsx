'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Shield, Clock, FileCheck, Zap } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex-col justify-center px-12 xl:px-20">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-2xl font-bold">AI</span>
            </div>
            <span className="text-3xl font-bold">PAJAK</span>
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
                <div key={feature.titleKey} className="flex items-start gap-4">
                  <div className="rounded-lg bg-white/10 p-2 mt-0.5">
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
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gray-50 p-4 sm:p-8">
        <Card className="w-full max-w-md">
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
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />

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
              <Button type="submit" className="w-full" disabled={isLoading}>
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
      </div>
    </div>
  );
}
