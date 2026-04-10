'use client';

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

const BUSINESS_CATEGORIES = [
  { value: 'SERVICE', label: '서비스업 (Jasa)', icon: Briefcase, desc: 'IT, 컨설팅, 법률, 회계 등', taxNote: 'PPh 23 원천징수 대상' },
  { value: 'TRADING', label: '무역/유통 (Perdagangan)', icon: DollarSign, desc: '상품 매매, 도소매', taxNote: 'PPh 22 수입 시' },
  { value: 'MANUFACTURING', label: '제조업 (Manufaktur)', icon: Factory, desc: '공장/생산', taxNote: 'PPh 22 산업체' },
  { value: 'CONSTRUCTION', label: '건설업 (Konstruksi)', icon: Building2, desc: '건축, 토목, 설비', taxNote: 'PPh 4(2) Final — SBU 등급별 세율' },
  { value: 'REAL_ESTATE', label: '부동산 (Real Estate)', icon: Home, desc: '부동산 매매/개발', taxNote: 'PPh 4(2) 2.5%' },
  { value: 'FNB_RESTAURANT', label: '식당 (Restoran)', icon: Utensils, desc: '식당/카페', taxNote: 'PPN 면제 (지역세 적용)' },
  { value: 'FNB_CATERING', label: '케이터링 (Katering)', icon: Utensils, desc: '출장 요리', taxNote: 'PPh 23 2%' },
  { value: 'TRANSPORTATION', label: '운송/해운 (Transportasi)', icon: Ship, desc: '운송, 해운, 항공', taxNote: 'PPh 15 1.2~2.64%' },
  { value: 'MINING', label: '광업 (Pertambangan)', icon: Pickaxe, desc: '광산, 자원 채굴', taxNote: 'PPh 22 Mining' },
  { value: 'DIGITAL_PLATFORM', label: '디지털 플랫폼 (PMSE)', icon: Globe, desc: 'e-Commerce, SaaS, 앱', taxNote: 'PPN PMSE' },
  { value: 'OTHER', label: '기타', icon: Building2, desc: '', taxNote: '' },
];

const LEGAL_FORMS = [
  { value: 'PT', label: 'PT (Perseroan Terbatas)', desc: '유한회사 — PPh Final 3년 한도' },
  { value: 'CV', label: 'CV (Commanditaire Vennootschap)', desc: '합자회사 — PPh Final 4년 한도' },
  { value: 'UD', label: 'UD (Usaha Dagang)', desc: '개인사업체' },
  { value: 'FIRMA', label: 'Firma', desc: '합명회사' },
  { value: 'KOPERASI', label: 'Koperasi', desc: '협동조합' },
  { value: 'YAYASAN', label: 'Yayasan', desc: '재단/비영리' },
];

export default function CompanyProfilePage() {
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
        showMsg('success', `NPWP 인식 완료 (신뢰도 ${Math.round((data.data.confidence || 0) * 100)}%)`);
      } else {
        showMsg('error', 'NPWP 인식 실패 — 직접 입력해주세요');
      }
    } catch {
      showMsg('error', 'OCR 처리 중 오류 발생');
    } finally {
      setOcrLoading(false);
    }
  };

  // LinkedIn-style: 다음 채울 항목 추천 (가중치 기반)
  const getNextItems = (p: CompanyProfile): Array<{ label: string; boost: number; href?: string }> => {
    const items: Array<{ label: string; boost: number }> = [];
    if (!p.company_name) items.push({ label: '회사명 입력', boost: 14 });
    if (!p.npwp) items.push({ label: 'NPWP 입력 (사진으로 자동 입력 가능)', boost: 14 });
    if (!p.business_category) items.push({ label: '사업 유형 선택', boost: 14 });
    if (!p.legal_form) items.push({ label: '법인 형태 선택 (PT/CV/UD 등)', boost: 7 });
    if (!p.annual_revenue || p.annual_revenue <= 0) items.push({ label: '연 매출 입력', boost: 7 });
    if (!p.established_year) items.push({ label: '설립 연도 입력', boost: 3 });
    if (!p.address) items.push({ label: '주소 입력', boost: 3 });
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
        showMsg('error', data.error || '저장 실패');
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
        showMsg('success', '신고 준비가 완료되었습니다! 대시보드로 이동합니다.');
        setTimeout(() => router.push(`/${locale}/dashboard`), 2000);
      } else {
        showMsg('success', `저장 완료 (완성도 ${completeness}%). 추가 정보를 입력하면 신고 준비가 완료됩니다.`);
      }
    } catch {
      showMsg('error', '서버 오류');
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
        <p className="text-sm text-gray-500">회사 프로필을 불러올 수 없습니다</p>
      </div>
    );
  }

  const Section = ({ id, title, icon: Icon, children, badge }: { id: string; title: string; icon: typeof Building2; children: React.ReactNode; badge?: string }) => {
    const isOpen = expandedSections.has(id);
    return (
      <Card className="border-0 shadow-sm">
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          회사 세무 프로필
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {profile.company_name || '회사명'} — 세목 결정에 필요한 모든 정보를 관리합니다
        </p>
      </div>

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
                {isComplete ? '🎉 프로필 100% 완성!' : isReady ? '신고 준비 완료' : '프로필 완성도'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {isComplete
                  ? '완벽합니다. 모든 세무 서비스를 이용할 수 있습니다.'
                  : isReady
                  ? '신고를 시작할 수 있습니다. 100%까지 조금만 더 채워보세요.'
                  : '몇 가지만 더 입력하면 세금 신고를 시작할 수 있습니다.'}
              </p>
            </div>
          </div>
          {isReady && (
            <Button size="sm" onClick={() => router.push(`/${locale}/dashboard`)} className="flex-shrink-0">
              대시보드로
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
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">다음 채울 항목</p>
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
          완성도 {completeness}%
        </Badge>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          저장
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
        <Section id="basic" title="기본 정보 (Basic Info)" icon={FileText} badge="필수">
          <p className="text-[11px] text-gray-500 mb-2">회사명과 NPWP는 세금 신고 필수 정보입니다. NPWP 카드 사진을 올리면 자동으로 채워집니다.</p>

          {/* NPWP OCR Upload */}
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-3 text-center bg-blue-50/50">
            <div className="flex items-center justify-center gap-2">
              <Camera className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-blue-700 font-medium">NPWP 카드 사진으로 자동 입력</p>
            </div>
            <label className="inline-flex items-center gap-2 mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-white text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
              {ocrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              {ocrLoading ? 'AI 인식 중...' : '사진 촬영/업로드'}
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
              <Label className="text-xs">회사명 <span className="text-red-500">*</span></Label>
              <Input
                value={profile.company_name || ''}
                onChange={e => updateField('company_name', e.target.value)}
                placeholder="PT. Example Indonesia"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">NPWP <span className="text-red-500">*</span></Label>
              <Input
                value={profile.npwp || ''}
                onChange={e => updateField('npwp', e.target.value)}
                placeholder="XX.XXX.XXX.X-XXX.XXX"
                className="font-mono text-sm tracking-wider"
              />
            </div>
            <div>
              <Label className="text-xs">주소</Label>
              <Input
                value={profile.address || ''}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Jl. Sudirman No. 1, Jakarta"
                className="text-sm"
              />
            </div>
          </div>
        </Section>

        {/* Section 1: Business Type */}
        <Section id="business" title="사업 유형 (Business Type)" icon={Briefcase} badge="세금 체제 결정">
          <p className="text-[11px] text-gray-500 mb-2">사업 유형에 따라 적용되는 세목과 세율이 달라집니다.</p>
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
        <Section id="legal" title="법인 형태 및 UMKM" icon={Shield} badge="PPh 25 vs PPh Final">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">법인 형태</Label>
              <select value={profile.legal_form || ''} onChange={e => updateField('legal_form', e.target.value || null)}
                className="w-full h-9 px-3 rounded-md border border-input text-xs">
                <option value="">선택하세요</option>
                {LEGAL_FORMS.map(lf => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">설립 연도</Label>
              <Input type="number" value={profile.established_year || ''} onChange={e => updateField('established_year', e.target.value ? Number(e.target.value) : null)}
                placeholder="2020" className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">연 매출 (Rp)</Label>
              <Input type="number" value={profile.annual_revenue || ''} onChange={e => updateField('annual_revenue', e.target.value ? Number(e.target.value) : null)}
                placeholder="5000000000" className="font-mono text-xs" />
              {profile.annual_revenue && profile.annual_revenue < 4_800_000_000 && (
                <p className="text-[11px] text-green-600 mt-1">✓ 48억 IDR 미만 — UMKM PPh Final 0.5% 대상 가능</p>
              )}
            </div>
            <div>
              <Label className="text-xs">납입 자본금 (Rp)</Label>
              <Input type="number" value={profile.paid_up_capital || ''} onChange={e => updateField('paid_up_capital', e.target.value ? Number(e.target.value) : null)}
                className="font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <Checkbox checked={profile.is_umkm} onChange={v => updateField('is_umkm', v)}
              label="UMKM 등록 (PP 55/2022)" desc="연매출 48억 IDR 미만 → PPh Final 0.5%. PT: 3년, CV: 4년, 개인: 7년 한도" />
            {profile.is_umkm && (
              <div className="ml-6">
                <Label className="text-[10px]">PPh Final 0.5% 시작 연도</Label>
                <Input type="number" value={profile.umkm_final_tax_start_year || ''} className="w-32 h-8 text-xs"
                  onChange={e => updateField('umkm_final_tax_start_year', e.target.value ? Number(e.target.value) : null)} />
              </div>
            )}

            {/* PPh 25 election at NPWP creation (overrides UMKM default) */}
            <div className="border-t pt-2 mt-2">
              <Checkbox checked={profile.npwp_pph25_elected}
                onChange={v => updateField('npwp_pph25_elected', v)}
                label="NPWP 발행 시 PPh 25 선택"
                desc="NPWP 등록 시점에 PPh 25 적용을 선택하신 경우 체크. 체크 시 설립 3년 이내라도 UMKM PPh Final 대신 일반 법인세(PPh 25)가 적용됩니다." />
              {profile.npwp_pph25_elected && (
                <div className="ml-6 mt-1">
                  <Label className="text-[10px]">PPh 25 선택일 (NPWP 발행일)</Label>
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
        <Section id="ownership" title="소유 구조 (Ownership)" icon={Users}>
          <Checkbox checked={profile.has_foreign_shareholders} onChange={v => updateField('has_foreign_shareholders', v)}
            label="외국인/외국법인 주주가 있습니다" desc="→ PPh 26 배당 원천징수, Transfer Pricing 이슈 가능" />
          {profile.has_foreign_shareholders && (
            <div className="ml-6 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">외국인 지분율 (%)</Label>
                <Input type="number" value={profile.foreign_ownership_pct || ''} className="h-8 text-xs"
                  onChange={e => updateField('foreign_ownership_pct', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label className="text-[10px]">모회사명</Label>
                <Input value={profile.parent_company_name || ''} className="h-8 text-xs"
                  onChange={e => updateField('parent_company_name', e.target.value || null)} />
              </div>
              <div>
                <Label className="text-[10px]">모회사 국가 (ISO)</Label>
                <Input value={profile.parent_company_country || ''} className="h-8 text-xs font-mono" maxLength={2}
                  onChange={e => updateField('parent_company_country', e.target.value.toUpperCase() || null)} />
              </div>
            </div>
          )}
        </Section>

        {/* Section 3.5: Shareholders (Akta Pendirian) */}
        <ShareholderSection />

        {/* Section 4: Income Sources */}
        <Section id="income" title="수입원 및 지출 유형 (Income & Expenses)" icon={DollarSign} badge="세목 결정 핵심">
          <p className="text-[11px] text-gray-500 mb-2">해당되는 항목을 모두 선택하세요. 세목(PPh 21/22/23/26/4(2), PPN) 적용 여부를 판단합니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Checkbox checked={profile.has_employees} onChange={v => updateField('has_employees', v)}
              label="직원 고용" desc="→ PPh 21 월 신고" />
            <Checkbox checked={profile.is_pkp} onChange={v => updateField('is_pkp', v)}
              label="PKP 등록 (VAT)" desc="→ PPN 11% 월 신고" />
            <Checkbox checked={profile.pays_service_fees} onChange={v => updateField('pays_service_fees', v)}
              label="서비스 비용 지급" desc="→ PPh 23 원천징수 (2%)" />
            <Checkbox checked={profile.has_import_export} onChange={v => updateField('has_import_export', v)}
              label="수입/수출 거래" desc="→ PPh 22 + 수입 PPN" />
            <Checkbox checked={profile.has_rental_business} onChange={v => updateField('has_rental_business', v)}
              label="임대 수입 (건물/토지)" desc="→ PPh 4(2) Final 10%" />
            <Checkbox checked={profile.pays_rent} onChange={v => updateField('pays_rent', v)}
              label="임차료 지급" desc="→ PPh 4(2) 원천징수 10%" />
            <Checkbox checked={profile.receives_dividends} onChange={v => updateField('receives_dividends', v)}
              label="배당 수입" desc="→ PPh 23 15% (국내) / PPh 26 (국외)" />
            <Checkbox checked={profile.receives_interest} onChange={v => updateField('receives_interest', v)}
              label="이자 수입" desc="→ PPh 23 15% / PPh 4(2)" />
            <Checkbox checked={profile.receives_royalties} onChange={v => updateField('receives_royalties', v)}
              label="로열티 수입" desc="→ PPh 23 15% (국내) / PPh 26 (국외)" />
            <Checkbox checked={profile.has_franchise} onChange={v => updateField('has_franchise', v)}
              label="프랜차이즈 사업" desc="→ PPh 23 로열티" />
            <Checkbox checked={profile.sells_property} onChange={v => updateField('sells_property', v)}
              label="부동산 매매/양도" desc="→ PPh 4(2) Final 2.5%" />
            <Checkbox checked={profile.has_shipping_business} onChange={v => updateField('has_shipping_business', v)}
              label="해운/항공 운송" desc="→ PPh 15" />
          </div>
        </Section>

        {/* Section 5: Construction (conditional) */}
        {(profile.business_category === 'CONSTRUCTION' || profile.has_construction_sbu) && (
          <Section id="construction" title="건설업 상세 (Konstruksi)" icon={Building2} badge="PPh 4(2)">
            <Checkbox checked={profile.has_construction_sbu} onChange={v => updateField('has_construction_sbu', v)}
              label="SBU (Sertifikat Badan Usaha) 보유" desc="PP 9/2022 건설 PPh Final 세율 결정" />
            {profile.has_construction_sbu && (
              <div className="grid grid-cols-3 gap-2 ml-6">
                <div>
                  <Label className="text-[10px]">SBU 등급</Label>
                  <select value={profile.sbu_qualification || ''} onChange={e => updateField('sbu_qualification', e.target.value || null)}
                    className="w-full h-8 px-2 rounded border text-xs">
                    <option value="">선택</option>
                    <option value="SMALL">Kecil (1.75%)</option>
                    <option value="MEDIUM">Menengah (2.65%)</option>
                    <option value="LARGE">Besar (4%)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">SBU 번호</Label>
                  <Input value={profile.sbu_number || ''} className="h-8 text-xs font-mono"
                    onChange={e => updateField('sbu_number', e.target.value || null)} />
                </div>
                <div>
                  <Label className="text-[10px]">만료일</Label>
                  <Input type="date" value={profile.sbu_expires_at || ''} className="h-8 text-xs"
                    onChange={e => updateField('sbu_expires_at', e.target.value || null)} />
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Section 6: F&B (conditional) */}
        {(profile.business_category === 'FNB_RESTAURANT' || profile.business_category === 'FNB_CATERING' || profile.is_restaurant || profile.is_catering) && (
          <Section id="fnb" title="F&B 상세" icon={Utensils}>
            <Checkbox checked={profile.is_restaurant} onChange={v => updateField('is_restaurant', v)}
              label="식당 운영 (Restoran)" desc="지역세(Pajak Restoran) 적용, PPN 면제" />
            <Checkbox checked={profile.is_catering} onChange={v => updateField('is_catering', v)}
              label="케이터링 서비스 (Jasa Katering)" desc="PPh 23 2% 원천징수 대상" />
          </Section>
        )}

        {/* AI Questions */}
        {profile.ai_profile_questions && profile.ai_profile_questions.length > 0 && (
          <Section id="ai" title="AI 추가 질문" icon={Sparkles}>
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
                    placeholder="답변을 입력하세요"
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
          저장 및 신고 준비
        </Button>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          저장 시 세금 체제가 자동 판정됩니다. 필수 정보가 모두 입력되면 대시보드로 이동합니다.
        </p>
      </div>
    </div>
  );
}
