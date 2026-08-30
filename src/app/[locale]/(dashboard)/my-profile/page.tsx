'use client';

/**
 * 내정보 — customer-facing personal profile editor.
 *
 * Two-card layout (mockup spec):
 *   Left  "기본정보": 이름 / NPWP / 주소 / 가족 수 (derived from ptkp_status)
 *   Right "연락·계정정보":
 *     Contact: 이메일 / 전화번호 / 회사명 (employer)
 *     Tax account: Coretax ID / Coretax Password / DJP Password / Passphrase / EFIN
 *
 * Completeness bar at the top counts required + optional fields; required
 * fields that are missing get a red outline so the user can spot them.
 *
 * INDIVIDUAL customers only — COMPANY goes to /company-profile.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { RequiredFieldsBanner } from '@/components/common/RequiredFieldsBanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ArrowRight, Calculator, CheckCircle, Loader2, Save, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NATIONALITIES, nationalityLabel, type Locale as NLocale } from '@/config/nationalities';

interface TaxPreview {
  bruto: number;
  ptkpStatus: string;
  ptkpAmount: number;
  pkp: number;
  estimatedTax: number;
  sourceYear: number | null;
  hasDraft: boolean;
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

interface ProfileForm {
  full_name: string;
  npwp: string;
  address: string;
  ptkp_status: string;
  email: string;
  phone: string;
  employer_name: string;
  coretax_id: string;
  coretax_password_hint: string;
  djp_password_hint: string;
  djp_passphrase_hint: string;
  efin: string;
  nationality: string; // '' = 내국인, 'KR'/'US'/'JP' = 외국인 국적
}

type MaritalState = 'single' | 'married' | 'joint';

function dependentsFromPtkp(ptkp: string): number {
  const m = ptkp.match(/(\d)$/);
  return m ? Number(m[1]) : 0;
}
function maritalFromPtkp(ptkp: string): MaritalState {
  if (ptkp.startsWith('K/I/')) return 'joint';
  if (ptkp.startsWith('K/')) return 'married';
  return 'single';
}
function buildPtkp(marital: MaritalState, dependents: number): string {
  const d = Math.max(0, Math.min(3, dependents));
  const prefix = marital === 'joint' ? 'K/I/' : marital === 'married' ? 'K/' : 'TK/';
  return `${prefix}${d}`;
}

export default function MyProfilePage() {
  const t = useTranslations('myProfileV2');
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  // 2026-06-28: register/mandate 가 ?welcome=1 로 보냄 → 한 줄 환영 + 가이드.
  const searchParams = useSearchParams();
  const isWelcome = searchParams?.get('welcome') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<TaxPreview | null>(null);
  const { missing: reqMissing } = useRequiredFields('my_profile');
  // keynote v2 slide-21: "이미 신고시 입력한 정보가 있을 경우 여기서 보여주기만 하면 됨"
  // — load 시점에 nationality가 이미 저장되어 있으면 해당 세션에서 read-only 처리.
  const [nationalityLocked, setNationalityLocked] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    npwp: '',
    address: '',
    ptkp_status: '',
    email: '',
    phone: '',
    employer_name: '',
    coretax_id: '',
    coretax_password_hint: '',
    djp_password_hint: '',
    djp_passphrase_hint: '',
    efin: '',
    nationality: '',
  });

  // Guard: only INDIVIDUAL customers.
  useEffect(() => {
    if (sessionLoading || !session) return;
    const isCustomer = hasRole(session, UserRole.CUSTOMER);
    if (!isCustomer || session.customerType !== 'INDIVIDUAL') {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/profile', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('loadError'));
      const c = data.data.customer || {};
      setForm({
        full_name: c.full_name || '',
        npwp: c.npwp || '',
        address: c.address || '',
        ptkp_status: c.ptkp_status || '',
        email: c.email || '',
        phone: c.phone || '',
        employer_name: c.employer_name || '',
        coretax_id: c.coretax_id || '',
        coretax_password_hint: c.coretax_password_hint || '',
        djp_password_hint: c.djp_password_hint || '',
        djp_passphrase_hint: c.djp_passphrase_hint || '',
        efin: c.efin || '',
        nationality: c.nationality || '',
      });
      // 저장된 국적이 이미 있으면 /my-profile에서는 표시 전용 (SPT intake에서만 편집)
      setNationalityLocked(!!c.nationality);
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : t('serverError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/tax-preview', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.success) setPreview(data.data as TaxPreview);
      } catch {
        // preview is best-effort; silent fail is OK
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Required vs optional split drives the red outline and completeness bar.
  const requiredFields: (keyof ProfileForm)[] = ['full_name', 'npwp', 'email', 'phone'];
  const optionalFields: (keyof ProfileForm)[] = [
    'address', 'ptkp_status', 'employer_name',
    'coretax_id', 'coretax_password_hint',
    'djp_password_hint', 'djp_passphrase_hint', 'efin',
  ];

  const { completeness, hasMissingRequired } = useMemo(() => {
    const all = [...requiredFields, ...optionalFields];
    const filled = all.filter((k) => String(form[k] || '').trim().length > 0).length;
    const missingRequired = requiredFields.some((k) => !String(form[k] || '').trim());
    return {
      completeness: Math.round((filled / all.length) * 100),
      hasMissingRequired: missingRequired,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Required missing → 진한 빨강, optional missing → 옅은 빨강
  // (keynote: 아직 입력하지 않은 정보의 빈칸은 빨간색으로 테두리)
  const requiredClass = (key: keyof ProfileForm) =>
    !String(form[key] || '').trim() ? 'border-red-400 focus:border-red-500' : '';
  const optionalClass = (key: keyof ProfileForm) =>
    !String(form[key] || '').trim() ? 'border-red-200 focus:border-red-300' : '';

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        employer_name: form.employer_name.trim() || null,
        coretax_id: form.coretax_id.trim() || null,
        coretax_password_hint: form.coretax_password_hint.trim() || null,
        djp_password_hint: form.djp_password_hint.trim() || null,
        djp_passphrase_hint: form.djp_passphrase_hint.trim() || null,
        efin: form.efin.trim() || null,
        nationality: form.nationality || null,
      };
      const digits = form.npwp.replace(/\D/g, '');
      if (digits.length === 15) payload.npwp = digits;
      if (form.ptkp_status) payload.ptkp_status = form.ptkp_status;

      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('saveError'));
      showMsg('success', t('saveSuccess'));
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const dependents = dependentsFromPtkp(form.ptkp_status);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <RequiredFieldsBanner missing={reqMissing({ full_name: form.full_name, npwp: form.npwp, address: form.address, ptkp_status: form.ptkp_status })} />
      {/* 2026-06-28: register/mandate 직후 안내 배너 */}
      {isWelcome && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">{t('welcomeTitle')}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('welcomeBody')}</p>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600" />
          {t('title')}
        </h1>
        <div className="mt-4">
          <p className="text-xs text-gray-500">{t('completenessLabel')}</p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 font-medium shrink-0">
              {t('completenessValue', { pct: completeness })}
            </span>
          </div>
          {hasMissingRequired && (
            <p className="mt-2 text-xs text-red-600">{t('missingRequired')}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">{t('autoParsedHint')}</p>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Left — Basic Info */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <p className="font-semibold text-gray-900">{t('basicInfo')}</p>
            <Input
              placeholder={t('fieldName')}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={cn(requiredClass('full_name'))}
            />
            <Input
              placeholder={t('fieldNpwp')}
              value={form.npwp}
              onChange={(e) => setForm({ ...form, npwp: e.target.value.replace(/\D/g, '').slice(0, 15) })}
              className={cn('font-mono', requiredClass('npwp'))}
            />
            <Input
              placeholder={t('fieldAddress')}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={cn(optionalClass('address'))}
            />
            {/* Marital + dependents → computed PTKP code */}
            <div className={cn(
              'rounded-lg border bg-gray-50/40 p-3 space-y-3',
              !form.ptkp_status ? 'border-red-200' : 'border-gray-200',
            )}>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">{t('familyMaritalLabel')}</p>
                <div className="flex gap-2">
                  {(['single', 'married', 'joint'] as const).map((m) => {
                    const selected = maritalFromPtkp(form.ptkp_status) === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, ptkp_status: buildPtkp(m, dependents) })
                        }
                        className={cn(
                          'flex-1 h-9 rounded-md border text-xs font-medium transition-colors',
                          selected
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
                        )}
                      >
                        {t(m === 'single' ? 'familySingle' : m === 'married' ? 'familyMarried' : 'familyJoint')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">{t('fieldFamilyCount')}</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((n) => {
                      const selected = dependents === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setForm({ ...form, ptkp_status: buildPtkp(maritalFromPtkp(form.ptkp_status), n) })
                          }
                          className={cn(
                            'w-10 h-10 rounded-md border text-sm font-semibold transition-colors',
                            selected
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs text-gray-500">{t('familyDepUnit')}</span>
                </div>
              </div>

              {form.ptkp_status && (
                <p className="text-[11px] text-gray-500">
                  {t('familyPtkpHint')}: <span className="font-mono font-semibold text-gray-700">{form.ptkp_status}</span>
                </p>
              )}

              {/* keynote v2 slide-21: 외국인 체크박스 + 국적
                  이미 저장된 값이 있으면 read-only 표시 (신고 시 입력한 정보는 여기서 보여주기만) */}
              <div className="pt-2 border-t border-gray-100">
                {nationalityLocked ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{t('foreignToggle')}:</span>
                    {form.nationality ? (
                      <span className="font-semibold text-gray-800">
                        {nationalityLabel(form.nationality, locale as NLocale)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    <span className="text-[11px] text-gray-400 ml-1">
                      {t('nationalityLockedHint')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-gray-800"
                        checked={!!form.nationality}
                        onChange={(e) =>
                          setForm({ ...form, nationality: e.target.checked ? 'KR' : '' })
                        }
                      />
                      {t('foreignToggle')}
                    </label>
                    <span className={form.nationality ? 'text-gray-500' : 'text-gray-300'}>
                      (
                      <select
                        className="h-8 rounded border border-input bg-white px-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                        value={form.nationality || ''}
                        disabled={!form.nationality}
                        onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                      >
                        {NATIONALITIES.map((n) => (
                          <option key={n.code} value={n.code}>
                            {n.labels[(locale as NLocale)] || n.labels.en}
                          </option>
                        ))}
                      </select>
                      )
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right — Contact + Tax account */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="font-semibold text-gray-900 mb-3">{t('contactInfo')}</p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder={t('fieldEmail')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={cn(requiredClass('email'))}
                />
                <Input
                  placeholder={t('fieldPhone')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={cn(requiredClass('phone'))}
                />
                <Input
                  placeholder={t('fieldCompany')}
                  value={form.employer_name}
                  onChange={(e) => setForm({ ...form, employer_name: e.target.value })}
                  className={cn(optionalClass('employer_name'))}
                />
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="font-semibold text-gray-900 mb-3">{t('taxAccountInfo')}</p>
              <div className="space-y-3">
                <Input
                  placeholder={t('fieldCoretaxId')}
                  value={form.coretax_id}
                  onChange={(e) => setForm({ ...form, coretax_id: e.target.value })}
                  className={cn(optionalClass('coretax_id'))}
                />
                <Input
                  type="password"
                  placeholder={t('fieldCoretaxPassword')}
                  value={form.coretax_password_hint}
                  onChange={(e) => setForm({ ...form, coretax_password_hint: e.target.value })}
                  className={cn(optionalClass('coretax_password_hint'))}
                />
                <Input
                  type="password"
                  placeholder={t('fieldDjpPassword')}
                  value={form.djp_password_hint}
                  onChange={(e) => setForm({ ...form, djp_password_hint: e.target.value })}
                  className={cn(optionalClass('djp_password_hint'))}
                />
                <Input
                  type="password"
                  placeholder={t('fieldPassphrase')}
                  value={form.djp_passphrase_hint}
                  onChange={(e) => setForm({ ...form, djp_passphrase_hint: e.target.value })}
                  className={cn(optionalClass('djp_passphrase_hint'))}
                />
                <Input
                  placeholder={t('fieldEfin')}
                  value={form.efin}
                  onChange={(e) => setForm({ ...form, efin: e.target.value })}
                  className={cn(optionalClass('efin'))}
                />
              </div>
            </div>

            <Button
              className="w-full h-11 bg-gray-800 hover:bg-gray-900 text-white"
              disabled={saving}
              onClick={save}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {t('saveCta')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 세액 계산 미리보기 (A1 기반) — keynote slide-16 */}
      <Card className="mt-5 border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-blue-600" />
            <p className="font-semibold text-gray-900">{t('previewTitle')}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('previewBruto')}</span>
              <span className="font-mono text-gray-900">{formatRp(preview?.bruto ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">
                {t('previewPtkp')}
                {preview?.ptkpStatus && (
                  <span className="ml-1 text-[11px] text-gray-400">({preview.ptkpStatus})</span>
                )}
              </span>
              <span className="font-mono text-gray-900">{formatRp(preview?.ptkpAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('previewPkp')}</span>
              <span className="font-mono text-gray-900">{formatRp(preview?.pkp ?? 0)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t">
              <span className="font-semibold text-blue-700">{t('previewEstimatedTax')}</span>
              <span className="font-mono font-bold text-blue-700">
                {formatRp(preview?.estimatedTax ?? 0)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-500">{t('previewHint')}</p>
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 mt-4 bg-gray-900 hover:bg-black text-white"
        onClick={() => router.push(`/${locale}/tax/billing`)}
      >
        {t('goToBillingCta')}
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
