'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input } from '@/components/ui';
import { CheckCircle, Loader2, AlertTriangle, Shield } from 'lucide-react';

function AcceptInvitationContent() {
  const t = useTranslations('inviteAccept');
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{ email: string; role: string; team: string | null; fullName: string | null } | null>(null);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const roleLabel = (role: string | undefined): string => {
    if (!role) return '';
    try {
      return t(`roleLabel.${role}`);
    } catch {
      return role;
    }
  };

  useEffect(() => {
    if (!token) {
      setError(t('errors.noToken'));
      setLoading(false);
      return;
    }
    fetch(`/api/auth/accept-invitation?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setInvitation(data.data);
          setFullName(data.data.fullName || '');
        } else {
          // API may return `errorKey` (i18n key inside inviteAccept) or legacy `error`.
          const key = typeof data.errorKey === 'string' ? data.errorKey : null;
          setError(key ? t(key) : (data.error || t('errors.invalidInvite')));
        }
      })
      .catch(() => setError(t('errors.checkFailed')))
      .finally(() => setLoading(false));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, fullName }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        const key = typeof data.errorKey === 'string' ? data.errorKey : null;
        setError(key ? t(key) : (data.error || t('errors.signupFailed')));
      }
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-lg text-red-700">{t('errorCard.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} variant="outline" className="w-full">
              {t('errorCard.loginBtn')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-lg text-green-700">{t('successCard.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center">
              {t('successCard.welcome')}
              <br />
              {t('successCard.ctaHint')}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} className="w-full">
              {t('successCard.loginBtn')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl">{t('form.title')}</CardTitle>
          <div className="mt-3 text-xs bg-blue-50 rounded-lg p-3 text-left">
            <p className="text-gray-600">{t('form.emailLabel')}</p>
            <p className="font-medium text-gray-900">{invitation?.email}</p>
            <p className="text-gray-600 mt-2">{t('form.roleLabel')}</p>
            <p className="font-medium text-blue-700">{roleLabel(invitation?.role)}</p>
            {invitation?.team && (
              <>
                <p className="text-gray-600 mt-2">{t('form.teamLabel')}</p>
                <p className="font-medium text-gray-900">{invitation.team}</p>
              </>
            )}
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>}
            <div>
              <label className="text-xs font-medium text-gray-700">{t('form.nameLabel')}</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder={t('form.namePlaceholder')} required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">{t('form.passwordLabel')}</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t('form.passwordPlaceholder')} required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">{t('form.confirmLabel')}</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('form.confirmPlaceholder')} required />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {t('form.submitBtn')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
