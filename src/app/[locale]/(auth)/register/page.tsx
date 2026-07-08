'use client';

/**
 * Service Signup — INDIVIDUAL customers.
 *
 * Two screens in one page:
 *   Step 1 (basics): full name, NPWP/NIK toggle + number, email, phone.
 *   Step 2 (password): password + confirm → account creation.
 *
 * Rationale (per user redesign 2026-04-18): the old page led with a
 * 3-card picker (개인/법인/세무 컨설턴트) and demanded password up front.
 * Individual taxpayers are the dominant signup path; the screen now
 * matches that reality. Company signup still lives at /register/company,
 * consultant signup at /register/firm.
 *
 * Identity: we record *either* NPWP (15 digits) *or* NIK (16 digits) on
 * the customer row. Both are acceptable to the DJP for filing 1770SS/S;
 * if only NIK is provided, the system can pair it with an NPWP later
 * (PMK 112/2022 gradually unified NPWP ↔ NIK for individuals).
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, User, Camera, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RegisterTypeTabs } from '@/components/auth/RegisterTypeTabs';

type IdType = 'NPWP' | 'NIK';

interface Step1Data {
  fullName: string;
  idType: IdType;
  idNumber: string;
  email: string;
  phone: string;
}

function formatNpwp(digits: string): string {
  // 15 digits → XX.XXX.XXX.X-XXX.XXX
  const d = digits.replace(/\D/g, '').slice(0, 15);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 9) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}.${d.slice(8)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}.${d.slice(8, 9)}-${d.slice(9)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}.${d.slice(8, 9)}-${d.slice(9, 12)}.${d.slice(12, 15)}`;
}

export default function RegisterPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [step, setStep] = useState<1 | 2>(1);
  const [basics, setBasics] = useState<Step1Data>({
    fullName: '',
    idType: 'NPWP',
    idNumber: '',
    email: '',
    phone: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 2026-06-28: NPWP/NIK 사진 → 이름 + 식별번호 자동 채움.
  // /api/public/npwp-ocr 가 회사 가입에서 쓰는 동일 endpoint (rate-limited).
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const runOcr = async (file: File) => {
    setOcrBusy(true);
    setOcrMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/public/npwp-ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success && (data.data?.npwp || data.data?.nik || data.data?.name)) {
        const picked: IdType = data.data.npwp ? 'NPWP' : 'NIK';
        const digits = (picked === 'NPWP' ? data.data.npwp : data.data.nik) || '';
        setBasics((prev) => ({
          ...prev,
          fullName: prev.fullName || data.data.name || '',
          idType: picked,
          idNumber: String(digits).replace(/\D/g, '').slice(0, picked === 'NPWP' ? 15 : 16),
        }));
        const conf = Math.round((data.data.confidence || 0) * 100);
        setOcrMsg({ type: 'ok', text: t('registerOcr.done', { conf }) });
      } else if (res.status === 429) {
        setOcrMsg({ type: 'err', text: t('registerOcr.tooMany') });
      } else {
        setOcrMsg({ type: 'err', text: t('registerOcr.failed') });
      }
    } catch {
      setOcrMsg({ type: 'err', text: t('registerOcr.failed') });
    } finally {
      setOcrBusy(false);
    }
  };

  function validateStep1(): string | null {
    if (!basics.fullName.trim()) return t('auth.errMissingName');
    if (!basics.email.trim() || !basics.email.includes('@')) return t('auth.errInvalidEmail');
    if (!basics.phone.trim()) return t('auth.errMissingPhone');
    const digits = basics.idNumber.replace(/\D/g, '');
    if (basics.idType === 'NPWP' && digits.length !== 15) {
      return t('auth.errNpwpDigits', { have: digits.length });
    }
    if (basics.idType === 'NIK' && digits.length !== 16) {
      return t('auth.errNikDigits', { have: digits.length });
    }
    return null;
  }

  function step1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep(2);
  }

  async function step2Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    setIsLoading(true);
    try {
      const digits = basics.idNumber.replace(/\D/g, '');
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: basics.email.trim(),
          password,
          fullName: basics.fullName.trim(),
          phone: basics.phone.trim() || undefined,
          accountType: 'INDIVIDUAL',
          npwp: basics.idType === 'NPWP' ? digits : undefined,
          nik: basics.idType === 'NIK' ? digits : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // errorCode 있으면 locale 메시지 우선, 없으면 서버 error 텍스트 (보통 indonesian).
        const code = data.errorCode as string | undefined;
        const localized = code ? t(`errors.signup.${code}` as 'errors.signup.UNKNOWN') : null;
        setError(localized || data.error || t('errors.serverError'));
        return;
      }
      // Sign in client-side so the session cookie is set before the
      // onboarding routes fire protected-API calls.
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: basics.email.trim(),
        password,
      });
      if (signInError) {
        router.push(`/${locale}/login`);
        return;
      }
      router.push(`/${locale}/register/terms`);
      router.refresh();
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 py-10">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6 md:p-8">
            {/* 2026-06-28: step1 에서만 3-tab picker — 사용자가 회원가입 누르면
                3 종(개인/법인/외부 세무 사무소) 모두 보고 선택할 수 있도록. */}
            {step === 1 && <RegisterTypeTabs active="individual" />}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">
                {step === 1 ? t('auth.serviceSignup') : t('auth.setPassword')}
              </h1>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
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
                {/* NPWP/NIK 사진 자동 채움 */}
                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{t('registerOcr.titleIndividual')}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{t('registerOcr.descIndividual')}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => ocrFileRef.current?.click()}
                          disabled={ocrBusy}
                          className="h-8 text-xs"
                        >
                          {ocrBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
                          {t('registerOcr.upload')}
                        </Button>
                        <input
                          ref={ocrFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void runOcr(f);
                            if (e.target) e.target.value = '';
                          }}
                        />
                        {ocrMsg && (
                          <span className={`text-[11px] font-medium ${ocrMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {ocrMsg.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Input
                  name="fullName"
                  type="text"
                  placeholder={t('auth.fullNameReal')}
                  value={basics.fullName}
                  onChange={(e) => setBasics({ ...basics, fullName: e.target.value })}
                />

                <select
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                  value={basics.idType}
                  onChange={(e) => setBasics({ ...basics, idType: e.target.value as IdType, idNumber: '' })}
                >
                  <option value="NPWP">{t('auth.hasNpwp')}</option>
                  <option value="NIK">{t('auth.noNpwpUseNik')}</option>
                </select>

                <div>
                  <Input
                    name="idNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder={
                      basics.idType === 'NPWP'
                        ? '00.000.000.0-000.000'
                        : t('auth.nikPlaceholder')
                    }
                    value={
                      basics.idType === 'NPWP'
                        ? formatNpwp(basics.idNumber)
                        : basics.idNumber.replace(/\D/g, '').slice(0, 16)
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const max = basics.idType === 'NPWP' ? 15 : 16;
                      setBasics({ ...basics, idNumber: digits.slice(0, max) });
                    }}
                  />
                  <div className="mt-1 text-[11px] text-gray-500 flex justify-between">
                    <span>
                      {basics.idType === 'NPWP'
                        ? t('auth.npwpDigitsRequired')
                        : t('auth.nikDigitsRequired')}
                    </span>
                    <span className={basics.idNumber.length === (basics.idType === 'NPWP' ? 15 : 16) ? 'text-emerald-600 font-medium' : ''}>
                      {basics.idNumber.length} / {basics.idType === 'NPWP' ? 15 : 16}
                    </span>
                  </div>
                </div>

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

                <p className="text-xs text-gray-500 leading-relaxed">
                  * {t('auth.signupIdentityNote')}
                </p>

                <Button type="submit" className="w-full h-11">
                  {t('auth.next')}
                </Button>

                <p className="text-center text-sm text-gray-600 pt-2">
                  {t('auth.alreadyHaveAccount')}{' '}
                  <Link href={`/${locale}/login`} className="text-emerald-600 hover:underline font-medium">
                    {t('auth.login')}
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={step2Submit} className="space-y-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate">{basics.fullName} · {basics.email}</span>
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
                  className="w-full h-11"
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
