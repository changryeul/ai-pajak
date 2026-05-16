'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${locale}/reset-password`,
      });

      if (resetError) {
        setError(t('auth.resetPasswordError'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-green-600 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl">{t('auth.checkEmail')}</CardTitle>
            <CardDescription>{t('auth.resetEmailSent')}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link
              href={`/${locale}/login`}
              className="text-emerald-600 hover:underline font-medium"
            >
              {t('auth.backToLogin')}
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">AI</span>
          </div>
          <CardTitle className="text-2xl">{t('auth.forgotPasswordTitle')}</CardTitle>
          <CardDescription>{t('auth.forgotPasswordDescription')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
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
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Loading...' : t('auth.sendResetLink')}
            </Button>

            <Link
              href={`/${locale}/login`}
              className="text-center text-sm text-emerald-600 hover:underline"
            >
              {t('auth.backToLogin')}
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
