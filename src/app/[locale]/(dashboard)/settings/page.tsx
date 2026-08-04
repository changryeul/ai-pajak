'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_KEYS: ('password' | 'twoFactor' | 'recentLogin')[] = [
  'password', 'twoFactor', 'recentLogin',
];

// useSearchParams (?mfa=required) needs a Suspense boundary for prerender.
export default function SecurityPage() {
  return (
    <Suspense>
      <SecurityPageInner />
    </Suspense>
  );
}

function SecurityPageInner() {
  const t = useTranslations('securityPage');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  // Operator MFA enforcement funnel — operator/admin layouts redirect
  // un-enrolled operator-tier staff to /settings?mfa=required.
  const mfaRequired = searchParams.get('mfa') === 'required';

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangedDays, setPasswordChangedDays] = useState<number | null>(null);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const [reviewCount, setReviewCount] = useState(0);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setMfaEnabled(!!json.data.enabled);
        setMfaFactorId(json.data.factorId ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchLoginHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        const failures = (json.data.loginHistory || []).filter(
          (e: { action: string }) => e.action === 'LOGIN_FAILURE'
        );
        setReviewCount(failures.length);
        const lastChange = json.data.lastPasswordChange;
        if (lastChange) {
          const days = Math.floor((Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24));
          setPasswordChangedDays(days);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMfaStatus(); fetchLoginHistory(); }, [fetchMfaStatus, fetchLoginHistory]);

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      showMessage('error', t('errors.allRequired'));
      return;
    }
    if (passwords.new !== passwords.confirm) {
      showMessage('error', t('errors.mismatch'));
      return;
    }
    if (passwords.new.length < 8) {
      showMessage('error', t('errors.tooShort'));
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
          confirmPassword: passwords.confirm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('success', t('toasts.passwordChanged'));
        setPasswords({ current: '', new: '', confirm: '' });
        fetchLoginHistory();
      } else {
        showMessage('error', data.error || t('errors.generic'));
      }
    } catch {
      showMessage('error', t('errors.generic'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEnroll2FA = async () => {
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll' }),
      });
      const json = await res.json();
      if (json.success) {
        setMfaSetup({ factorId: json.data.factorId, qrCode: json.data.qrCode, secret: json.data.secret });
      } else {
        showMessage('error', json.error || t('errors.generic'));
      }
    } catch {
      showMessage('error', t('errors.generic'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!mfaSetup || mfaCode.length !== 6) return;
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', factorId: mfaSetup.factorId, code: mfaCode }),
      });
      const json = await res.json();
      if (json.success) {
        showMessage('success', t('toasts.twoFactorEnabled'));
        setMfaSetup(null);
        setMfaCode('');
        fetchMfaStatus();
      } else {
        showMessage('error', json.error || t('errors.generic'));
      }
    } catch {
      showMessage('error', t('errors.generic'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unenroll', factorId: mfaFactorId }),
      });
      const json = await res.json();
      if (json.success) {
        showMessage('success', t('toasts.twoFactorDisabled'));
        fetchMfaStatus();
      } else {
        showMessage('error', json.error || t('errors.generic'));
      }
    } catch {
      showMessage('error', t('errors.generic'));
    } finally {
      setMfaLoading(false);
    }
  };

  const passwordValue = passwordChangedDays === null
    ? t('statusCards.password.never')
    : t('statusCards.password.daysAgo', { days: passwordChangedDays });

  const reviewValue = reviewCount === 0
    ? t('statusCards.recentLogin.none')
    : t('statusCards.recentLogin.count', { count: reviewCount });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {message && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border',
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
        )}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Operator MFA enforcement banner */}
      {mfaRequired && !mfaEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 mb-6">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">{t('mfaRequiredBanner.title')}</p>
            <p className="text-sm text-amber-800 mt-0.5">{t('mfaRequiredBanner.desc')}</p>
          </div>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('pageTitle')}</h1>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {t('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {t(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">{t('statusCards.password.title')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('statusCards.password.sub')}</p>
          <p className="text-base font-medium text-slate-700 mt-3">{passwordValue}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">{t('statusCards.twoFactor.title')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('statusCards.twoFactor.sub')}</p>
          <p className="text-base font-medium text-slate-700 mt-3">
            {mfaEnabled ? t('statusCards.twoFactor.on') : t('statusCards.twoFactor.off')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">{t('statusCards.recentLogin.title')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('statusCards.recentLogin.sub')}</p>
          <p className="text-base font-medium text-slate-700 mt-3">{reviewValue}</p>
        </div>
      </div>

      {/* Change password card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <p className="text-base font-bold text-slate-900">{t('changePassword.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('changePassword.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('changePassword.current')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('changePassword.new')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('changePassword.confirm')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">{t('changePassword.helper')}</p>
          <Button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="bg-slate-700 text-white hover:bg-slate-800"
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('changePassword.saving')}
              </>
            ) : (
              t('changePassword.cta')
            )}
          </Button>
        </div>
      </div>

      {/* 2FA card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-900">{t('twoFactor.title')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('twoFactor.subtitle')}</p>
          </div>
          <span className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0',
            mfaEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          )}>
            {mfaEnabled ? t('twoFactor.badgeOn') : t('twoFactor.badgeOff')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* Authenticator app */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">{t('twoFactor.appTitle')}</p>
            <p className="text-xs text-slate-500 mt-1">{t('twoFactor.appDesc')}</p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnroll2FA}
                disabled={mfaLoading || !!mfaSetup}
              >
                {mfaLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {mfaEnabled ? t('twoFactor.appCtaActive') : t('twoFactor.appCta')}
              </Button>
            </div>
          </div>

          {/* Backup codes */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">{t('twoFactor.backupTitle')}</p>
            <p className="text-xs text-slate-500 mt-1">{t('twoFactor.backupDesc')}</p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info(t('twoFactor.backupNotAvailable'))}
              >
                {t('twoFactor.backupCta')}
              </Button>
            </div>
          </div>
        </div>

        {/* Enrollment QR + verification */}
        {mfaSetup && (
          <div className="mt-5 rounded-lg border border-slate-200 p-5 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">{t('twoFactor.verifyTitle')}</p>
            <p className="text-xs text-slate-500 mt-1">{t('twoFactor.verifyDesc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data-URI QR, next/image 부적합 */}
              <img src={mfaSetup.qrCode} alt="2FA QR" className="w-48 h-48 bg-white rounded-md border" />
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-500">
                  {t('twoFactor.manualKey')}: <code className="bg-white border px-1.5 py-0.5 rounded text-[11px]">{mfaSetup.secret}</code>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('twoFactor.verifyPlaceholder')}
                    maxLength={6}
                    className="font-mono text-center tracking-widest max-w-[180px]"
                  />
                  <Button onClick={handleVerify2FA} disabled={mfaLoading || mfaCode.length !== 6}>
                    {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {t('twoFactor.verifyCta')}
                  </Button>
                  <Button variant="ghost" onClick={() => { setMfaSetup(null); setMfaCode(''); }}>
                    {t('twoFactor.cancelCta')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mfaEnabled && (
          <div className="flex justify-end mt-5">
            <Button variant="outline" size="sm" onClick={handleDisable2FA} disabled={mfaLoading}>
              {mfaLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {t('twoFactor.disableCta')}
            </Button>
          </div>
        )}
      </div>

      {/* Recent login activity */}
      <RecentLoginActivity />
    </div>
  );
}

interface LoginRow {
  id: string;
  time: string;
  device: string;
  location: string;
  ip: string;
  status: 'ok' | 'attention';
}

const SAMPLE_LOGINS: LoginRow[] = [
  { id: 'l1', time: '2026-04-30 14:22', device: 'MacBook Pro · Chrome', location: 'Jakarta, Indonesia', ip: '103.xxx.xxx.21', status: 'ok' },
  { id: 'l2', time: '2026-04-29 09:18', device: 'iPhone · Safari', location: 'Jakarta, Indonesia', ip: '114.xxx.xxx.88', status: 'ok' },
  { id: 'l3', time: '2026-04-25 22:41', device: 'Windows PC · Edge', location: 'Singapore', ip: '18.xxx.xxx.43', status: 'attention' },
];

function RecentLoginActivity() {
  const t = useTranslations('securityPage.recentLogin');
  const tc = useTranslations('common');
  const rows = SAMPLE_LOGINS;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
      <p className="text-base font-bold text-slate-900">{t('title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">{t('columns.time')}</th>
              <th className="px-4 py-3">{t('columns.device')}</th>
              <th className="px-4 py-3">{t('columns.location')}</th>
              <th className="px-4 py-3">{t('columns.ip')}</th>
              <th className="px-4 py-3">{t('columns.status')}</th>
              <th className="px-4 py-3 w-32">{t('columns.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">{t('empty')}</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="text-sm">
                <td className="px-4 py-4 font-medium text-slate-900 tabular-nums">{row.time}</td>
                <td className="px-4 py-4 text-slate-700">{row.device}</td>
                <td className="px-4 py-4 text-slate-700">{row.location}</td>
                <td className="px-4 py-4 text-slate-500 tabular-nums">{row.ip}</td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                    row.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  )}>
                    {t(`status.${row.status}`)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => toast.info(row.status === 'ok' ? tc('sessionEnded') : tc('flagged'))}
                  >
                    {row.status === 'ok' ? t('cta.endSession') : t('cta.notMe')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
