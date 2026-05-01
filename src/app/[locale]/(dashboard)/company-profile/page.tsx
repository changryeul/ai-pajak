'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Save, Loader2, CheckCircle, AlertTriangle,
  Sparkles, HelpCircle, ChevronDown, ChevronRight,
  Factory, Utensils, Home, Ship, Pickaxe, Globe,
  Briefcase, Users, DollarSign, Shield, Camera, FileText,
  Trophy,
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
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'business', 'income']));

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
    setLoading(true);
    try {
      const res = await fetch('/api/company-profile');
      const data = await res.json();
      if (data.success) setProfile(data.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [session]);

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
    setSaving(true);
    try {
      // 1. 프로필 저장
      const res = await fetch('/api/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
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

      // 3. 완성도 80% 이상이면 대시보드로 이동 안내
      const completeness = data.data?.profile_completeness || taxData.data?.profile?.profile_completeness || 0;
      if (completeness >= 80) {
        showMsg('success', t('k44_489111'));
        setTimeout(() => router.push(`/${locale}/dashboard`), 2000);
      } else {
        showMsg('success', `${t('k45_a50494')} ${completeness}%). ${t('k46_b1a005')}`);
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
  const isComplete = completeness >= 100;
  const isReady = completeness >= 80;
  const nextItems = getNextItems(profile);
  const progressColor = isComplete ? 'bg-green-500' : isReady ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const progressBg = isComplete ? 'from-green-50 to-emerald-50 border-green-200' : isReady ? 'from-emerald-50 to-teal-50 border-emerald-200' : completeness >= 50 ? 'from-amber-50 to-orange-50 border-amber-200' : 'from-red-50 to-rose-50 border-red-200';

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <CompanyProfileHeader
        completeness={completeness}
        onSave={handleSave}
        saving={saving}
      />


      {/* LinkedIn-style Profile Completeness Card */}
      <div className={`mb-6 p-5 rounded-2xl border-2 bg-gradient-to-br ${progressBg}`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <div className="p-2 rounded-full bg-green-500 shadow-lg shadow-green-500/30">
                <Trophy className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="relative h-12 w-12 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none"
                    stroke={isReady ? '#10b981' : completeness >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="4" strokeDasharray={`${(completeness / 100) * 125.66} 125.66`}
                    strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <span className="text-xs font-bold text-gray-700">{completeness}%</span>
              </div>
            )}
            <div>
              <p className="font-bold text-base text-gray-900">
                {isComplete ? `🎉 ${t('k52_367729')}!` : isReady ? t('k53_669bdc') : t('k54_7c9d02')}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {isComplete
                  ? t('k55_dc489b')
                  : isReady
                  ? t('k56_63989b')
                  : t('k57_77d952')}
              </p>
            </div>
          </div>
          {isReady && (
            <Button size="sm" onClick={() => router.push(`/${locale}/dashboard`)} className="flex-shrink-0">
              {t('k58_bbcea4')}
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-white/60 rounded-full overflow-hidden mb-3">
          <div className={`h-full ${progressColor} transition-all duration-700 ease-out`} style={{ width: `${completeness}%` }} />
        </div>

        {/* Next items recommendation */}
        {!isComplete && nextItems.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">{t('k59_776c06')}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {nextItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-white/70 rounded-lg border border-white">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-indigo-700">+{item.boost}%</span>
                  </div>
                  <span className="text-xs text-gray-700 flex-1 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-end gap-2">
        <Badge className={isReady ? 'bg-green-100 text-green-700' : completeness >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
          {t('k60_262eb0')} {completeness}%
        </Badge>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          {t('k61_9d0a47')}
        </Button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {/* Section 0: Basic Info (with NPWP OCR) */}
        <Section id="basic" title={t('k62_2b51db')} icon={FileText} badge={t('k63_b63c09')}>
          <p className="text-[11px] text-gray-500 mb-2">{t('k64_fe2bf6')}</p>

          {/* NPWP OCR Upload */}
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-3 text-center bg-blue-50/50">
            <div className="flex items-center justify-center gap-2">
              <Camera className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-blue-700 font-medium">NPWP {t('k65_633b57')}</p>
            </div>
            <label className="inline-flex items-center gap-2 mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-white text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
              {ocrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              {ocrLoading ? 'AI ' + t('k66_4f1c1b') : t('k67_d15ce8')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={ocrLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleNpwpOcr(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="md:col-span-2">
              <Label className="text-xs">{t('k50_2e47c1')} <span className="text-red-500">*</span></Label>
              <Input
                value={profile.company_name || ''}
                onChange={e => updateField('company_name', e.target.value)}
                placeholder="PT. Example Indonesia"
                className={`text-sm ${emptyCls(profile.company_name, true)}`}
              />
            </div>
            <div>
              <Label className="text-xs">NPWP <span className="text-red-500">*</span></Label>
              <Input
                value={profile.npwp || ''}
                onChange={e => updateField('npwp', e.target.value)}
                placeholder="XX.XXX.XXX.X-XXX.XXX"
                className={`font-mono text-sm tracking-wider ${emptyCls(profile.npwp, true)}`}
              />
            </div>
            <div>
              <Label className="text-xs">{t('k68_45f790')}</Label>
              <Input
                value={profile.address || ''}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Jl. Sudirman No. 1, Jakarta"
                className={`text-sm ${emptyCls(profile.address)}`}
              />
            </div>
          </div>
        </Section>

        {/* Section 1: Business Type */}
        <Section id="business" title={t('k69_2aa9e2')} icon={Briefcase} badge={t('k70_3cec60')}>
          <p className="text-[11px] text-gray-500 mb-2">{t('k71_ffc082')}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {BUSINESS_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const selected = profile.business_category === cat.value;
              return (
                <button key={cat.value} type="button"
                  onClick={() => updateField('business_category', cat.value)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Icon className={`h-4 w-4 mb-1 ${selected ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <p className="text-xs font-medium">{cat.label}</p>
                  {cat.taxNote && <p className="text-[10px] text-amber-600 mt-0.5">{cat.taxNote}</p>}
                </button>
              );
            })}
          </div>
        </Section>

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

const STEP_KEYS: ('basic' | 'tax' | 'ownership' | 'business' | 'ai')[] = [
  'basic', 'tax', 'ownership', 'business', 'ai',
];

function CompanyProfileHeader({
  completeness,
  onSave,
  saving,
}: {
  completeness: number;
  onSave: () => void;
  saving: boolean;
}) {
  const tp = useTranslations('companyProfilePage');
  const tcommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const scrollTo = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mb-6">
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{tp('pageTitle')}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving} size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            {tcommon('save')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
            {tp('backToDashboard')}
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {tp('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {tp(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Hero */}
      <div className="rounded-2xl bg-slate-900 p-7 md:p-9 text-white mb-6">
        <p className="text-slate-400 text-sm mb-2">{tp('hero.label')}</p>
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{tp('hero.title')}</h2>
        <p className="text-slate-300 text-sm mt-3 max-w-4xl">{tp('hero.subtitle')}</p>
        <div className="mt-5 inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200">
          프로필 완성도 {completeness}%
        </div>
      </div>

      {/* Quick entries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { id: 'first', target: 'basic' },
          { id: 'tax', target: 'legal' },
          { id: 'ownership', target: 'ownership' },
          { id: 'business', target: 'business' },
        ] as const).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => scrollTo(entry.target)}
            className="rounded-xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-sm hover:border-slate-300"
          >
            <p className="text-sm font-semibold text-slate-900">{tp(`quickEntries.${entry.id}.title`)}</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{tp(`quickEntries.${entry.id}.body`)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
