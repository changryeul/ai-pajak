'use client';

/**
 * InlineProfileAndPreview — embedded profile editor + tax-preview card
 * shown inside the SPT intake flow (keynote slide-8/9).
 *
 * Scope is intentionally narrower than /my-profile:
 *   - KK 데이터 연동 notice (read-only hint)
 *   - 기본정보: name / NIK / No. KK / address / PTKP
 *   - 가족정보 (KK): auto-filled placeholder (read-only)
 *   - 세무 계정: DJP password / Coretax password / Passphrase
 *   - 연락정보: email / phone
 *   - 회사 정보: company / employer name
 *   - Save button
 *   - 세액 계산 미리보기 card (A1 기반) + 결제하러 이동 CTA
 *
 * All edits go through the same /api/customer/profile endpoint used by
 * /my-profile, so this is just an alternate entry point, not a second source
 * of truth.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Calculator, CheckCircle, Loader2, Save } from 'lucide-react';

interface ProfileForm {
  full_name: string;
  npwp: string;
  nik: string;
  kk_number: string;
  address: string;
  ptkp_status: string;
  email: string;
  phone: string;
  company_name: string;
  employer_name: string;
  coretax_password_hint: string;
  djp_password_hint: string;
  djp_passphrase_hint: string;
  nationality: string; // '' = 내국인, 'KR'/'US'/'JP' = 외국인 국적
}

interface Preview {
  bruto: number;
  ptkpAmount: number;
  pkp: number;
  estimatedTax: number;
}

function formatRp(n: number): string {
  return `Rp ${(n || 0).toLocaleString('id-ID')}`;
}

const PTKP_OPTIONS = [
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
  'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
];

export default function InlineProfileAndPreview() {
  const t = useTranslations('myProfileV2');
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale as string;

  const [form, setForm] = useState<ProfileForm>({
    full_name: '', npwp: '', nik: '', kk_number: '', address: '', ptkp_status: 'TK/0',
    email: '', phone: '', company_name: '', employer_name: '',
    coretax_password_hint: '', djp_password_hint: '', djp_passphrase_hint: '',
    nationality: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, prevRes] = await Promise.all([
        fetch('/api/customer/profile', { credentials: 'include' }),
        fetch('/api/customer/tax-preview', { credentials: 'include' }),
      ]);
      const p = pRes.ok ? await pRes.json() : null;
      const prev = prevRes.ok ? await prevRes.json() : null;
      if (p?.data?.customer) {
        const c = p.data.customer;
        setForm({
          full_name: c.full_name || '',
          npwp: c.npwp || '',
          nik: c.nik || '',
          kk_number: c.kk_number || '',
          address: c.address || '',
          ptkp_status: c.ptkp_status || 'TK/0',
          email: c.email || '',
          phone: c.phone || '',
          company_name: c.company_name || '',
          employer_name: c.employer_name || '',
          coretax_password_hint: c.coretax_password_hint || '',
          djp_password_hint: c.djp_password_hint || '',
          djp_passphrase_hint: c.djp_passphrase_hint || '',
          nationality: c.nationality || '',
        });
      }
      if (prev?.success) setPreview(prev.data as Preview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        employer_name: form.employer_name.trim() || null,
        coretax_password_hint: form.coretax_password_hint.trim() || null,
        djp_password_hint: form.djp_password_hint.trim() || null,
        djp_passphrase_hint: form.djp_passphrase_hint.trim() || null,
        ptkp_status: form.ptkp_status,
        nationality: form.nationality || null,
      };
      const digits = form.npwp.replace(/\D/g, '');
      if (digits.length === 15) payload.npwp = digits;
      await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>

      {/* keynote v2: KK 데이터 연동 카드 삭제 — 상단 KK 업로드 자동 파싱으로 통합 */}

      {/* 기본정보 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-gray-900">{t('basicInfo')}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder={t('fieldName')}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              placeholder={t('fieldNik')}
              value={form.nik}
              onChange={(e) => setForm({ ...form, nik: e.target.value })}
              readOnly
              className="bg-gray-50 text-gray-500"
            />
            <Input
              placeholder={t('fieldKkNo')}
              value={form.kk_number}
              onChange={(e) => setForm({ ...form, kk_number: e.target.value })}
              readOnly
              className="bg-gray-50 text-gray-500"
            />
            <Input
              placeholder={t('fieldAddress')}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">PTKP</p>
              <select
                className="h-10 rounded-md border border-input bg-white px-2 text-sm w-32"
                value={form.ptkp_status}
                onChange={(e) => setForm({ ...form, ptkp_status: e.target.value })}
              >
                {PTKP_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {/* keynote v2: 외국인 체크박스 + 국적 필드 (slide-9/12/15) */}
            <div className="flex items-center gap-2">
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
              <span
                className={form.nationality ? 'text-gray-500' : 'text-gray-300'}
              >
                (
                <select
                  className="h-8 rounded border border-input bg-white px-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.nationality || ''}
                  disabled={!form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                >
                  <option value="KR">{t('nationalityKR')}</option>
                  <option value="US">{t('nationalityUS')}</option>
                  <option value="JP">{t('nationalityJP')}</option>
                </select>
                )
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* keynote v2: 가족정보 (KK) 카드 삭제 — KK 업로드 자동 파싱 시
          직접 가족 수/관계 정보를 기본정보 PTKP로 반영한다. */}

      {/* 세무 계정 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-gray-900">{t('taxAccountInfo')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              type="password"
              placeholder="DJP Password"
              value={form.djp_password_hint}
              onChange={(e) => setForm({ ...form, djp_password_hint: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Coretax Password"
              value={form.coretax_password_hint}
              onChange={(e) => setForm({ ...form, coretax_password_hint: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Passphrase"
              value={form.djp_passphrase_hint}
              onChange={(e) => setForm({ ...form, djp_passphrase_hint: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 연락정보 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-gray-900">{t('contactInfo')}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="email"
              placeholder={t('fieldEmail')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              placeholder={t('fieldPhone')}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 회사 정보 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-gray-900">{t('companyInfo')}</p>
          <Input
            placeholder={t('fieldCompany')}
            value={form.employer_name}
            onChange={(e) => setForm({ ...form, employer_name: e.target.value })}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        className="w-full h-11 bg-gray-900 hover:bg-black text-white"
        disabled={saving}
        onClick={save}
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t('saving')}</>
        ) : saved ? (
          <><CheckCircle className="h-4 w-4 mr-1" />{t('saveSuccess')}</>
        ) : (
          <><Save className="h-4 w-4 mr-1" />{t('saveCta')}</>
        )}
      </Button>

      {/* 세액 계산 미리보기 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-5 w-5 text-blue-600" />
            <p className="font-semibold text-gray-900">{t('previewTitle')}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('previewBruto')}</span>
              <span className="font-mono">{formatRp(preview?.bruto ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('previewPtkp')}</span>
              <span className="font-mono">{formatRp(preview?.ptkpAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('previewPkp')}</span>
              <span className="font-mono">{formatRp(preview?.pkp ?? 0)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t">
              <span className="font-semibold text-blue-700">{t('previewEstimatedTax')}</span>
              <span className="font-mono font-bold text-blue-700">
                {formatRp(preview?.estimatedTax ?? 0)}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">{t('previewHint')}</p>
        </CardContent>
      </Card>

      {/* 결제하러 이동 */}
      <Button
        className="w-full h-12 bg-gray-900 hover:bg-black text-white"
        onClick={() => router.push(`/${locale}/tax/billing`)}
      >
        {t('goToBillingCta')}
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
