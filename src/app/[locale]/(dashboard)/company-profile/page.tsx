'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import { useRequiredFields } from '@/hooks/useRequiredFields';
import { RequiredFieldsBanner } from '@/components/common/RequiredFieldsBanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Building2, Save, Loader2, CheckCircle, AlertTriangle,
  Sparkles, HelpCircle, ChevronDown, ChevronRight,
  Factory, Utensils, Home, Ship, Pickaxe, Globe,
  Briefcase, Users, DollarSign, Shield, Camera,
} from 'lucide-react';
import { ShareholderSection } from '@/components/company/ShareholderSection';

interface CompanyProfile {
  // Basic (already exists from signup)
  company_name: string;
  npwp: string;
  address: string;
  annual_revenue: number | null;
  revenue_year: number | null;
  has_employees: boolean;
  employee_count: number | null;
  is_pkp: boolean;

  // Business type
  business_category: string | null;
  legal_form: string | null;
  established_year: number | null;
  authorized_capital: number | null;
  paid_up_capital: number | null;

  // Ownership
  has_foreign_shareholders: boolean;
  foreign_ownership_pct: number | null;
  parent_company_name: string | null;
  parent_company_country: string | null;

  // UMKM
  is_umkm: boolean;
  umkm_final_tax_start_year: number | null;
  npwp_pph25_elected: boolean;
  npwp_pph25_elected_at: string | null;

  // Construction
  has_construction_sbu: boolean;
  sbu_qualification: string | null;
  sbu_number: string | null;
  sbu_expires_at: string | null;

  // Real estate
  sells_property: boolean;
  property_type: string | null;

  // F&B
  is_restaurant: boolean;
  is_catering: boolean;

  // Income sources
  receives_dividends: boolean;
  receives_interest: boolean;
  receives_royalties: boolean;
  has_franchise: boolean;
  pays_rent: boolean;
  pays_service_fees: boolean;
  has_import_export: boolean;
  has_rental_business: boolean;

  // Special
  is_digital_platform: boolean;
  has_shipping_business: boolean;
  has_mining_license: boolean;

  // Tax regime (AI determined)
  tax_regime: string | null;
  tax_regime_reason: string | null;
  ai_profile_questions: Array<{ question: string; answer?: string }>;
  profile_completeness: number;
}



export default function CompanyProfilePage() {
  const t = useTranslations('companyProfile');

  const LEGAL_FORMS = [
    { value: 'PT', label: 'PT (Perseroan Terbatas)', desc: t('k25_b27f8d') + ' — PPh Final 3' + t('k26_73a335') },
    { value: 'CV', label: 'CV (Commanditaire Vennootschap)', desc: t('k27_91f8c1') + ' — PPh Final 4' + t('k26_73a335') },
    { value: 'UD', label: 'UD (Usaha Dagang)', desc: t('k28_0a0ce6') },
    { value: 'FIRMA', label: 'Firma', desc: t('k29_ded89b') },
    { value: 'KOPERASI', label: 'Koperasi', desc: t('k30_1a70cf') },
    { value: 'YAYASAN', label: 'Yayasan', desc: t('k31_0ae069') },
  ];

  const BUSINESS_CATEGORIES = [
    { value: 'SERVICE', label: t('k0_6f2592'), icon: Briefcase, desc: 'IT, ' + t('k1_677110'), taxNote: 'PPh 23 ' + t('k2_3f6978') },
    { value: 'TRADING', label: t('k3_0b7b8d'), icon: DollarSign, desc: t('k4_9122c8'), taxNote: 'PPh 22 ' + t('k5_a58c1c') },
    { value: 'MANUFACTURING', label: t('k6_df4760'), icon: Factory, desc: t('k7_8ea43b'), taxNote: 'PPh 22 ' + t('k8_aefb63') },
    { value: 'CONSTRUCTION', label: t('k9_16c3b5'), icon: Building2, desc: t('k10_b417c5'), taxNote: 'PPh 4(2) Final — SBU ' + t('k11_f66f54') },
    { value: 'REAL_ESTATE', label: t('k12_73053f'), icon: Home, desc: t('k13_ab53e5'), taxNote: 'PPh 4(2) 2.5%' },
    { value: 'FNB_RESTAURANT', label: t('k14_3643aa'), icon: Utensils, desc: t('k15_abb477'), taxNote: 'PPN ' + t('k16_07263e') },
    { value: 'FNB_CATERING', label: t('k17_53650e'), icon: Utensils, desc: t('k18_ac50b9'), taxNote: 'PPh 23 2%' },
    { value: 'TRANSPORTATION', label: t('k19_06615f'), icon: Ship, desc: t('k20_f4cef4'), taxNote: 'PPh 15 1.2~2.64%' },
    { value: 'MINING', label: t('k21_078b0b'), icon: Pickaxe, desc: t('k22_afc290'), taxNote: 'PPh 22 Mining' },
    { value: 'DIGITAL_PLATFORM', label: t('k23_bd14ba'), icon: Globe, desc: t('k130_digital_desc'), taxNote: 'PPN PMSE' },
    { value: 'OTHER', label: t('k24_7f598d'), icon: Building2, desc: '', taxNote: '' },
  ];
  const { session } = useSession();
  // 2026-06-27: consultant 가 picker 로 다른 고객을 봐도 항상 첫 active assignment
  // 만 로드되던 문제 해결. CUSTOMER role 은 session.customerId 그대로.
  const {
    customerId: effectiveCustomerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId({ companyOnly: true });
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  // 2026-06-27: register/company 가 가입 직후 ?welcome=1 로 보낸다.
  // 이 페이지에 처음 진입한 사용자에게 한 줄 환영 + 가이드.
  const searchParams = useSearchParams();
  const isWelcome = searchParams?.get('welcome') === '1';
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'business', 'income']));
  // 2026-08-30 — MASTER 지정 필수항목 입력유도
  const { missing: reqMissing } = useRequiredFields('company_profile');
  // 2026-06-28: 저장 후 사용자 동선 명확화 — 완성도 < 80% 일 때 토스트만 띄우고
  // 머무는 대신 지속 노출되는 "지금 대시보드로 이동" CTA 배너.
  const [showPostSaveCta, setShowPostSaveCta] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const loadProfile = useCallback(async () => {
    if (!session?.customerId && !session?.consultantId) return;
    // consultant 면 picker 의 customerId 가 도착해야 의미가 있음
    if (isConsultant && !effectiveCustomerId) return;
    setLoading(true);
    try {
      const url = effectiveCustomerId
        ? `/api/company-profile?customerId=${effectiveCustomerId}`
        : '/api/company-profile';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setProfile(data.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [session, isConsultant, effectiveCustomerId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const updateField = (field: string, value: unknown) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value } as CompanyProfile);
  };

  // keynote: 아직 입력하지 않은 정보의 빈칸은 빨간색으로 테두리.
  // required → 진한 빨강, optional → 옅은 빨강.
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === '' || (typeof v === 'string' && !v.trim());
  const emptyCls = (v: unknown, required = false) =>
    isEmpty(v) ? (required ? 'border-red-400' : 'border-red-200') : '';

  const handleNpwpOcr = async (file: File) => {
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/customer/npwp-ocr', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.npwp) {
        setProfile(prev => prev ? {
          ...prev,
          npwp: data.data.npwp || prev.npwp,
          company_name: data.data.name || prev.company_name,
          address: data.data.address || prev.address,
        } : prev);
        showMsg('success', 'NPWP ' + t('k32_140b4c') + ' (' + Math.round((data.data.confidence || 0) * 100) + '%)');
      } else {
        showMsg('error', 'NPWP ' + t('k33_e67af7') + ' — ' + t('k34_3020c1'));
      }
    } catch {
      showMsg('error', 'OCR ' + t('k35_7bc738'));
    } finally {
      setOcrLoading(false);
    }
  };

  // LinkedIn-style: 다음 채울 항목 추천 (가중치 기반)
  const getNextItems = (p: CompanyProfile): Array<{ label: string; boost: number; href?: string }> => {
    const items: Array<{ label: string; boost: number }> = [];
    if (!p.company_name) items.push({ label: t('k36_b75e2f'), boost: 14 });
    if (!p.npwp) items.push({ label: `NPWP ${t('k37_73b781')}`, boost: 14 });
    if (!p.business_category) items.push({ label: t('k38_a419a9'), boost: 14 });
    if (!p.legal_form) items.push({ label: t('k39_aad46d'), boost: 7 });
    if (!p.annual_revenue || p.annual_revenue <= 0) items.push({ label: t('k40_85ce9e'), boost: 7 });
    if (!p.established_year) items.push({ label: t('k41_c33f93'), boost: 3 });
    if (!p.address) items.push({ label: t('k42_6cced3'), boost: 3 });
    return items.slice(0, 4);
  };

  const handleSave = async () => {
    if (!profile) return;
    // 2026-08-30 — MASTER 지정 필수항목 미입력이면 저장 차단.
    const missing = reqMissing(profile as unknown as Record<string, unknown>);
    if (missing.length > 0) {
      showMsg('error', `${t('requiredMissingBlock')} — ${missing.map(m => m.label).join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      // 1. 프로필 저장 — consultant 인 경우 picker 의 customerId 를 body 에 명시.
      // (server PUT 은 body.id 있을 때 그 customer 의 profile 을 update.)
      const payload = effectiveCustomerId
        ? { ...profile, id: effectiveCustomerId }
        : profile;
      const res = await fetch('/api/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        showMsg('error', data.error || t('k43_5f3ec4'));
        return;
      }

      // 2. 세금 체제 자동 판정 (프로필 저장 후 항상 실행)
      const taxRes = await fetch('/api/company-profile/determine-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.data),
      });
      const taxData = await taxRes.json();
      if (taxData.success && taxData.data?.profile) {
        setProfile(taxData.data.profile);
      } else if (data.data) {
        setProfile(data.data);
      }

      // 3. 완성도 80% 이상이면 대시보드로 자동 이동 안내,
      //    미만이면 지속 노출되는 post-save CTA 배너 표시.
      const completeness = data.data?.profile_completeness || taxData.data?.profile?.profile_completeness || 0;
      if (completeness >= 80) {
        showMsg('success', t('k44_489111'));
        setTimeout(() => router.push(`/${locale}/dashboard`), 2000);
      } else {
        showMsg('success', `${t('k45_a50494')} ${completeness}%). ${t('k46_b1a005')}`);
        setShowPostSaveCta(true);
      }
    } catch {
      showMsg('error', t('k47_175c5f'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md text-center">
        <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-sm text-gray-500">{t('k48_6d5980')}</p>
      </div>
    );
  }

  const Section = ({ id, title, icon: Icon, children, badge }: { id: string; title: string; icon: typeof Building2; children: React.ReactNode; badge?: string }) => {
    const isOpen = expandedSections.has(id);
    return (
      <Card id={`section-${id}`} className="border-0 shadow-sm scroll-mt-24">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-indigo-600" />
            <span className="font-bold text-sm">{title}</span>
            {badge && <Badge className="text-[9px] bg-blue-100 text-blue-700">{badge}</Badge>}
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
        {isOpen && <CardContent className="p-4 pt-0 space-y-3">{children}</CardContent>}
      </Card>
    );
  };

  const Checkbox = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <label className="flex items-start gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 accent-emerald-600" />
      <div className="text-xs">
        <span className="font-medium">{label}</span>
        {desc && <p className="text-gray-500 text-[11px]">{desc}</p>}
      </div>
    </label>
  );

  const completeness = profile.profile_completeness || 0;
  const nextItems = getNextItems(profile);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 2026-06-27: consultant 면 picker 노출 — 어느 고객의 회사 프로필을
          보고/수정 중인지 명확하게. CUSTOMER role 은 안 보임. */}
      {isConsultant && customers.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('customerPicker')}
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name || c.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      {isWelcome && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">{t('welcomeTitle')}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('welcomeBody')}</p>
            </div>
          </div>
        </div>
      )}
      {showPostSaveCta && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">
                {nextItems.length > 0
                  ? t('savedNextItems', { items: nextItems.map(n => n.label).slice(0, 3).join(' · ') })
                  : t('savedContinueLater')}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{t('savedContinueLater')}</p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/${locale}/dashboard`)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {t('savedGoDashboardNow')}
            </Button>
          </div>
        </div>
      )}
      <SimpleHeader completeness={completeness} onSave={handleSave} saving={saving} />
      <SimpleCompletenessCard completeness={completeness} />
      <RequiredFieldsBanner missing={reqMissing(profile as unknown as Record<string, unknown>)} />
      <SimpleBasicInfo
        profile={profile}
        updateField={updateField}
        ocrLoading={ocrLoading}
        onOcrFile={(file) => handleNpwpOcr(file)}
      />
      <SimpleBusinessType
        categories={BUSINESS_CATEGORIES}
        selected={profile.business_category}
        onSelect={(v) => updateField('business_category', v)}
      />


      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {/* Section 2: Legal / UMKM */}
        <Section id="legal" title={t('k72_45d02a')} icon={Shield} badge="PPh 25 vs PPh Final">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('k73_c2e5a1')}</Label>
              <select value={profile.legal_form || ''} onChange={e => updateField('legal_form', e.target.value || null)}
                className={`w-full h-9 px-3 rounded-md border text-xs ${isEmpty(profile.legal_form) ? 'border-red-200' : 'border-input'}`}>
                <option value="">{t('k74_f1d7fb')}</option>
                {LEGAL_FORMS.map(lf => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{t('k75_7f0fd8')}</Label>
              <Input type="number" value={profile.established_year || ''} onChange={e => updateField('established_year', e.target.value ? Number(e.target.value) : null)}
                placeholder="2020" className={`text-xs ${emptyCls(profile.established_year)}`} />
            </div>
            <div>
              <Label className="text-xs">{t('k76_6e882c')}</Label>
              <Input type="number" value={profile.annual_revenue || ''} onChange={e => updateField('annual_revenue', e.target.value ? Number(e.target.value) : null)}
                placeholder="5000000000" className={`font-mono text-xs ${emptyCls(profile.annual_revenue)}`} />
              {profile.annual_revenue && profile.annual_revenue < 4_800_000_000 && (
                <p className="text-[11px] text-green-600 mt-1">✓ 48{t('k77_5e4cf0')} — UMKM PPh Final 0.5% {t('k78_ddaf1c')}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">{t('k79_79d9cf')}</Label>
              <Input type="number" value={profile.paid_up_capital || ''} onChange={e => updateField('paid_up_capital', e.target.value ? Number(e.target.value) : null)}
                className={`font-mono text-xs ${emptyCls(profile.paid_up_capital)}`} />
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <Checkbox checked={profile.is_umkm} onChange={v => updateField('is_umkm', v)}
              label={t('umkmLabel')} desc={t('umkmDesc')} />
            {profile.is_umkm && (
              <div className="ml-6">
                <Label className="text-[10px]">PPh Final 0.5% {t('k84_e71351')}</Label>
                <Input type="number" value={profile.umkm_final_tax_start_year || ''} className="w-32 h-8 text-xs"
                  onChange={e => updateField('umkm_final_tax_start_year', e.target.value ? Number(e.target.value) : null)} />
              </div>
            )}

            {/* PPh 25 election at NPWP creation (overrides UMKM default) */}
            <div className="border-t pt-2 mt-2">
              <Checkbox checked={profile.npwp_pph25_elected}
                onChange={v => updateField('npwp_pph25_elected', v)}
                label={`NPWP ${t('k85_ea9b00')}`}
                desc={`NPWP ${t('k86_fc3b9e')}`} />
              {profile.npwp_pph25_elected && (
                <div className="ml-6 mt-1">
                  <Label className="text-[10px]">PPh 25 {t('k87_79bb85')}</Label>
                  <Input type="date"
                    value={profile.npwp_pph25_elected_at || ''}
                    className="w-40 h-8 text-xs"
                    onChange={e => updateField('npwp_pph25_elected_at', e.target.value || null)} />
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Section 3: Ownership */}
        <Section id="ownership" title={t('k88_0f43fb')} icon={Users}>
          <Checkbox checked={profile.has_foreign_shareholders} onChange={v => updateField('has_foreign_shareholders', v)}
            label={t('k89_b46f1f')} desc={`→ PPh 26 ${t('k90_7955d0')}`} />
          {profile.has_foreign_shareholders && (
            <div className="ml-6 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">{t('k91_cf8318')}</Label>
                <Input type="number" value={profile.foreign_ownership_pct || ''} className="h-8 text-xs"
                  onChange={e => updateField('foreign_ownership_pct', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label className="text-[10px]">{t('parentCompany')}</Label>
                <Input value={profile.parent_company_name || ''} className="h-8 text-xs"
                  onChange={e => updateField('parent_company_name', e.target.value || null)} />
              </div>
              <div>
                <Label className="text-[10px]">{t('k93_df9baf')}</Label>
                <Input value={profile.parent_company_country || ''} className="h-8 text-xs font-mono" maxLength={2}
                  onChange={e => updateField('parent_company_country', e.target.value.toUpperCase() || null)} />
              </div>
            </div>
          )}
        </Section>

        {/* Section 3.5: Shareholders (Akta Pendirian) */}
        <ShareholderSection />

        {/* Section 4: Income Sources */}
        <Section id="income" title={`${t('k94_7c846a')} & Expenses)`} icon={DollarSign} badge={t('k95_8a337a')}>
          <p className="text-[11px] text-gray-500 mb-2">{t('selectAllApplicable')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Checkbox checked={profile.has_employees} onChange={v => updateField('has_employees', v)}
              label={t('k97_b59235')} desc={`→ PPh 21 ${t('k98_f68dad')}`} />
            <Checkbox checked={profile.is_pkp} onChange={v => updateField('is_pkp', v)}
              label={`PKP ${t('k99_c35e34')}`} desc={`→ PPN 11% ${t('k98_f68dad')}`} />
            <Checkbox checked={profile.pays_service_fees} onChange={v => updateField('pays_service_fees', v)}
              label={t('k100_72a7fc')} desc={`→ PPh 23 ${t('k101_a260fe')}`} />
            <Checkbox checked={profile.has_import_export} onChange={v => updateField('has_import_export', v)}
              label={t('k102_3c83e0')} desc={`→ PPh 22 + ${t('k103_90fe7f')}`} />
            <Checkbox checked={profile.has_rental_business} onChange={v => updateField('has_rental_business', v)}
              label={t('k104_180391')} desc="→ PPh 4(2) Final 10%" />
            <Checkbox checked={profile.pays_rent} onChange={v => updateField('pays_rent', v)}
              label={t('k105_06030b')} desc={`→ PPh 4(2) ${t('k106_1e146b')}`} />
            <Checkbox checked={profile.receives_dividends} onChange={v => updateField('receives_dividends', v)}
              label={t('k107_b8a139')} desc={`→ PPh 23 15% (${t('k108_780901')}`} />
            <Checkbox checked={profile.receives_interest} onChange={v => updateField('receives_interest', v)}
              label={t('k109_f3d368')} desc="→ PPh 23 15% / PPh 4(2)" />
            <Checkbox checked={profile.receives_royalties} onChange={v => updateField('receives_royalties', v)}
              label={t('k110_351231')} desc={`→ PPh 23 15% (${t('k108_780901')}`} />
            <Checkbox checked={profile.has_franchise} onChange={v => updateField('has_franchise', v)}
              label={t('k111_43b93b')} desc={`→ PPh 23 ${t('k112_a9c8d4')}`} />
            <Checkbox checked={profile.sells_property} onChange={v => updateField('sells_property', v)}
              label={t('k113_3bdbdb')} desc="→ PPh 4(2) Final 2.5%" />
            <Checkbox checked={profile.has_shipping_business} onChange={v => updateField('has_shipping_business', v)}
              label={t('k114_7c23cc')} desc="→ PPh 15" />
          </div>
        </Section>

        {/* Section 5: Construction (conditional) */}
        {(profile.business_category === 'CONSTRUCTION' || profile.has_construction_sbu) && (
          <Section id="construction" title={t('k115_4b74db')} icon={Building2} badge="PPh 4(2)">
            <Checkbox checked={profile.has_construction_sbu} onChange={v => updateField('has_construction_sbu', v)}
              label={`SBU (Sertifikat Badan Usaha) ${t('k116_286f58')}`} desc={`PP 9/2022 ${t('k117_8dee5d')}`} />
            {profile.has_construction_sbu && (
              <div className="grid grid-cols-3 gap-2 ml-6">
                <div>
                  <Label className="text-[10px]">SBU {t('k118_0e1cd4')}</Label>
                  <select value={profile.sbu_qualification || ''} onChange={e => updateField('sbu_qualification', e.target.value || null)}
                    className="w-full h-8 px-2 rounded border text-xs">
                    <option value="">{t('k119_3828fa')}</option>
                    <option value="SMALL">Kecil (1.75%)</option>
                    <option value="MEDIUM">Menengah (2.65%)</option>
                    <option value="LARGE">Besar (4%)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">SBU {t('k120_5ca2f7')}</Label>
                  <Input value={profile.sbu_number || ''} className="h-8 text-xs font-mono"
                    onChange={e => updateField('sbu_number', e.target.value || null)} />
                </div>
                <div>
                  <Label className="text-[10px]">{t('k121_a37db9')}</Label>
                  <Input type="date" value={profile.sbu_expires_at || ''} className="h-8 text-xs"
                    onChange={e => updateField('sbu_expires_at', e.target.value || null)} />
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Section 6: F&B (conditional) */}
        {(profile.business_category === 'FNB_RESTAURANT' || profile.business_category === 'FNB_CATERING' || profile.is_restaurant || profile.is_catering) && (
          <Section id="fnb" title={`F&B ${t('k122_b70e98')}`} icon={Utensils}>
            <Checkbox checked={profile.is_restaurant} onChange={v => updateField('is_restaurant', v)}
              label={t('k123_12daf7')} desc={t('k124_e051d4')} />
            <Checkbox checked={profile.is_catering} onChange={v => updateField('is_catering', v)}
              label={t('k125_78c265')} desc={`PPh 23 2% ${t('k2_3f6978')}`} />
          </Section>
        )}

        {/* AI Questions */}
        {profile.ai_profile_questions && profile.ai_profile_questions.length > 0 && (
          <Section id="ai" title={`AI ${t('k126_8932d6')}`} icon={Sparkles}>
            <div className="space-y-3">
              {profile.ai_profile_questions.map((q, i) => (
                <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2 mb-2">
                    <HelpCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900">{q.question}</p>
                  </div>
                  <Input
                    value={q.answer || ''}
                    onChange={e => {
                      const updated = [...profile.ai_profile_questions];
                      updated[i] = { ...updated[i], answer: e.target.value };
                      updateField('ai_profile_questions', updated);
                    }}
                    placeholder={t('k127_e7a792')}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6">
        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('saveAndPrepare')}
        </Button>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          {t('saveDesc')}
        </p>
      </div>
    </div>
  );
}

function SimpleHeader({ completeness, onSave, saving }: { completeness: number; onSave: () => void; saving: boolean }) {
  void completeness;
  const tp = useTranslations('companyProfilePage.simple');
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{tp('title')}</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-3xl">{tp('subtitle')}</p>
      </div>
      <Button onClick={onSave} disabled={saving} size="sm" className="bg-slate-900 text-white hover:bg-slate-800 shrink-0">
        {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
        {saving ? tp('saving') : tp('save')}
      </Button>
    </div>
  );
}

function SimpleCompletenessCard({ completeness }: { completeness: number }) {
  const tp = useTranslations('companyProfilePage.simple');
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{tp('completenessTitle', { pct: completeness })}</p>
          <p className="text-xs text-slate-500 mt-1">{tp('completenessDesc')}</p>
        </div>
        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 shrink-0">
          {tp('completenessBadge', { pct: completeness })}
        </span>
      </div>
      <div className="mt-4 h-2.5 bg-white rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${completeness}%` }} />
      </div>
    </div>
  );
}

function SimpleBasicInfo({
  profile,
  updateField,
  ocrLoading,
  onOcrFile,
}: {
  profile: CompanyProfile;
  updateField: <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => void;
  ocrLoading: boolean;
  onOcrFile: (file: File) => void;
}) {
  const tp = useTranslations('companyProfilePage.simple');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-slate-900">{tp('basicTitle')}</h2>
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          {tp('requiredBadge')}
        </span>
      </div>

      <div className="rounded-xl bg-blue-50 p-5 text-center mb-5">
        <p className="text-sm font-semibold text-blue-900">{tp('npwpAutoInput')}</p>
        <label className="inline-flex items-center justify-center mt-3 w-full cursor-pointer rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors">
          {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
          {tp('npwpAutoCta')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={ocrLoading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onOcrFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.companyName')} <span className="text-red-500">*</span></Label>
          <Input
            value={profile.company_name || ''}
            onChange={(e) => updateField('company_name', e.target.value)}
            placeholder="PT Example Indonesia"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.npwp')} <span className="text-red-500">*</span></Label>
          <Input
            value={profile.npwp || ''}
            onChange={(e) => updateField('npwp', e.target.value)}
            placeholder="0123456789012000"
            className="font-mono tracking-wider"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.address')} <span className="text-red-500">*</span></Label>
          <Input
            value={profile.address || ''}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Jl. Sudirman No. 1, Jakarta Pusat"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.kbli')} <span className="text-red-500">*</span></Label>
          <Input placeholder="62010" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.phone')} <span className="text-red-500">*</span></Label>
          <Input placeholder="+62 21 0000 0000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tp('fields.email')} <span className="text-red-500">*</span></Label>
          <Input type="email" placeholder="company.test@example.com" />
        </div>
      </div>
    </div>
  );
}

function SimpleBusinessType({
  categories,
  selected,
  onSelect,
}: {
  categories: { value: string; label: string; icon: typeof Building2; taxNote?: string }[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  const tp = useTranslations('companyProfilePage.simple');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
      <h2 className="text-base font-bold text-slate-900">{tp('businessTitle')}</h2>
      <p className="text-sm text-slate-500 mt-1">{tp('businessDesc')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {categories.map((cat) => {
          const isSelected = selected === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onSelect(cat.value)}
              className={cn(
                'text-left rounded-xl border-2 p-4 transition-all',
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <p className={cn('text-sm font-bold', isSelected ? 'text-blue-900' : 'text-slate-900')}>{cat.label}</p>
              {cat.taxNote && (
                <p className={cn('text-xs mt-1', isSelected ? 'text-blue-700' : 'text-amber-600')}>{cat.taxNote}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
