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
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, Loader2, Save, User } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

function dependentsFromPtkp(ptkp: string): number {
  const m = ptkp.match(/(\d)$/);
  return m ? Number(m[1]) : 0;
}
function buildPtkpFromDependents(current: string, dependents: number): string {
  const d = Math.max(0, Math.min(3, dependents));
  // Preserve marital prefix (TK/ | K/ | K/I/). Default to TK when blank.
  const prefix = current.startsWith('K/I/') ? 'K/I/'
    : current.startsWith('K/') ? 'K/'
    : 'TK/';
  return `${prefix}${d}`;
}

export default function MyProfilePage() {
  const t = useTranslations('myProfileV2');
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
      });
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : t('serverError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

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

  const requiredClass = (key: keyof ProfileForm) =>
    !String(form[key] || '').trim() ? 'border-red-400 focus:border-red-500' : '';

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
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={3}
              placeholder={t('fieldFamilyCount')}
              value={String(dependents)}
              onChange={(e) => {
                const n = Number(e.target.value);
                setForm({ ...form, ptkp_status: buildPtkpFromDependents(form.ptkp_status, n) });
              }}
            />
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
                />
                <Input
                  type="password"
                  placeholder={t('fieldCoretaxPassword')}
                  value={form.coretax_password_hint}
                  onChange={(e) => setForm({ ...form, coretax_password_hint: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder={t('fieldDjpPassword')}
                  value={form.djp_password_hint}
                  onChange={(e) => setForm({ ...form, djp_password_hint: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder={t('fieldPassphrase')}
                  value={form.djp_passphrase_hint}
                  onChange={(e) => setForm({ ...form, djp_passphrase_hint: e.target.value })}
                />
                <Input
                  placeholder={t('fieldEfin')}
                  value={form.efin}
                  onChange={(e) => setForm({ ...form, efin: e.target.value })}
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
    </div>
  );
}
