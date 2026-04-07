'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Store, Calculator, CheckCircle, AlertTriangle, ArrowRight,
  ArrowLeft, Sparkles, Shield, HelpCircle, Loader2,
  Building2, DollarSign, Calendar,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

// ── Constants ──
const UMKM_RATE = 0.005;          // PPh Final 0.5%
const EXEMPTION = 500_000_000;    // Rp 500M/year exemption (PP 55/2022)
const THRESHOLD = 4_800_000_000;  // Rp 4.8B annual revenue threshold
const CORPORATE_RATE = 0.22;      // PPh Badan 22%
const SME_DISCOUNT = 0.50;        // 50% discount for revenue < 50B

// ── Regime types ──
type TaxRegime = 'UMKM_FINAL' | 'PPH25_GENERAL' | 'PPH25_NEW' | 'PPH25_LOSS' | null;

interface RegimeResult {
  regime: TaxRegime;
  title: string;
  description: string;
  monthlyAmount: number;
  annualEstimate: number;
  legalBasis: string;
  color: string;
}

export default function CorporateTaxPage() {
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  // Wizard state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Company profile (pre-loaded if available)
  const [companyName, setCompanyName] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [establishedYear, setEstablishedYear] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [isUmkm, setIsUmkm] = useState<boolean | null>(null);
  const [umkmStartYear, setUmkmStartYear] = useState('');

  // Step 3: Previous year tax data (for PPh 25 calculation)
  const [lastYearTaxPaid, setLastYearTaxPaid] = useState('');
  const [lastYearTaxCredits, setLastYearTaxCredits] = useState('');
  const [hadFiscalLoss, setHadFiscalLoss] = useState(false);

  // Step 4: UMKM monthly revenue
  const [monthlyRevenues, setMonthlyRevenues] = useState<number[]>(Array(12).fill(0));

  // Result
  const [result, setResult] = useState<RegimeResult | null>(null);

  // Load company profile
  useEffect(() => {
    if (!session?.customerId) return;
    fetch(`/api/company-profile?customerId=${session.customerId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const p = d.data;
          setCompanyName(p.company_name || '');
          if (p.annual_revenue) setAnnualRevenue(String(p.annual_revenue));
          if (p.established_year) setEstablishedYear(String(p.established_year));
          if (p.legal_form) setLegalForm(p.legal_form);
          if (p.is_umkm !== undefined) setIsUmkm(p.is_umkm);
          if (p.umkm_final_tax_start_year) setUmkmStartYear(String(p.umkm_final_tax_start_year));
        }
      })
      .catch(() => {});
  }, [session?.customerId]);

  // Auto-determine regime
  const determineRegime = (): RegimeResult => {
    const revenue = Number(annualRevenue) || 0;
    const estYear = Number(establishedYear) || 0;
    const yearsOperating = estYear > 0 ? currentYear - estYear : 0;
    const umkmStart = Number(umkmStartYear) || 0;
    const maxUmkmYears = ['PT'].includes(legalForm) ? 4 : ['CV', 'FIRMA'].includes(legalForm) ? 4 : 7;
    const umkmYearsUsed = umkmStart > 0 ? currentYear - umkmStart : 0;

    // Case 1: New company (< 2 years)
    if (yearsOperating < 2 && !isUmkm) {
      return {
        regime: 'PPH25_NEW',
        title: '신설 법인 — PPh 25 면제',
        description: `설립 ${yearsOperating}년차. 신설 법인은 첫 2년간 PPh 25 납부 의무가 없습니다. 다만 사업 소득이 발생하면 연말 SPT Tahunan에서 정산합니다.`,
        monthlyAmount: 0,
        annualEstimate: 0,
        legalBasis: 'PMK 215/PMK.03/2018 — 신설 법인 PPh 25 면제',
        color: 'blue',
      };
    }

    // Case 2: UMKM (revenue < 4.8B, registered, period not expired)
    if (isUmkm && revenue > 0 && revenue < THRESHOLD && umkmYearsUsed < maxUmkmYears) {
      const taxableRevenue = Math.max(revenue - EXEMPTION, 0);
      const annualTax = Math.round(taxableRevenue * UMKM_RATE);
      return {
        regime: 'UMKM_FINAL',
        title: 'PPh Final UMKM — 0.5%',
        description: `연매출 ${fmtRp(revenue)} (< ${fmtRp(THRESHOLD)}). PP 55/2022 등록 ${umkmYearsUsed}/${maxUmkmYears}년차. 월 매출에서 연 ${fmtRp(EXEMPTION)} 비과세 공제 후 0.5% 납부.`,
        monthlyAmount: Math.round(annualTax / 12),
        annualEstimate: annualTax,
        legalBasis: 'PP 55/2022 & PMK 164/2023 — UMKM PPh Final 0.5%',
        color: 'green',
      };
    }

    // Case 3: Fiscal loss last year
    if (hadFiscalLoss) {
      return {
        regime: 'PPH25_LOSS',
        title: 'PPh 25 — 전기 결손',
        description: '전년도 세무 결손(rugi fiskal)이 있으므로 PPh 25 분할 납부액이 0원입니다. 올해 이익이 발생하면 연말 SPT Tahunan에서 정산됩니다.',
        monthlyAmount: 0,
        annualEstimate: 0,
        legalBasis: 'Pasal 25 UU PPh — 결손 이월 시 PPh 25 = 0',
        color: 'amber',
      };
    }

    // Case 4: General PPh 25 (revenue ≥ 4.8B or UMKM expired)
    const lastTax = Number(lastYearTaxPaid) || 0;
    const credits = Number(lastYearTaxCredits) || 0;
    const netTax = Math.max(lastTax - credits, 0);
    const monthly = Math.round(netTax / 12);

    let desc = '';
    if (revenue >= THRESHOLD) {
      desc = `연매출 ${fmtRp(revenue)} (≥ ${fmtRp(THRESHOLD)}). 일반 PPh Badan 22% 적용.`;
    } else if (isUmkm && umkmYearsUsed >= maxUmkmYears) {
      desc = `UMKM PPh Final 기간 만료 (${maxUmkmYears}년 한도 초과). 일반 PPh Badan으로 전환.`;
    } else {
      desc = 'UMKM 미등록. 일반 PPh Badan 22% 적용.';
    }

    if (lastTax > 0) {
      desc += ` 전년 PPh Badan ${fmtRp(lastTax)} - 세액공제 ${fmtRp(credits)} = 월 ${fmtRp(monthly)}.`;
    } else {
      desc += ' 전년 SPT Tahunan 데이터를 입력하면 정확한 월 분할액을 계산합니다.';
    }

    return {
      regime: 'PPH25_GENERAL',
      title: 'PPh 25 — 일반 법인세 월 분할',
      description: desc,
      monthlyAmount: monthly,
      annualEstimate: netTax,
      legalBasis: 'Pasal 25 UU PPh — (전년 PPh Badan - 세액공제) ÷ 12',
      color: 'indigo',
    };
  };

  const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          선납 법인세 (PPh 25 / PPh Final UMKM)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          우리 회사에 맞는 법인세 납부 방식을 단계별로 안내합니다
        </p>
      </div>

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-bold mb-1">법인세 납부는 회사 상황에 따라 다릅니다</p>
            <ul className="space-y-1 text-blue-800">
              <li>• <b>신설 법인</b> (2년 미만): PPh 25 납부 의무 없음</li>
              <li>• <b>소규모 법인</b> (연매출 48억 미만, UMKM 등록): 매월 매출의 <b>0.5%</b>만 납부 (PPh Final)</li>
              <li>• <b>일반 법인</b> (연매출 48억 이상): 전년도 세금을 12등분하여 매월 분할 납부 (PPh 25)</li>
              <li>• <b>전기 결손</b>: PPh 25 = 0원 (연말 정산으로 대체)</li>
            </ul>
            <p className="mt-2 text-blue-600">아래 질문에 답하면 우리 회사에 맞는 방식을 자동으로 판별합니다.</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        {[
          { id: 1, label: '기본 정보' },
          { id: 2, label: 'UMKM 확인' },
          { id: 3, label: '전년 세금' },
          { id: 4, label: '결과 확인' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}</div>
              <p className="text-[10px] mt-1">{s.label}</p>
            </div>
            {i < 3 && <div className={`h-0.5 flex-1 ${step > s.id ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              회사 기본 정보
            </h2>
            <p className="text-xs text-gray-500">회사 정보에서 자동으로 불러온 데이터입니다. 수정이 필요하면 변경하세요.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">회사명</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">법인 형태</Label>
                <select value={legalForm} onChange={e => setLegalForm(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  <option value="">선택하세요</option>
                  <option value="PT">PT (유한회사)</option>
                  <option value="CV">CV (합자회사)</option>
                  <option value="UD">UD (개인사업)</option>
                  <option value="FIRMA">Firma (합명회사)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">설립 연도</Label>
                <Input type="number" value={establishedYear} onChange={e => setEstablishedYear(e.target.value)}
                  placeholder="예: 2020" />
                {establishedYear && currentYear - Number(establishedYear) < 2 && (
                  <p className="text-[11px] text-blue-600 mt-1">💡 설립 2년 미만 → 신설 법인 PPh 25 면제 대상</p>
                )}
              </div>
              <div>
                <Label className="text-xs">연간 매출 (Rp) — 최근 1년</Label>
                <Input type="number" value={annualRevenue} onChange={e => setAnnualRevenue(e.target.value)}
                  placeholder="5000000000" className="font-mono" />
                {annualRevenue && Number(annualRevenue) < THRESHOLD && (
                  <p className="text-[11px] text-green-600 mt-1">✓ 48억 미만 → UMKM PPh Final 0.5% 대상 가능</p>
                )}
                {annualRevenue && Number(annualRevenue) >= THRESHOLD && (
                  <p className="text-[11px] text-indigo-600 mt-1">일반 PPh Badan 22% → PPh 25 월 분할 납부</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: UMKM check */}
      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Store className="h-5 w-5 text-green-600" />
              UMKM (소규모 사업자) 확인
            </h2>

            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
              <p className="font-bold mb-1">UMKM이란?</p>
              <p>연매출 48억 IDR 미만인 소규모 사업자입니다. PP 55/2022에 따라 매월 매출의 <b>0.5%</b>만 납부하면 됩니다 (일반 법인세 22%가 아님).</p>
              <p className="mt-1">단, PT는 <b>4년</b>, CV는 <b>4년</b>, 개인은 <b>7년</b> 한도로 적용됩니다.</p>
              <p className="mt-1">또한 연매출 <b>5억 IDR까지 비과세</b>입니다 (PP 55/2022 신규).</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">PP 55/2022 (UMKM PPh Final)에 등록하셨나요?</p>
              <div className="flex gap-3">
                <button onClick={() => setIsUmkm(true)}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                    isUmkm === true ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <CheckCircle className={`h-6 w-6 mx-auto mb-2 ${isUmkm === true ? 'text-green-600' : 'text-gray-300'}`} />
                  <p className="font-bold text-sm">예, 등록했습니다</p>
                  <p className="text-[10px] text-gray-500 mt-1">세무서에 PP 55 신청함</p>
                </button>
                <button onClick={() => setIsUmkm(false)}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                    isUmkm === false ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <AlertTriangle className={`h-6 w-6 mx-auto mb-2 ${isUmkm === false ? 'text-indigo-600' : 'text-gray-300'}`} />
                  <p className="font-bold text-sm">아니오 / 모르겠음</p>
                  <p className="text-[10px] text-gray-500 mt-1">일반 법인세로 진행</p>
                </button>
              </div>

              {isUmkm === true && (
                <div>
                  <Label className="text-xs">UMKM PPh Final 적용 시작 연도</Label>
                  <Input type="number" value={umkmStartYear} onChange={e => setUmkmStartYear(e.target.value)}
                    placeholder={`예: ${currentYear - 2}`} className="w-40" />
                  {umkmStartYear && (() => {
                    const maxYears = ['PT'].includes(legalForm) ? 4 : ['CV', 'FIRMA'].includes(legalForm) ? 4 : 7;
                    const used = currentYear - Number(umkmStartYear);
                    const remaining = maxYears - used;
                    return remaining > 0 ? (
                      <p className="text-[11px] text-green-600 mt-1">
                        ✓ {used}/{maxYears}년차 — 앞으로 {remaining}년 더 적용 가능
                      </p>
                    ) : (
                      <p className="text-[11px] text-red-600 mt-1">
                        ⚠️ {maxYears}년 한도 초과 — 내년부터 일반 PPh Badan으로 전환됩니다
                      </p>
                    );
                  })()}
                </div>
              )}

              {isUmkm === false && Number(annualRevenue) < THRESHOLD && Number(annualRevenue) > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
                  <p className="font-bold">💡 UMKM 등록을 추천합니다</p>
                  <p className="mt-1">
                    현재 연매출이 {fmtRp(Number(annualRevenue))}으로 48억 미만입니다.
                    PP 55/2022에 등록하면 법인세를 22%가 아닌 <b>0.5%</b>만 납부합니다.
                    JTC 컨설턴트에게 등록 대행을 요청하실 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Previous year tax (only for PPh 25 general) */}
      {step === 3 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              전년도 세금 정보
            </h2>

            {isUmkm ? (
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 inline mr-2" />
                UMKM으로 판별되었습니다. 전년도 세금 데이터가 필요 없습니다.
                <p className="text-xs mt-1">매월 매출에 0.5%를 적용하여 PPh Final을 계산합니다.</p>
              </div>
            ) : (
              <>
                <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
                  <p className="font-bold">PPh 25 계산 공식</p>
                  <p className="mt-1 font-mono">월 PPh 25 = (전년 PPh Badan − 세액공제) ÷ 12</p>
                  <p className="mt-1">전년도 SPT Tahunan(연간신고서)에 기재된 금액을 입력하세요. 모르면 0으로 두세요.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">전년 PPh Badan 납부액 (Rp)</Label>
                    <Input type="number" value={lastYearTaxPaid} onChange={e => setLastYearTaxPaid(e.target.value)}
                      placeholder="전년 SPT Tahunan의 PPh Badan" className="font-mono" />
                    <p className="text-[10px] text-gray-400 mt-1">SPT 1771 양식의 "PPh Terutang" 금액</p>
                  </div>
                  <div>
                    <Label className="text-xs">전년 세액공제 합계 (Rp)</Label>
                    <Input type="number" value={lastYearTaxCredits} onChange={e => setLastYearTaxCredits(e.target.value)}
                      placeholder="PPh 22 + PPh 23 + PPh 24 등" className="font-mono" />
                    <p className="text-[10px] text-gray-400 mt-1">원천징수당한 세액 합계</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={hadFiscalLoss} onChange={e => setHadFiscalLoss(e.target.checked)}
                    className="accent-amber-600" />
                  <div className="text-xs">
                    <span className="font-medium">전년도 세무 결손(rugi fiskal)이 있습니다</span>
                    <p className="text-gray-500">결손이 있으면 PPh 25 = 0원</p>
                  </div>
                </label>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === 4 && (() => {
        const r = determineRegime();
        return (
          <div className="space-y-4">
            {/* Main result card */}
            <Card className={`border-l-4 ${
              r.color === 'green' ? 'border-l-green-500 bg-green-50' :
              r.color === 'blue' ? 'border-l-blue-500 bg-blue-50' :
              r.color === 'amber' ? 'border-l-amber-500 bg-amber-50' :
              'border-l-indigo-500 bg-indigo-50'
            }`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Shield className={`h-6 w-6 flex-shrink-0 ${
                    r.color === 'green' ? 'text-green-600' :
                    r.color === 'blue' ? 'text-blue-600' :
                    r.color === 'amber' ? 'text-amber-600' :
                    'text-indigo-600'
                  }`} />
                  <div>
                    <p className="font-bold text-lg">{r.title}</p>
                    <p className="text-sm mt-2">{r.description}</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{r.legalBasis}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly amount */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">월 납부액 (예상)</p>
                  <p className="text-2xl font-bold font-mono mt-1">{fmtRp(r.monthlyAmount)}</p>
                  <p className="text-[10px] text-gray-400">매월 10일까지 납부</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">연간 예상 세액</p>
                  <p className="text-2xl font-bold font-mono mt-1">{fmtRp(r.annualEstimate)}</p>
                  <p className="text-[10px] text-gray-400">연말 SPT Tahunan에서 정산</p>
                </CardContent>
              </Card>
            </div>

            {/* UMKM: monthly revenue input */}
            {r.regime === 'UMKM_FINAL' && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {currentYear}년 월별 매출 입력 (UMKM PPh Final)
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3">
                    매월 매출을 입력하면 월별 PPh Final을 자동 계산합니다. 연 {fmtRp(EXEMPTION)}까지 비과세.
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {MONTHS.map((label, i) => {
                      const rev = monthlyRevenues[i];
                      const cumulative = monthlyRevenues.slice(0, i + 1).reduce((s, v) => s + v, 0);
                      const exemptionLeft = Math.max(EXEMPTION - (cumulative - rev), 0);
                      const taxable = Math.max(rev - exemptionLeft, 0);
                      const tax = Math.round(taxable * UMKM_RATE);
                      return (
                        <div key={i}>
                          <Label className="text-[10px] text-gray-500">{label}</Label>
                          <Input type="number" className="h-8 text-xs font-mono"
                            value={rev || ''}
                            onChange={e => {
                              const next = [...monthlyRevenues];
                              next[i] = Number(e.target.value) || 0;
                              setMonthlyRevenues(next);
                            }}
                            placeholder="매출" />
                          {rev > 0 && (
                            <p className="text-[9px] text-green-600 mt-0.5">세액: {fmtRp(tax)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-3 bg-green-100 rounded-lg grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-600">연간 매출 합계</p>
                      <p className="font-bold font-mono">{fmtRp(monthlyRevenues.reduce((s, v) => s + v, 0))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">비과세 공제</p>
                      <p className="font-bold font-mono">{fmtRp(Math.min(monthlyRevenues.reduce((s, v) => s + v, 0), EXEMPTION))}</p>
                    </div>
                    <div>
                      <p className="text-green-700">연간 PPh Final</p>
                      <p className="font-bold font-mono text-green-800">
                        {fmtRp(Math.round(Math.max(monthlyRevenues.reduce((s, v) => s + v, 0) - EXEMPTION, 0) * UMKM_RATE))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next steps */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-bold text-sm mb-2">다음 단계</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <Badge className="bg-blue-100 text-blue-700">1</Badge>
                    <span>월별 납부 페이지에서 ID Billing 생성</span>
                    <a href={`/${locale}/tax/monthly-payments`} className="ml-auto text-blue-600 hover:underline">이동 →</a>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <Badge className="bg-blue-100 text-blue-700">2</Badge>
                    <span>은행/ATM에서 납부 후 NTPN 입력</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <Badge className="bg-blue-100 text-blue-700">3</Badge>
                    <span>연말 SPT Tahunan 1771에서 최종 정산</span>
                    <a href={`/${locale}/tax/spt-tahunan/1771`} className="ml-auto text-blue-600 hover:underline">이동 →</a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />이전
          </Button>
        ) : <div />}
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)}>
            다음<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
