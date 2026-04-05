'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import {
  Building2, ArrowLeft, ArrowRight, ShieldCheck, FileCheck2,
  Search, X, Loader2, CheckCircle,
} from 'lucide-react';

interface KbliCode {
  code: string;
  description: string;
  category: string | null;
}

const JTC_AGREEMENT_VERSION = 'v1.0';

const STEPS = [
  { id: 1, title: '회사 정보', desc: 'NPWP 및 기본 정보' },
  { id: 2, title: '업종(KBLI) 등록', desc: '사업 업종 선택' },
  { id: 3, title: '약관 동의', desc: 'JTC 세무 대행 동의' },
  { id: 4, title: '계정 생성', desc: '이메일 및 비밀번호' },
];

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
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

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

  // Step 2: KBLI
  const [kbliSearch, setKbliSearch] = useState('');
  const [kbliResults, setKbliResults] = useState<KbliCode[]>([]);
  const [selectedKblis, setSelectedKblis] = useState<KbliCode[]>([]);
  const [primaryKbli, setPrimaryKbli] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Step 3: Terms
  const [agreeJtc, setAgreeJtc] = useState(false);
  const [agreeData, setAgreeData] = useState(false);
  const [agreeTaxFiling, setAgreeTaxFiling] = useState(false);

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
  const canProceedStep2 = selectedKblis.length > 0 && primaryKbli;
  const canProceedStep3 = agreeJtc && agreeData && agreeTaxFiling;
  const canSubmit = email && password && password === confirmPassword && password.length >= 8;

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: representativeName,
            phone,
            account_type: 'COMPANY',
            company_name: companyName,
            npwp,
          },
          emailRedirectTo: `${window.location.origin}/${locale}/dashboard`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Setup company account with all details
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'COMPANY',
          fullName: representativeName,
          phone,
          companyName,
          npwp,
          address,
          kbliCodes: selectedKblis.map(k => k.code),
          primaryKbli,
          jtcAgreement: {
            accepted: agreeJtc,
            version: JTC_AGREEMENT_VERSION,
            dataProcessing: agreeData,
            taxFilingAuthorization: agreeTaxFiling,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '가입 처리 중 오류가 발생했습니다');
        return;
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
            <CardTitle className="text-xl text-green-700">가입이 완료되었습니다</CardTitle>
            <CardDescription className="mt-2 text-xs">
              <p>이메일({email})로 확인 링크가 발송되었습니다.</p>
              <p className="mt-1">담당 세무사가 곧 연락드릴 예정입니다.</p>
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} className="w-full">로그인 페이지로</Button>
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
          <h1 className="text-2xl font-bold text-gray-900">법인 고객 가입</h1>
          <p className="text-sm text-gray-500 mt-1">Jakarta Tax Consulting과 함께 세무를 관리하세요</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{STEPS[step - 1].title}</CardTitle>
            <CardDescription className="text-xs">{STEPS[step - 1].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {/* Step 1: Company info */}
            {step === 1 && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700">법인명 (Nama Perusahaan)</label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="PT Contoh Sejahtera" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">법인 NPWP (15자리)</label>
                  <Input value={npwp} onChange={e => setNpwp(formatNpwp(e.target.value))}
                    placeholder="00.000.000.0-000.000" className="font-mono" required />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {npwp.replace(/\D/g, '').length}/15자리 {isValidNpwp(npwp) && '✓'}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1">
                    💡 NPWP는 로그인 시 이메일 대신 사용할 수 있습니다
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">대표자 이름</label>
                  <Input value={representativeName} onChange={e => setRepresentativeName(e.target.value)}
                    placeholder="Nama Direktur" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">회사 전화번호 (선택)</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+62 21 1234 5678" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">회사 주소 (선택)</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Jl. Example No. 1, Jakarta" />
                </div>
              </>
            )}

            {/* Step 2: KBLI */}
            {step === 2 && (
              <>
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                  <p className="font-medium">KBLI란?</p>
                  <p className="mt-1">
                    Klasifikasi Baku Lapangan Usaha Indonesia — 법인의 사업 업종 분류 코드(5자리)입니다.
                    세율 결정과 SPT 작성에 사용되므로 **정확하게 선택**해주세요. 여러 개 선택 가능합니다.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">업종 검색 (코드 또는 설명)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={kbliSearch} onChange={e => setKbliSearch(e.target.value)}
                      placeholder="예: 62010, Computer Programming, IT" className="pl-9" />
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
                    <label className="text-xs font-medium text-gray-700">선택된 업종 ({selectedKblis.length}개)</label>
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
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">주업종</span>
                          )}
                          <button type="button" onClick={() => removeKbli(k.code)}>
                            <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-500">라디오 버튼으로 주업종을 선택하세요</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Terms */}
            {step === 3 && (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-start gap-3 mb-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-blue-900">AI Pajak × Jakarta Tax Consulting</p>
                      <p className="text-xs text-blue-700 mt-1">
                        AI Pajak은 세무 신고를 <b>합법적으로 대행</b>하기 위해 인도네시아 공인 세무 컨설팅 법인인
                        <b> Jakarta Tax Consulting (JTC)</b>과 협업합니다.
                        모든 SPT 제출은 JTC의 공인 세무사가 검토·서명 후 DJP에 제출됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeJtc} onChange={e => setAgreeJtc(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">
                      JTC 세무 대행 서비스 약관에 동의합니다 <span className="text-red-500">*</span>
                    </p>
                    <p className="text-gray-500 mt-1">
                      AI Pajak을 통해 제공되는 모든 세무 서비스는 JTC와 본 고객 간 대행 계약에 따라 수행됩니다.
                      상세 약관 버전 {JTC_AGREEMENT_VERSION} 적용.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeData} onChange={e => setAgreeData(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">
                      개인정보 및 재무정보 처리에 동의합니다 <span className="text-red-500">*</span>
                    </p>
                    <p className="text-gray-500 mt-1">
                      NPWP, 재무제표, 거래내역 등이 세무 계산·신고 목적으로 처리됩니다.
                      JTC 외 제3자에게 제공되지 않습니다.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreeTaxFiling} onChange={e => setAgreeTaxFiling(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">
                      JTC에 세무 신고 대행 권한을 위임합니다 <span className="text-red-500">*</span>
                    </p>
                    <p className="text-gray-500 mt-1">
                      JTC 공인 세무사가 본인을 대리하여 DJP에 SPT Masa / SPT Tahunan을 제출할 수 있도록
                      위임합니다. 모든 제출 전에 본인 확인 단계가 포함됩니다.
                    </p>
                  </div>
                </label>
              </>
            )}

            {/* Step 4: Account */}
            {step === 4 && (
              <>
                <div className="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  <span>마지막 단계입니다. 이메일과 비밀번호를 설정하세요.</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">이메일 (알림/비밀번호 재설정용)</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="contact@yourcompany.co.id" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">비밀번호</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="최소 8자" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">비밀번호 확인</label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="다시 입력" required />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <p className="font-medium mb-1">로그인 시 사용 가능:</p>
                  <ul className="space-y-0.5">
                    <li>• <span className="font-mono">{npwp || 'NPWP'}</span> (NPWP)</li>
                    <li>• <span className="font-mono">{email || 'email@...'}</span> (이메일)</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-3">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-1" />이전
              </Button>
            ) : (
              <Link href={`/${locale}/register`}>
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-1" />유형 선택으로
                </Button>
              </Link>
            )}

            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3)
                }
              >
                다음<ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                가입 완료
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
