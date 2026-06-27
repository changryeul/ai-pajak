'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import {
  Building2, ArrowLeft, ArrowRight, ShieldCheck, FileCheck2,
  Search, X, Loader2, CheckCircle, Camera, Sparkles,
} from 'lucide-react';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature/SignaturePad';
import { createClient } from '@/lib/supabase/client';

interface KbliCode {
  code: string;
  description: string;
  category: string | null;
}

const JTC_AGREEMENT_VERSION = 'v1.0';

function formatNpwp(value: string): string {
  // Strip non-digits, limit to 15 digits (corporate NPWP format)
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 9) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`;
}

function isValidNpwp(formatted: string): boolean {
  return formatted.replace(/\D/g, '').length === 15;
}

export default function CompanyRegisterPage() {
  const t = useTranslations('companyRegister');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const STEPS = [
    { id: 1, title: t('step1Title'), desc: t('step1Desc') },
    { id: 2, title: t('step2Title'), desc: t('step2Desc') },
    { id: 3, title: t('step3Title'), desc: t('step3Desc') },
    { id: 4, title: t('step4Title'), desc: t('step4Desc') },
    { id: 5, title: t('step5Title'), desc: t('step5Desc') },
  ];

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  // 2026-06-27: NPWP 사진 → 회사명/NPWP/주소 자동 채움 (3 필드 한 번에).
  // /company-profile 의 handleNpwpOcr 패턴을 가입 흐름으로 이식.
  // /api/public/npwp-ocr 가 unauthenticated + rate-limited.
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const runNpwpOcr = async (file: File) => {
    setOcrBusy(true);
    setOcrMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/public/npwp-ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success && (data.data?.npwp || data.data?.name)) {
        if (data.data.npwp) setNpwp(formatNpwp(data.data.npwp));
        if (data.data.name) setCompanyName((prev) => prev || data.data.name);
        if (data.data.address) setAddress((prev) => prev || data.data.address);
        const conf = Math.round((data.data.confidence || 0) * 100);
        setOcrMsg({ type: 'ok', text: `NPWP 자동 인식 완료 (${conf}%)` });
      } else if (res.status === 429) {
        setOcrMsg({ type: 'err', text: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      } else {
        setOcrMsg({ type: 'err', text: 'NPWP 인식 실패 — 직접 입력해 주세요.' });
      }
    } catch {
      setOcrMsg({ type: 'err', text: 'NPWP 인식 실패 — 직접 입력해 주세요.' });
    } finally {
      setOcrBusy(false);
    }
  };

  // Step 2: Tax profile
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [revenueYear, setRevenueYear] = useState(String(new Date().getFullYear() - 1));
  const [hasEmployees, setHasEmployees] = useState(false);
  const [employeeCount, setEmployeeCount] = useState('');
  const [isPkp, setIsPkp] = useState(false);
  const [paysServiceFees, setPaysServiceFees] = useState(false);
  const [hasImportExport, setHasImportExport] = useState(false);
  const [hasRentalBusiness, setHasRentalBusiness] = useState(false);

  // Step 3: KBLI + 사업 카테고리
  const [kbliSearch, setKbliSearch] = useState('');
  const [kbliResults, setKbliResults] = useState<KbliCode[]>([]);
  const [selectedKblis, setSelectedKblis] = useState<KbliCode[]>([]);
  const [primaryKbli, setPrimaryKbli] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  // 2026-06-27: business_category 는 /api/company-profile 의 completeness 가중치
  // 2짜리 필수 항목인데 register 가 안 받아서 가입 직후 무조건 -17%p. step3 에
  // 라디오 한 줄 추가로 흡수. KBLI 와 같은 step 에 둬서 step 수는 그대로.
  const [businessCategory, setBusinessCategory] = useState<string>('');

  // Step 3: Terms
  const [agreeJtc, setAgreeJtc] = useState(false);
  const [agreeData, setAgreeData] = useState(false);
  const [agreeTaxFiling, setAgreeTaxFiling] = useState(false);
  // (선택) 신용도 분석 데이터 활용 동의
  const [agreeCredit, setAgreeCredit] = useState(false);
  // 서명 패드 (법인 대표 서명)
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureError, setSignatureError] = useState('');

  // Step 4: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // KBLI search (debounced)
  useEffect(() => {
    if (kbliSearch.length < 2) {
      setKbliResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/reference/kbli?q=${encodeURIComponent(kbliSearch)}`);
        const data = await res.json();
        if (data.success) setKbliResults(data.data || []);
      } catch { /* */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [kbliSearch]);

  const addKbli = (kbli: KbliCode) => {
    if (selectedKblis.some(k => k.code === kbli.code)) return;
    setSelectedKblis(prev => [...prev, kbli]);
    if (selectedKblis.length === 0) setPrimaryKbli(kbli.code);
    setKbliSearch('');
    setKbliResults([]);
  };

  const removeKbli = (code: string) => {
    setSelectedKblis(prev => prev.filter(k => k.code !== code));
    if (primaryKbli === code) {
      const remaining = selectedKblis.filter(k => k.code !== code);
      setPrimaryKbli(remaining[0]?.code || null);
    }
  };

  const canProceedStep1 = companyName && isValidNpwp(npwp) && representativeName;
  const canProceedStep2 = true; // tax profile is optional but recommended
  const canProceedStep3 = selectedKblis.length > 0 && primaryKbli && !!businessCategory;
  // Step 4 — required consents AND signature must be present.
  // Credit-analysis consent is optional, so it is intentionally excluded.
  const canProceedStep4 = agreeJtc && agreeData && agreeTaxFiling && hasSignature;

  // Master "agree to all" checkbox derived state — checked when every required+optional item is on.
  const allAgreed = agreeJtc && agreeData && agreeTaxFiling && agreeCredit;
  const handleAgreeAll = (next: boolean) => {
    setAgreeJtc(next);
    setAgreeData(next);
    setAgreeTaxFiling(next);
    setAgreeCredit(next);
  };
  const canSubmit = email && password && password === confirmPassword && password.length >= 8;

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      // Server-side signup (bypasses client signUp → setup-account race condition)
      const res = await fetch('/api/auth/signup-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: representativeName,
          phone,
          companyName,
          npwp,
          address,
          kbliCodes: selectedKblis.map(k => k.code),
          primaryKbli,
          businessCategory: businessCategory || null,
          taxProfile: {
            annualRevenue: annualRevenue ? Number(annualRevenue) : undefined,
            revenueYear: revenueYear ? Number(revenueYear) : undefined,
            hasEmployees,
            employeeCount: employeeCount ? Number(employeeCount) : undefined,
            isPkp,
            paysServiceFees,
            hasImportExport,
            hasRentalBusiness,
          },
          jtcAgreement: {
            accepted: agreeJtc,
            version: JTC_AGREEMENT_VERSION,
            dataProcessing: agreeData,
            taxFilingAuthorization: agreeTaxFiling,
            creditAnalysis: agreeCredit,
          },
          signatureDataUrl: signatureRef.current?.getDataUrl() ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('errSignupFailed'));
        return;
      }

      // 2026-06-27: INDIVIDUAL flow 와 동일하게 자동 로그인 후 company-profile
      // 로 직접 안내. 그래야 사용자가 가입 직후 회사 정보 30+ 추가 필드를
      // 채우러 자연스럽게 진입함. signIn 실패 시에는 기존 success 화면으로
      // fallback (사용자가 수동 로그인).
      try {
        const supabase = createClient();
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInErr) {
          router.push(`/${locale}/company-profile?welcome=1`);
          router.refresh();
          return;
        }
      } catch {
        /* fall through to success card */
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl text-green-700">{t('successTitle')}</CardTitle>
            <CardDescription className="mt-2 text-xs">
              <p>{t('successLinkSent', { email })}</p>
              <p className="mt-1">{t('successAdvisor')}</p>
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} className="w-full">{t('successLoginCta')}</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 p-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('heading')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subheading')}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s.id ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
                </div>
                <p className={`text-[10px] mt-1 text-center ${step >= s.id ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {s.title}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${step > s.id ? 'bg-emerald-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50">
            <CardTitle className="text-lg">{STEPS[step - 1].title}</CardTitle>
            <CardDescription className="text-xs">{STEPS[step - 1].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {/* Step 1: Company info */}
            {step === 1 && (
              <>
                {/* NPWP OCR — 사진 한 장이면 회사명·NPWP·주소 자동 채움 */}
                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900">NPWP 사진으로 자동 채우기 (선택)</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        법인 NPWP 카드 사진 한 장 → 회사명·NPWP·주소 자동 인식.
                      </p>
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
                          NPWP 사진 업로드
                        </Button>
                        <input
                          ref={ocrFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void runNpwpOcr(f);
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

                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldCompanyName')}</label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="PT Contoh Sejahtera" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldNpwp')}</label>
                  <Input value={npwp} onChange={e => setNpwp(formatNpwp(e.target.value))}
                    placeholder="00.000.000.0-000.000" className="font-mono" required />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t('npwpCounter', { have: npwp.replace(/\D/g, '').length, check: isValidNpwp(npwp) ? '✓' : '' })}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1">
                    {t('npwpLoginHint')}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldRepresentative')}</label>
                  <Input value={representativeName} onChange={e => setRepresentativeName(e.target.value)}
                    placeholder="Nama Direktur" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldPhone')}</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+62 21 1234 5678" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldAddress')}</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Jl. Example No. 1, Jakarta" />
                </div>
              </>
            )}

            {/* Step 2: Tax profile */}
            {step === 2 && (
              <>
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                  <p className="font-medium">{t('taxProfileTitle')}</p>
                  <p className="mt-1">
                    {t('taxProfileNote')}
                  </p>
                </div>

                {/* Annual revenue */}
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldAnnualRevenue')}</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={annualRevenue}
                      onChange={e => setAnnualRevenue(e.target.value)}
                      placeholder={t('revenuePlaceholder')}
                      className="font-mono flex-1"
                    />
                    <Input
                      type="number"
                      value={revenueYear}
                      onChange={e => setRevenueYear(e.target.value)}
                      placeholder={t('yearPlaceholder')}
                      className="w-24"
                    />
                  </div>
                  {annualRevenue && Number(annualRevenue) < 4_800_000_000 && (
                    <p className="text-[11px] text-green-600 mt-1">
                      {t('umkmHint')}
                    </p>
                  )}
                </div>

                {/* Employees */}
                <div className="border rounded-lg p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasEmployees} onChange={e => setHasEmployees(e.target.checked)} className="accent-emerald-600" />
                    <div>
                      <span className="text-sm font-medium">{t('hasEmployees')}</span>
                      <p className="text-[11px] text-gray-500">{t('hasEmployeesNote')}</p>
                    </div>
                  </label>
                  {hasEmployees && (
                    <div className="ml-6">
                      <Input
                        type="number"
                        value={employeeCount}
                        onChange={e => setEmployeeCount(e.target.value)}
                        placeholder={t('employeeCountPlaceholder')}
                        className="w-32 h-8 text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* PKP */}
                <div className="border rounded-lg p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isPkp} onChange={e => setIsPkp(e.target.checked)} className="accent-emerald-600" />
                    <div>
                      <span className="text-sm font-medium">{t('isPkp')}</span>
                      <p className="text-[11px] text-gray-500">
                        {t('isPkpNote')}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Additional activities */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">{t('moreInfo')}</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={paysServiceFees} onChange={e => setPaysServiceFees(e.target.checked)} className="accent-emerald-600" />
                      <div className="text-xs">
                        <span className="font-medium">{t('paysServiceFees')}</span>
                        <p className="text-gray-500 text-[11px]">{t('paysServiceFeesNote')}</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={hasImportExport} onChange={e => setHasImportExport(e.target.checked)} className="accent-emerald-600" />
                      <div className="text-xs">
                        <span className="font-medium">{t('hasImportExport')}</span>
                        <p className="text-gray-500 text-[11px]">{t('hasImportExportNote')}</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={hasRentalBusiness} onChange={e => setHasRentalBusiness(e.target.checked)} className="accent-emerald-600" />
                      <div className="text-xs">
                        <span className="font-medium">{t('hasRental')}</span>
                        <p className="text-gray-500 text-[11px]">{t('hasRentalNote')}</p>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: KBLI + 사업 카테고리 */}
            {step === 3 && (
              <>
                {/* 카테고리 — completeness 가중치 2짜리 필수 항목 */}
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t('bizCategoryQuestion')} <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t('bizCategoryHint')}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[
                      { v: 'SERVICE',           ko: '서비스',        id: 'Jasa',                tax: 'PPh 23 2%' },
                      { v: 'TRADING',           ko: '도소매',        id: 'Perdagangan',         tax: 'PPh 22' },
                      { v: 'MANUFACTURING',     ko: '제조',          id: 'Manufaktur',          tax: 'PPh 22' },
                      { v: 'CONSTRUCTION',      ko: '건설',          id: 'Konstruksi',          tax: 'PPh 4(2)' },
                      { v: 'REAL_ESTATE',       ko: '부동산',        id: 'Real Estat',          tax: 'PPh 4(2) 2.5%' },
                      { v: 'FNB_RESTAURANT',    ko: '식음료(매장)',  id: 'Restoran',            tax: 'PB1' },
                      { v: 'FNB_CATERING',      ko: '케이터링',      id: 'Katering',            tax: 'PPh 23 2%' },
                      { v: 'TRANSPORTATION',    ko: '운송',          id: 'Transportasi',        tax: 'PPh 15' },
                      { v: 'MINING',            ko: '광업',          id: 'Pertambangan',        tax: 'PPh 22 Mining' },
                      { v: 'DIGITAL_PLATFORM',  ko: '디지털 플랫폼', id: 'Platform Digital',    tax: 'PPN PMSE' },
                      { v: 'OTHER',             ko: '기타',          id: 'Lainnya',             tax: '—' },
                    ].map((c) => {
                      const active = businessCategory === c.v;
                      return (
                        <button
                          key={c.v}
                          type="button"
                          onClick={() => setBusinessCategory(c.v)}
                          className={`text-left p-2 rounded-lg border text-[11px] transition ${
                            active
                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                              : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                          }`}
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-semibold text-gray-900">{c.ko}</span>
                            <span className="text-gray-500">/ {c.id}</span>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-0.5">{c.tax}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                  <p className="font-medium">{t('kbliAboutTitle')}</p>
                  <p className="mt-1">
                    {t('kbliAbout')}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">{t('kbliSearchLabel')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={kbliSearch} onChange={e => setKbliSearch(e.target.value)}
                      placeholder={t('kbliSearchPlaceholder')} className="pl-9" />
                  </div>
                  {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-2" />}
                  {kbliResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                      {kbliResults.map(k => (
                        <button
                          key={k.code}
                          type="button"
                          onClick={() => addKbli(k)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="font-mono text-xs font-bold text-emerald-700">{k.code}</span>
                          <span className="text-xs text-gray-700 flex-1 truncate">{k.description}</span>
                          {k.category && <span className="text-[9px] text-gray-400">{k.category}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedKblis.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-700">{t('kbliSelectedLabel', { count: selectedKblis.length })}</label>
                    <div className="mt-2 space-y-2">
                      {selectedKblis.map(k => (
                        <div key={k.code} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                          <input
                            type="radio"
                            name="primary"
                            checked={primaryKbli === k.code}
                            onChange={() => setPrimaryKbli(k.code)}
                            className="accent-emerald-600"
                          />
                          <span className="font-mono text-xs font-bold text-emerald-700">{k.code}</span>
                          <span className="text-xs text-gray-800 flex-1 truncate">{k.description}</span>
                          {primaryKbli === k.code && (
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">{t('kbliPrimaryBadge')}</span>
                          )}
                          <button type="button" onClick={() => removeKbli(k.code)}>
                            <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-500">{t('kbliPrimaryHint')}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 4: Mandate + Terms (combined consent page) */}
            {step === 4 && (
              <>
                {/* Master "agree to all" toggle */}
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer bg-blue-50 border-blue-200">
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => handleAgreeAll(e.target.checked)}
                    className="accent-blue-600 h-4 w-4"
                  />
                  <span className="text-sm font-bold text-blue-900">{t('consentMasterLabel')}</span>
                </label>

                {/* Mandate contents */}
                <div className="border rounded-lg p-4 bg-gray-50 text-xs text-gray-700 space-y-2">
                  <p className="font-bold text-sm text-gray-900">{t('mandateContentsTitle')}</p>
                  <p>
                    {t('mandateContentsLine', {
                      companyName: companyName || '________',
                      npwp: npwp || '________',
                    })}
                  </p>
                  <ul className="list-disc ml-5 space-y-0.5">
                    <li>{t('mandateContentsItem1')}</li>
                    <li>{t('mandateContentsItem2')}</li>
                    <li>{t('mandateContentsItem3')}</li>
                    <li>{t('mandateContentsItem4')}</li>
                  </ul>
                  <p>{t('mandateContentsAi')}</p>
                  <p>{t('mandateContentsResp')}</p>
                  <p>{t('mandateContentsLiability')}</p>
                </div>

                {/* Terms contents */}
                <div className="border rounded-lg p-4 bg-gray-50 text-xs text-gray-700 space-y-2">
                  <p className="font-bold text-sm text-gray-900">{t('termsContentsTitle')}</p>
                  <p>{t('termsArticle1')}</p>
                  <p>{t('termsArticle2')}</p>
                  <p>{t('termsArticle3')}</p>
                  <p>{t('termsArticle4')}</p>
                  <p>{t('termsArticle5')}</p>
                </div>

                {/* Required + optional consents (3 boxes) */}
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeJtc && agreeData} onChange={e => {
                    setAgreeJtc(e.target.checked);
                    setAgreeData(e.target.checked);
                  }}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">{t('agreeMandateLabel')}</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeTaxFiling} onChange={e => setAgreeTaxFiling(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">{t('agreeTermsLabel')}</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeCredit} onChange={e => setAgreeCredit(e.target.checked)}
                    className="mt-0.5 accent-amber-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">{t('agreeCreditLabel')}</p>
                    <p className="text-amber-600 mt-1">{t('agreeCreditHint')}</p>
                  </div>
                </label>

                {/* Signature pad */}
                <div className="border rounded-lg p-4 bg-white">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    {t('signatureSectionLabel')} <span className="text-red-500">*</span>
                  </p>
                  <SignaturePad
                    ref={signatureRef}
                    width={520}
                    height={140}
                    onChange={(has) => {
                      setHasSignature(has);
                      if (has) setSignatureError('');
                    }}
                    clearLabel={t('signatureClearLabel')}
                  />
                  {signatureError && (
                    <p className="text-xs text-red-600 mt-1">{signatureError}</p>
                  )}
                </div>
              </>
            )}

            {/* Step 5: Account */}
            {step === 5 && (
              <>
                <div className="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  <span>{t('finalStepLead')}</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldEmail')}</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="contact@yourcompany.co.id" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldPassword')}</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">{t('fieldConfirmPassword')}</label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('confirmPlaceholder')} required />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-red-500 mt-1">{t('passwordMismatch')}</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">{t('loginMethodsTitle')}</p>
                  <ul className="space-y-0.5">
                    <li>• <span className="font-mono">{npwp || 'NPWP'}</span> (NPWP)</li>
                    <li>• <span className="font-mono">{email || 'email@...'}</span> {t('loginMethodEmail')}</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-3">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-1" />{t('previousCta')}
              </Button>
            ) : (
              <Link href={`/${locale}/register`}>
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-1" />{t('goToIndividual')}
                </Button>
              </Link>
            )}

            {step < 5 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3) ||
                  (step === 4 && !canProceedStep4)
                }
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-sm"
              >
                {t('nextCta')}<ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-sm"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                {t('submitCta')}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
