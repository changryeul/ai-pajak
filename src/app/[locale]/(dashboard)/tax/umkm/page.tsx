'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Store, Calculator, CheckCircle, AlertTriangle, ArrowRight,
  ArrowLeft, Sparkles, Shield, HelpCircle, Loader2,
  Building2, DollarSign, Calendar,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { ScreenHeader } from '@/components/tax';
import { PageTitle } from '@/components/layout/PageTitle';

// ── Constants ──
const UMKM_RATE = 0.005;          // PPh Final 0.5%
const EXEMPTION_INDIVIDUAL = 500_000_000; // Rp 500.000.000 — 개인(OP)만 비과세
const THRESHOLD = 4_800_000_000;  // Rp 4.800.000.000 annual revenue threshold
const CORPORATE_RATE = 0.22;      // PPh Badan 22%
const SME_DISCOUNT = 0.50;        // 50% discount for revenue < 50B

// PP 55/2022 UMKM 적용 기간 (정확)
function getMaxUmkmYears(legalForm: string): number {
  if (legalForm === 'PT') return 3;                    // PT: 3 Tahun Pajak
  if (['CV', 'FIRMA', 'KOPERASI'].includes(legalForm)) return 4; // CV/Firma/Koperasi: 4 Tahun Pajak
  return 7; // Orang Pribadi (개인): 7 Tahun Pajak
}

// 법인은 Rp 500M 비과세 없음 (개인만)
function getExemption(legalForm: string): number {
  if (['PT', 'CV', 'FIRMA', 'KOPERASI'].includes(legalForm)) return 0;
  return EXEMPTION_INDIVIDUAL; // 개인만 Rp 500M 비과세
}

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
  const currentYear = new Date().getFullYear();
  const t = useTranslations('umkm');
  const tsc = useTranslations('taxScreen');

  // Wizard state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showDontKnow, setShowDontKnow] = useState(false);

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

  // Step 4: UMKM monthly revenue + which month the user is currently filing for.
  // Default to the previous month — typical filing flow files for last month's revenue.
  const [monthlyRevenues, setMonthlyRevenues] = useState<number[]>(Array(12).fill(0));
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => {
    const cm = new Date().getMonth(); // 0..11
    return cm === 0 ? 11 : cm - 1;
  });

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
    const maxUmkmYears = getMaxUmkmYears(legalForm);
    const umkmYearsUsed = umkmStart > 0 ? currentYear - umkmStart : 0;
    const exemption = getExemption(legalForm);
    const isCompany = ['PT', 'CV', 'FIRMA', 'KOPERASI'].includes(legalForm);

    // Case 1: New company (< 3 years)
    if (yearsOperating < 3 && !isUmkm) {
      return {
        regime: 'PPH25_NEW',
        title: t('regimeNewCompanyTitle'),
        description: t('regimeNewCompanyDesc', { years: yearsOperating }),
        monthlyAmount: 0,
        annualEstimate: 0,
        legalBasis: t('regimeNewCompanyBasis'),
        color: 'blue',
      };
    }

    // Case 2: UMKM (revenue < 4.8B, registered, period not expired)
    if (isUmkm && revenue > 0 && revenue < THRESHOLD && umkmYearsUsed < maxUmkmYears) {
      const taxableRevenue = Math.max(revenue - exemption, 0);
      const annualTax = Math.round(taxableRevenue * UMKM_RATE);
      const exemptionDesc = isCompany
        ? t('regimeUmkmDescCompany')
        : t('regimeUmkmDescIndividual', { exemption: fmtRp(EXEMPTION_INDIVIDUAL) });
      return {
        regime: 'UMKM_FINAL',
        title: 'PPh Final UMKM — 0.5%',
        description: t('regimeUmkmFullDesc', { revenue: fmtRp(revenue), threshold: fmtRp(THRESHOLD), used: umkmYearsUsed, max: maxUmkmYears, exemptionDesc }),
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
        title: t('regimeFiscalLossTitle'),
        description: t('regimeFiscalLossDesc'),
        monthlyAmount: 0,
        annualEstimate: 0,
        legalBasis: t('regimeFiscalLossBasis'),
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
      desc = t('regimeGeneralDescRevenue', { revenue: fmtRp(revenue), threshold: fmtRp(THRESHOLD) });
    } else if (isUmkm && umkmYearsUsed >= maxUmkmYears) {
      desc = t('regimeGeneralDescExpired', { maxYears: maxUmkmYears });
    } else {
      desc = t('regimeGeneralDescNotRegistered');
    }

    if (lastTax > 0) {
      desc += ' ' + t('regimeGeneralDescWithTax', { tax: fmtRp(lastTax), credits: fmtRp(credits), monthly: fmtRp(monthly) });
    } else {
      desc += ' ' + t('regimeGeneralDescNoTax');
    }

    return {
      regime: 'PPH25_GENERAL',
      title: t('regimeGeneralTitle'),
      description: desc,
      monthlyAmount: monthly,
      annualEstimate: netTax,
      legalBasis: t('regimeGeneralBasis'),
      color: 'indigo',
    };
  };

  const MONTHS = [
    t('month1'), t('month2'), t('month3'), t('month4'),
    t('month5'), t('month6'), t('month7'), t('month8'),
    t('month9'), t('month10'), t('month11'), t('month12'),
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <PageTitle title="UMKM (PPh Final)" />
      <ScreenHeader
        title={t('pageTitle')}
        step={step}
        aiSteps={[tsc('stepAiDetect'), tsc('stepTaxCalc'), tsc('stepIdBillingGen')]}
      />

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-bold mb-1">{t('bannerTitle')}</p>
            <ul className="space-y-1 text-blue-800">
              <li>• <b>{t('bannerNewCompany')}</b> {t('bannerNewCompanyDesc')} <span className="text-[10px] text-blue-600">{t('bannerNewCompanyNote')}</span></li>
              <li>• <b>{t('bannerSmallCompany')}</b> {t('bannerSmallCompanyDesc')} <b>{t('bannerSmallCompanyRate')}</b>{t('bannerSmallCompanyFinal')}
                <br/><span className="text-[10px] text-blue-600 ml-4">{t('bannerSmallCompanyNote', { ptYears: 3, cvYears: 4, individualYears: 7 })}</span>
              </li>
              <li>• <b>{t('bannerGeneralCompany')}</b> {t('bannerGeneralCompanyDesc')}</li>
              <li>• <b>{t('bannerFiscalLoss')}</b>{t('bannerFiscalLossDesc')}</li>
            </ul>
            <p className="mt-2 text-blue-600">{t('bannerAutoDetect')}</p>
          </div>
        </div>
      </div>

      {/* UMKM eligibility auto-check — skip Step 2 if not eligible */}
      {(() => {
        const estYear = Number(establishedYear) || 0;
        const yearsOp = estYear > 0 ? currentYear - estYear : 0;
        const maxYears = getMaxUmkmYears(legalForm);
        const revenue = Number(annualRevenue) || 0;
        // UMKM 불가능 조건: 기간 초과 OR 매출 초과
        const umkmExpired = estYear > 0 && yearsOp > maxYears;
        const revenueTooHigh = revenue >= THRESHOLD;
        const cannotBeUmkm = umkmExpired || revenueTooHigh;

        // Step 1 → Step 2 넘어갈 때 자동 판정
        if (step === 1 && cannotBeUmkm && isUmkm === null) {
          // 자동으로 isUmkm = false 설정
          // (UI에서 다음 버튼 클릭 시 Step 2 스킵)
        }

        return null;
      })()}

      {/* Step indicator — UMKM(PPh Final) path skips Step 3 (전년 세금) */}
      {(() => {
        const allSteps = [
          { id: 1, label: t('stepBasicInfo'), skipped: false },
          { id: 2, label: t('stepUmkmCheck'), skipped: false },
          { id: 3, label: t('stepPrevTax'), skipped: isUmkm === true },
          { id: 4, label: t('stepResult'), skipped: false },
        ];
        return (
          <div className="flex items-center justify-between mb-6">
            {allSteps.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.skipped
                      ? 'bg-gray-100 text-gray-400 line-through'
                      : step >= s.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>{!s.skipped && step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}</div>
                  <p className={`text-[10px] mt-1 ${s.skipped ? 'text-gray-400 line-through' : ''}`}>{s.label}</p>
                </div>
                {i < 3 && (
                  <div className={`h-0.5 flex-1 ${
                    allSteps[i + 1]?.skipped
                      ? 'bg-gray-200'
                      : step > s.id ? 'bg-indigo-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Step 1: Basic info */}
      {step === 1 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              {t('companyBasicInfo')}
            </h2>
            <p className="text-xs text-gray-500">{t('companyBasicInfoDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('companyName')}</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t('legalFormLabel')}</Label>
                <select value={legalForm} onChange={e => setLegalForm(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  <option value="">{t('legalFormPlaceholder')}</option>
                  <option value="PT">{t('legalFormPT')}</option>
                  <option value="CV">{t('legalFormCV')}</option>
                  <option value="UD">{t('legalFormUD')}</option>
                  <option value="FIRMA">{t('legalFormFirma')}</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">{t('establishedYear')}</Label>
                <Input type="number" value={establishedYear} onChange={e => setEstablishedYear(e.target.value)}
                  placeholder={t('establishedYearPlaceholder')} />
                {establishedYear && currentYear - Number(establishedYear) < 3 && (
                  <p className="text-[11px] text-blue-600 mt-1">{t('newCompanyHint')}</p>
                )}
                {establishedYear && legalForm && (() => {
                  const yrs = currentYear - Number(establishedYear);
                  const max = getMaxUmkmYears(legalForm);
                  if (yrs > max) {
                    return <p className="text-[11px] text-indigo-600 mt-1">
                      {t('umkmExpiredHint', { years: yrs, legalForm, maxYears: max })}
                    </p>;
                  }
                  return null;
                })()}
              </div>
              <div>
                <Label className="text-xs">{t('annualRevenueLabel')}</Label>
                <Input type="number" value={annualRevenue} onChange={e => setAnnualRevenue(e.target.value)}
                  placeholder="5000000000" className="font-mono" />
                {annualRevenue && Number(annualRevenue) < THRESHOLD && (
                  <p className="text-[11px] text-green-600 mt-1">{t('revenueUnder48B')}</p>
                )}
                {annualRevenue && Number(annualRevenue) >= THRESHOLD && (
                  <p className="text-[11px] text-indigo-600 mt-1">{t('revenueOver48B')}</p>
                )}
              </div>
            </div>

            {/* UMKM 마지막 해 / 임박 경고 */}
            {establishedYear && legalForm && (() => {
              const yrs = currentYear - Number(establishedYear);
              const max = getMaxUmkmYears(legalForm);
              const remaining = max - yrs;
              if (remaining === 0) {
                return (
                  <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-red-900">{t('umkmLastYearWarningTitle')}</p>
                        <p className="text-xs text-red-700 mt-1">
                          {t('umkmLastYearWarningDesc', { legalForm, maxYears: max, years: yrs })}
                        </p>
                        <p className="text-xs text-red-800 mt-1 font-bold">
                          {t('umkmLastYearWarningNext', { nextYear: currentYear + 1 })}
                        </p>
                        <p className="text-[10px] text-red-600 mt-1">
                          {t('umkmLastYearWarningPlan')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (remaining === 1 && yrs > 0) {
                return (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      <p className="text-xs text-amber-800">
                        {t('umkmOneYearLeft', { nextYear: currentYear + 1, yearAfter: currentYear + 2 })}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

          </CardContent>
        </Card>
      )}

      {/* Step 2: 과세 방식 확인 */}
      {step === 2 && (() => {
        const estYear = Number(establishedYear) || 0;
        const yearsOp = estYear > 0 ? currentYear - estYear : 0;
        const maxYears = getMaxUmkmYears(legalForm);
        const revenue = Number(annualRevenue) || 0;
        const umkmExpired = estYear > 0 && yearsOp > maxYears;
        const revenueTooHigh = revenue >= THRESHOLD;
        const cannotBeUmkm = umkmExpired || revenueTooHigh;
        return (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Store className="h-5 w-5 text-green-600" />
              {t('taxMethodTitle')}
            </h2>

            {/* Auto-detect: ineligible notice */}
            {cannotBeUmkm && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                  <div className="text-xs text-indigo-900 space-y-1">
                    <p className="font-bold text-sm">{t('umkmIneligibleNoticeTitle')}</p>
                    <p>{t('umkmIneligibleNoticeDesc')}</p>
                    <ul className="list-disc list-inside text-indigo-800 mt-1">
                      {umkmExpired && (
                        <li>{t('umkmIneligibleReasonExpired', { years: yearsOp, legalForm, maxYears })}</li>
                      )}
                      {revenueTooHigh && (
                        <li>{t('umkmIneligibleReasonRevenue', { revenue: fmtRp(revenue) })}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 1. Guide */}
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
              <p className="font-bold mb-1">{t('taxMethodGuideTitle')}</p>
              <p>{t('taxMethodGuideDesc')}</p>
            </div>

            {/* 2. Tax method explanation */}
            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">{t('applicableMethods')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="font-bold text-sm text-green-900">{t('umkmMethodTitle')}</p>
                  <ul className="mt-1 text-xs text-green-800 space-y-0.5">
                    <li>{t('umkmMethodRevenue')}</li>
                    <li>{t('umkmMethodRate')}</li>
                    <li>{t('umkmMethodPeriod', { ptYears: 3, cvYears: 4, individualYears: 7 })}</li>
                    <li>{t('umkmMethodNoExemption')}</li>
                  </ul>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <p className="font-bold text-sm text-indigo-900">{t('generalMethodTitle')}</p>
                  <ul className="mt-1 text-xs text-indigo-800 space-y-0.5">
                    <li>{t('generalMethodProfit')}</li>
                    <li>{t('generalMethodRate')}</li>
                    <li>{t('generalMethodMonthly')}</li>
                    <li>{t('generalMethodAdjustment')}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. User selection */}
            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">{t('selectMethodQuestion')}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => { if (cannotBeUmkm) return; setIsUmkm(true); setStep(4); }}
                  disabled={cannotBeUmkm}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    cannotBeUmkm
                      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isUmkm === true
                        ? 'border-green-500 bg-green-50 hover:shadow-md'
                        : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                  }`}>
                  <Store className={`h-8 w-8 mx-auto mb-2 ${isUmkm === true ? 'text-green-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-sm">{t('selectUmkm')}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{t('selectUmkmDesc')}</p>
                  {cannotBeUmkm && (
                    <p className="text-[10px] text-red-500 mt-1">{t('umkmDisabledHint')}</p>
                  )}
                </button>
                <button onClick={() => { setIsUmkm(false); setStep(3); }}
                  className={`p-4 rounded-xl border-2 text-center transition-all hover:shadow-md ${
                    isUmkm === false ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                  }`}>
                  <Building2 className={`h-8 w-8 mx-auto mb-2 ${isUmkm === false ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-sm">{t('selectGeneral')}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{t('selectGeneralDesc')}</p>
                </button>
                <button onClick={() => setShowDontKnow(true)}
                  className="p-4 rounded-xl border-2 border-gray-200 text-center transition-all hover:border-amber-300 hover:shadow-md">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="font-bold text-sm">{t('selectDontKnow')}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{t('selectDontKnowDesc')}</p>
                </button>
              </div>
            </div>

            {/* Don't know → additional info */}
            {showDontKnow && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <p className="text-sm font-bold text-amber-900">{t('additionalInfoTitle')}</p>
                <p className="text-xs text-amber-700">{t('additionalInfoDesc')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t('npwpEstablishedYear')}</Label>
                    <Input type="number" value={establishedYear} onChange={e => setEstablishedYear(e.target.value)}
                      placeholder={t('establishedYearPlaceholder')} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('lastYearRevenueLabel')}</Label>
                    <Input type="number" value={annualRevenue} onChange={e => setAnnualRevenue(e.target.value)}
                      placeholder={t('lastYearRevenuePlaceholder')} className="font-mono" />
                  </div>
                </div>

                {/* 자동 판별 결과 */}
                {establishedYear && annualRevenue && (() => {
                  const revenue = Number(annualRevenue) || 0;
                  const yrs = currentYear - (Number(establishedYear) || currentYear);
                  const maxYears = getMaxUmkmYears(legalForm);
                  const canUmkm = revenue < THRESHOLD && yrs <= maxYears;

                  return (
                    <div className={`p-3 rounded-xl border ${canUmkm ? 'bg-green-50 border-green-300' : 'bg-indigo-50 border-indigo-300'}`}>
                      <p className="font-bold text-sm">
                        {t('autoDetectResult')}
                      </p>
                      {canUmkm ? (
                        <div className="mt-2 text-xs text-green-800">
                          <p className="font-bold text-green-900 text-base">{t('autoDetectUmkm')}</p>
                          <p className="mt-1">{t('autoDetectUmkmRevenue')}</p>
                          <p>{t('autoDetectUmkmRemaining', { remaining: maxYears - yrs, used: yrs, max: maxYears })}</p>
                          <Button size="sm" className="mt-2" onClick={() => { setIsUmkm(true); setStep(4); }}>
                            {t('proceedUmkm')} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-indigo-800">
                          <p className="font-bold text-indigo-900 text-base">{t('autoDetectGeneral')}</p>
                          <p className="mt-1">{t('autoDetectGeneralProfit')}</p>
                          <p>{t('autoDetectGeneralMonthly')}</p>
                          {revenue >= THRESHOLD && <p className="text-[10px] mt-1">{t('autoDetectReasonRevenue', { revenue: fmtRp(revenue) })}</p>}
                          {yrs > maxYears && <p className="text-[10px] mt-1">{t('autoDetectReasonYears', { years: yrs, legalForm, maxYears })}</p>}
                          <Button size="sm" className="mt-2" onClick={() => { setIsUmkm(false); setStep(3); }}>
                            {t('proceedGeneral')} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Step 3: Previous year tax (only for PPh 25 general) */}
      {step === 3 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              {t('prevYearTaxTitle')}
            </h2>

            {isUmkm ? (
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 inline mr-2" />
                {t('umkmDetected')}
                <p className="text-xs mt-1">{t('umkmDetectedDesc')}</p>
              </div>
            ) : (
              <>
                <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
                  <p className="font-bold">{t('pph25Formula')}</p>
                  <p className="mt-1 font-mono">{t('pph25FormulaDesc')}</p>
                  <p className="mt-1">{t('pph25FormulaHint')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t('lastYearTaxPaid')}</Label>
                    <Input type="number" value={lastYearTaxPaid} onChange={e => setLastYearTaxPaid(e.target.value)}
                      placeholder={t('lastYearTaxPaidPlaceholder')} className="font-mono" />
                    <p className="text-[10px] text-gray-400 mt-1">{t('lastYearTaxPaidHint')}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('lastYearTaxCredits')}</Label>
                    <Input type="number" value={lastYearTaxCredits} onChange={e => setLastYearTaxCredits(e.target.value)}
                      placeholder={t('lastYearTaxCreditsPlaceholder')} className="font-mono" />
                    <p className="text-[10px] text-gray-400 mt-1">{t('lastYearTaxCreditsHint')}</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={hadFiscalLoss} onChange={e => setHadFiscalLoss(e.target.checked)}
                    className="accent-amber-600" />
                  <div className="text-xs">
                    <span className="font-medium">{t('fiscalLossCheckbox')}</span>
                    <p className="text-gray-500">{t('fiscalLossDesc')}</p>
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

            {/* UMKM: monthly revenue overview — pick the filing month + edit cells inline.
                Already-submitted months stay visible across the year. */}
            {r.regime === 'UMKM_FINAL' && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('monthlyRevenueTitle', { year: currentYear })}
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3">
                    {t('monthlyRevenueDesc', { exemption: fmtRp(getExemption(legalForm)) })}
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {MONTHS.map((label, i) => {
                      const rev = monthlyRevenues[i];
                      const cumulative = monthlyRevenues.slice(0, i + 1).reduce((s, v) => s + v, 0);
                      const exemptionLeft = Math.max(getExemption(legalForm) - (cumulative - rev), 0);
                      const taxable = Math.max(rev - exemptionLeft, 0);
                      const tax = Math.round(taxable * UMKM_RATE);
                      const isSelected = i === selectedMonthIdx;
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedMonthIdx(i)}
                          className={`rounded-md p-1.5 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-green-50 ring-2 ring-green-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <Label className={`text-[10px] cursor-pointer ${isSelected ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
                            {label}
                          </Label>
                          <Input
                            type="number"
                            className={`h-8 text-xs font-mono ${isSelected ? 'bg-white border-green-400' : 'bg-gray-50'}`}
                            value={rev || ''}
                            placeholder="—"
                            onClick={e => { e.stopPropagation(); setSelectedMonthIdx(i); }}
                            onChange={e => {
                              const next = [...monthlyRevenues];
                              next[i] = Number(e.target.value) || 0;
                              setMonthlyRevenues(next);
                            }}
                          />
                          {rev > 0 && (
                            <p className="text-[9px] text-green-600 mt-0.5">{t('monthlyTaxAmount', { amount: fmtRp(tax) })}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 p-3 bg-green-100 rounded-lg grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-600">{t('annualRevenueTotal')}</p>
                      <p className="font-bold font-mono">{fmtRp(monthlyRevenues.reduce((s, v) => s + v, 0))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('exemptionDeduction')}</p>
                      <p className="font-bold font-mono">{fmtRp(Math.min(monthlyRevenues.reduce((s, v) => s + v, 0), getExemption(legalForm)))}</p>
                    </div>
                    <div>
                      <p className="text-green-700">{t('annualPphFinal')}</p>
                      <p className="font-bold font-mono text-green-800">
                        {fmtRp(Math.round(Math.max(monthlyRevenues.reduce((s, v) => s + v, 0) - getExemption(legalForm), 0) * UMKM_RATE))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected-month revenue input + auto-calculated tax + submit (UMKM only).
                The 12-month overview is rendered ABOVE this block so the user can pick the
                filing month first; cells are clickable and editable in-place. */}
            {r.regime === 'UMKM_FINAL' ? (() => {
              const selectedRev = monthlyRevenues[selectedMonthIdx] || 0;
              // Cumulative through prior months — exemption budget consumed before the selected month
              const priorCumulative = monthlyRevenues.slice(0, selectedMonthIdx).reduce((s, v) => s + v, 0);
              const exemptionLeft = Math.max(getExemption(legalForm) - priorCumulative, 0);
              const taxable = Math.max(selectedRev - exemptionLeft, 0);
              const selectedTax = Math.round(taxable * UMKM_RATE);
              return (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-stretch">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-500">
                        {MONTHS[selectedMonthIdx]} {t('thisMonthRevenue')}
                      </p>
                      <Input
                        type="number"
                        className="text-2xl font-bold font-mono mt-1 text-center h-auto py-1 border-0 shadow-none focus-visible:ring-0"
                        value={selectedRev || ''}
                        onChange={e => {
                          const next = [...monthlyRevenues];
                          next[selectedMonthIdx] = Number(e.target.value) || 0;
                          setMonthlyRevenues(next);
                        }}
                        placeholder="Rp 0"
                      />
                      <p className="text-[10px] text-gray-400">{t('thisMonthRevenueHint')}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-gray-500">
                        {MONTHS[selectedMonthIdx]} {t('thisMonthTax')}
                      </p>
                      <p className="text-2xl font-bold font-mono mt-1 text-green-700">{fmtRp(selectedTax)}</p>
                      <p className="text-[10px] text-gray-400">{t('thisMonthTaxHint')}</p>
                    </CardContent>
                  </Card>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white self-stretch px-6"
                    disabled={selectedRev <= 0}
                    onClick={() => {
                      alert(`${t('submitBtn')}: ${MONTHS[selectedMonthIdx]} ${fmtRp(selectedTax)}`);
                    }}
                  >
                    {t('submitBtn')}
                  </Button>
                </div>
              );
            })() : (() => {
              // General PPh 25 — last-year payment + this-month tax + submit, then logic table.
              const lastTax = Number(lastYearTaxPaid) || 0;
              const credits = Number(lastYearTaxCredits) || 0;
              const netTax = Math.max(lastTax - credits, 0);
              const monthly = Math.round(netTax / 12);
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-stretch">
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-gray-500">{t('lastYearPayment')}</p>
                        <p className="text-2xl font-bold font-mono mt-1">{fmtRp(lastTax)}</p>
                        <p className="text-[10px] text-gray-400">{t('lastYearPaymentHint')}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-gray-500">{t('thisMonthCorpTax')}</p>
                        <p className="text-2xl font-bold font-mono mt-1 text-indigo-700">{fmtRp(monthly)}</p>
                        <p className="text-[10px] text-gray-400">{t('thisMonthCorpTaxHint')}</p>
                      </CardContent>
                    </Card>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white self-stretch px-6"
                      disabled={monthly <= 0}
                      onClick={() => {
                        alert(`${t('submitBtn')}: ${fmtRp(monthly)}`);
                      }}
                    >
                      {t('submitBtn')}
                    </Button>
                  </div>

                  {/* Monthly decision logic table — replaces the deleted "next steps" notice */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-indigo-600" />
                          {t('monthlyDecisionTitle')}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1">{t('monthlyDecisionDesc')}</p>
                      </div>

                      <div className="rounded-lg border divide-y text-sm">
                        <div className="flex items-center justify-between p-3">
                          <span className="text-gray-700">{t('decisionPphBadanLabel')}</span>
                          <span className="font-mono font-bold">{fmtRp(lastTax)}</span>
                        </div>
                        <div className="bg-gray-50 p-3 space-y-1.5">
                          <p className="text-[11px] text-gray-500">{t('decisionCreditsTotal')}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 pl-2">- {t('decisionPph22Label')}</span>
                            <span className="font-mono text-gray-500">—</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 pl-2">- {t('decisionPph23Label')}</span>
                            <span className="font-mono text-gray-500">—</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 pl-2">- {t('decisionPph24Label')}</span>
                            <span className="font-mono text-gray-500">—</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 pl-2">- {t('decisionPph25Label')}</span>
                            <span className="font-mono text-gray-500">—</span>
                          </div>
                          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-200">
                            <span className="font-medium text-gray-700">= {t('decisionCreditsTotal')}</span>
                            <span className="font-mono font-bold">- {fmtRp(credits)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50">
                          <span className="font-medium text-blue-900">= {t('decisionNetTax')}</span>
                          <span className="font-mono font-bold text-blue-900">{fmtRp(netTax)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3">
                          <span className="text-gray-700">{t('decisionDivider')}</span>
                          <span className="font-mono text-gray-500">÷ 12</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-indigo-50">
                          <span className="font-bold text-indigo-900">= {t('decisionMonthlyResult')}</span>
                          <span className="font-mono font-bold text-indigo-900 text-base">{fmtRp(monthly)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}

          </div>
        );
      })()}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => {
            // UMKM path skipped Step 3 — going back from Step 4 should land on Step 2, not Step 3.
            if (step === 4 && isUmkm === true) {
              setStep(2);
            } else {
              setStep(step - 1);
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t('prevButton')}
          </Button>
        ) : <div />}
        {step < 4 ? (
          <Button onClick={() => {
            // Always advance one step at a time so the user sees Step 2 (UMKM 확인) explicitly,
            // even when the inputs make UMKM ineligible. The Step 2 screen surfaces the auto-detect
            // result and a "일반 PPh 25로 진행" CTA for that case.
            if (step === 1) {
              const estYear = Number(establishedYear) || 0;
              const yearsOp = estYear > 0 ? currentYear - estYear : 0;
              const maxYears = getMaxUmkmYears(legalForm);
              const revenue = Number(annualRevenue) || 0;
              const cannotBeUmkm = (estYear > 0 && yearsOp > maxYears) || revenue >= THRESHOLD;
              if (cannotBeUmkm) setIsUmkm(false);
              setStep(2);
              return;
            }
            // Step 2 → UMKM(PPh Final)이면 전년 세금 단계 불필요 → Step 4로 점프
            if (step === 2 && isUmkm === true) {
              setStep(4);
              return;
            }
            setStep(step + 1);
          }}>
            {t('nextButton')}<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
