'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Store, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft,
  Shield, Calendar, DollarSign, FileText, Sparkles,
  HelpCircle, Upload, FolderOpen, BookOpen,
  ClipboardList,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const UMKM_RATE = 0.005;
const EXEMPTION = 500_000_000;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function PPhFinalAnnualPage() {
  const t = useTranslations('pphFinal');
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState(1);
  const [year, setYear] = useState(currentYear - 1);
  const [_loading, _setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [umkmStartYear, setUmkmStartYear] = useState(0);

  // Step 2: Monthly revenue data
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>(Array(12).fill(0));
  const [monthlyPaid, setMonthlyPaid] = useState<number[]>(Array(12).fill(0));

  // Step 2: Required documents checklist
  const [docs, setDocs] = useState({
    aktaPendirian: false,
    aktaPerubahan: false,
    skMenteri: false,
    fixedAssetList: false,
    contracts: false,
    monthlyTaxRecords: false,
  });

  // Step 3: Financial statement path
  const [fsPath, setFsPath] = useState<'JOURNAL' | 'BANK_PETTY' | null>(null);

  // Step 5: Additional income/deductions
  const [otherIncome, setOtherIncome] = useState('');
  const [interestIncome, setInterestIncome] = useState('');
  const [assetGainLoss, setAssetGainLoss] = useState('');

  // Load company profile
  useEffect(() => {
    if (!session?.customerId) return;
    fetch(`/api/company-profile?customerId=${session.customerId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setCompanyName(d.data.company_name || '');
          setNpwp(d.data.npwp || '');
          setUmkmStartYear(d.data.umkm_final_tax_start_year || 0);
        }
      })
      .catch(() => {});
  }, [session?.customerId]);

  // Calculations
  const totalRevenue = monthlyRevenue.reduce((s, v) => s + v, 0);
  const taxableRevenue = Math.max(totalRevenue - EXEMPTION, 0);
  const annualTaxDue = Math.round(taxableRevenue * UMKM_RATE);
  const totalPaid = monthlyPaid.reduce((s, v) => s + v, 0);
  const difference = annualTaxDue - totalPaid;
  const isOverpaid = difference < 0;
  const isUnderpaid = difference > 0;
  const isBalanced = difference === 0;

  // Cumulative exemption tracking per month
  
  const exemptionFormatted = fmtRp(EXEMPTION);

  const docItems = [
    {
      key: 'aktaPendirian', label: t('docAktaPendirianLabel'), required: true,
      desc: t('docAktaPendirianDesc'),
      detail: t('docAktaPendirianDetail'),
      format: t('docAktaPendirianFormat'),
    },
    {
      key: 'aktaPerubahan', label: t('docAktaPerubahanLabel'), required: true,
      desc: t('docAktaPerubahanDesc'),
      detail: t('docAktaPerubahanDetail'),
      format: t('docAktaPerubahanFormat'),
    },
    {
      key: 'skMenteri', label: t('docSkMenteriLabel'), required: true,
      desc: t('docSkMenteriDesc'),
      detail: t('docSkMenteriDetail'),
      format: t('docSkMenteriFormat'),
    },
    {
      key: 'fixedAssetList', label: t('docFixedAssetLabel'), required: false,
      desc: t('docFixedAssetDesc'),
      detail: t('docFixedAssetDetail'),
      format: t('docFixedAssetFormat'),
    },
    {
      key: 'contracts', label: t('docContractsLabel'), required: true,
      desc: t('docContractsDesc', { year }),
      detail: t('docContractsDetail'),
      format: t('docContractsFormat'),
    },
    {
      key: 'monthlyTaxRecords', label: t('docMonthlyTaxLabel'), required: true,
      desc: t('docMonthlyTaxDesc', { year }),
      detail: t('docMonthlyTaxDetail'),
      format: t('docMonthlyTaxFormat'),
    },
  ];

  const steps = [
    { id: 1, label: t('stepBasicInfo') },
    { id: 2, label: t('stepDocuments') },
    { id: 3, label: t('stepFinancialStatements') },
    { id: 4, label: t('stepMonthlyRevenue') },
    { id: 5, label: t('stepOtherIncome') },
    { id: 6, label: t('stepSettlement') },
    { id: 7, label: t('stepSptGeneration') },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-green-600" />
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('pageDescription', { year })}
        </p>
      </div>

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-green-900">
            <p className="font-bold mb-1">{t('educationalTitle')}</p>
            <ul className="space-y-0.5 text-green-800">
              <li dangerouslySetInnerHTML={{ __html: '• ' + t.raw('educationalItem1') }} />
              <li dangerouslySetInnerHTML={{ __html: '• ' + t.raw('educationalItem2').replace('{exemption}', exemptionFormatted) }} />
              <li>• {t('educationalItem3')}</li>
              <li>• {t('educationalItem4')}</li>
              <li dangerouslySetInnerHTML={{ __html: '• ' + t.raw('educationalItem5') }} />
            </ul>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= s.id ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{step > s.id ? <CheckCircle className="h-3 w-3" /> : s.id}</div>
              <p className="text-[9px] mt-1 text-center">{s.label}</p>
            </div>
            {i < 6 && <div className={`h-0.5 flex-1 ${step > s.id ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic info */}

      {step === 1 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              {t('basicInfoTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('companyName')}</Label>
                <Input value={companyName} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label className="text-xs">NPWP</Label>
                <Input value={npwp} readOnly className="bg-gray-50 font-mono" />
              </div>
              <div>
                <Label className="text-xs">{t('fiscalYear')}</Label>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  {[currentYear - 1, currentYear - 2, currentYear].map(y => (
                    <option key={y} value={y}>{t('yearSuffix', { year: y })}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{t('umkmStartYear')}</Label>
                <Input value={umkmStartYear || t('notRegistered')} readOnly className="bg-gray-50" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
              <p className="font-bold">{t('appliedTaxRate')}</p>
              <p className="mt-1" dangerouslySetInnerHTML={{ __html: t.raw('taxRateFormula') }} />
              <p className="mt-1">
                {t('exemptionNote', { exemption: exemptionFormatted })}
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <Calendar className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t('deadlineTitle')}</p>
                <p>{t('deadlineDescription', { nextYear: year + 1 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Required documents */}
      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-600" />
              {t('documentsTitle')}
            </h2>
            <p className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: t.raw('documentsDescription') }} />

            <div className="space-y-2">
              {docItems.map(doc => (
                <div key={doc.key}
                  className={`p-3 rounded-lg border transition-all ${
                    docs[doc.key as keyof typeof docs] ? 'border-green-300 bg-green-50' : 'border-gray-200'
                  }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox"
                      checked={docs[doc.key as keyof typeof docs]}
                      onChange={e => setDocs({ ...docs, [doc.key]: e.target.checked })}
                      className="mt-0.5 accent-green-600" />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{doc.label}</span>
                        {doc.required && <Badge className="text-[8px] bg-red-100 text-red-700">{t('required')}</Badge>}
                      </div>
                      <p className="text-gray-600 mt-0.5">{doc.desc}</p>
                      <details className="mt-1">
                        <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">{t('viewDetails')}</summary>
                        <div className="mt-1 p-2 bg-white rounded text-[10px] text-gray-600 whitespace-pre-line">
                          {doc.detail}
                          <p className="mt-1 text-blue-700">{t('uploadFormat', { format: doc.format })}</p>
                        </div>
                      </details>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {docs[doc.key as keyof typeof docs] && <CheckCircle className="h-4 w-4 text-green-600" />}
                      <a href={`/${locale}/documents/upload`}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                        title={t('uploadThisDoc')}>
                        <Upload className="h-3 w-3 text-blue-600" />
                      </a>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs">
              <p className="text-gray-600" dangerouslySetInnerHTML={{
                __html: t.raw('preparationStatus').replace('{count}', String(Object.values(docs).filter(Boolean).length))
                  + (Object.values(docs).filter(Boolean).length < 4
                    ? '<span class="text-amber-600 ml-2">' + t.raw('unpreparedAutoRequest') + '</span>'
                    : '')
              }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Financial statement preparation */}
      {step === 3 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              {t('financialStatementsTitle')}
            </h2>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {t('fsRequiredNotice')}
              </p>
              <p className="text-xs text-amber-800 mt-1" dangerouslySetInnerHTML={{ __html: t.raw('fsRequiredDescription') }} />
            </div>

            <p className="text-sm font-medium">{t('fsSelectMethod')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Path A: Customer has journal */}
              <button type="button"
                onClick={() => setFsPath('JOURNAL')}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  fsPath === 'JOURNAL' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <BookOpen className={`h-8 w-8 mb-2 ${fsPath === 'JOURNAL' ? 'text-green-600' : 'text-gray-400'}`} />
                <p className="font-bold text-sm">{t('fsJournalTitle')}</p>
                <p className="text-xs text-gray-600 mt-2">
                  {t('fsJournalDesc')}
                </p>
                <div className="mt-3 text-[10px] text-green-700 bg-green-100 rounded p-2">
                  <p className="font-bold">{t('fsJournalNeeded')}</p>
                  <p>{t('fsJournalItem1')}</p>
                  <p>{t('fsJournalItem2')}</p>
                </div>
              </button>

              {/* Path B: No journal — bank statements */}
              <button type="button"
                onClick={() => setFsPath('BANK_PETTY')}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  fsPath === 'BANK_PETTY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <FolderOpen className={`h-8 w-8 mb-2 ${fsPath === 'BANK_PETTY' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="font-bold text-sm">{t('fsNoJournalTitle')}</p>
                <p className="text-xs text-gray-600 mt-2">
                  {t('fsNoJournalDesc')}
                </p>
                <div className="mt-3 text-[10px] text-blue-700 bg-blue-100 rounded p-2">
                  <p className="font-bold">{t('fsNoJournalNeeded')}</p>
                  <p>{t('fsNoJournalItem1', { year })}</p>
                  <p>{t('fsNoJournalItem2')}</p>
                  <p>{t('fsNoJournalItem3')}</p>
                </div>
              </button>
            </div>

            {fsPath && (
              <div className={`rounded-xl p-4 border ${
                fsPath === 'JOURNAL' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <p className="text-xs font-bold mb-2">
                  {fsPath === 'JOURNAL' ? t('fsJournalBased') : t('fsBankBased')}
                </p>
                <p className="text-xs text-gray-700">
                  {fsPath === 'JOURNAL'
                    ? t('fsJournalInstruction')
                    : t('fsBankInstruction')}
                </p>
                <a href={`/${locale}/documents/upload`}
                  className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                    fsPath === 'JOURNAL' ? 'text-green-700' : 'text-blue-700'
                  } hover:underline`}>
                  <Upload className="h-3 w-3" />{t('goToUploadPage')}
                </a>

                {fsPath === 'BANK_PETTY' && (
                  <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800">
                    <p className="font-bold">{t('pettyCashExplain')}</p>
                    <p className="mt-0.5">
                      {t('pettyCashDesc')}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 text-xs">
              <p className="font-bold text-gray-700 mb-1">{t('fsProcessTitle')}</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <Badge className="bg-gray-200 text-gray-700">1</Badge>
                <span>{t('fsProcess1')}</span>
                <span>&rarr;</span>
                <Badge className="bg-gray-200 text-gray-700">2</Badge>
                <span>{t('fsProcess2')}</span>
                <span>&rarr;</span>
                <Badge className="bg-gray-200 text-gray-700">3</Badge>
                <span>{t('fsProcess3')}</span>
                <span>&rarr;</span>
                <Badge className="bg-gray-200 text-gray-700">4</Badge>
                <span>Neraca + L/R</span>
                <span>&rarr;</span>
                <Badge className="bg-gray-200 text-gray-700">5</Badge>
                <span>{t('fsProcess5')}</span>
              </div>
              <a href={`/${locale}/tax/annual/financial-statements`}
                className="inline-flex items-center gap-1 mt-2 text-indigo-700 font-medium hover:underline">
                <BookOpen className="h-3 w-3" />{t('goToFsPage')}
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Monthly revenue + paid */}
      {step === 4 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {t('monthlyRevenueTitle', { year })}
            </h2>
            <p className="text-xs text-gray-500">
              {t('monthlyRevenueDesc')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-50">
                    <th className="p-2 text-left border">{t('colMonth')}</th>
                    <th className="p-2 text-right border">{t('colRevenue')}</th>
                    <th className="p-2 text-right border">{t('colExemption')}</th>
                    <th className="p-2 text-right border">{t('colTaxableRevenue')}</th>
                    <th className="p-2 text-right border">{t('colTaxAmount')}</th>
                    <th className="p-2 text-right border">{t('colActualPaid')}</th>
                    <th className="p-2 text-center border">{t('colDifference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((label, i) => {
                    const cumBefore = monthlyRevenue.slice(0, i).reduce((s, v) => s + v, 0);
                    const cumAfter = cumBefore + monthlyRevenue[i];
                    const exemptBefore = Math.min(cumBefore, EXEMPTION);
                    const exemptAfter = Math.min(cumAfter, EXEMPTION);
                    const monthExempt = exemptAfter - exemptBefore;
                    const taxable = Math.max(monthlyRevenue[i] - monthExempt, 0);
                    const tax = Math.round(taxable * UMKM_RATE);
                    const diff = monthlyPaid[i] - tax;

                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2 border font-medium">{label}</td>
                        <td className="p-1 border">
                          <Input type="number" className="h-7 text-xs font-mono text-right"
                            value={monthlyRevenue[i] || ''}
                            onChange={e => {
                              const next = [...monthlyRevenue];
                              next[i] = Number(e.target.value) || 0;
                              setMonthlyRevenue(next);
                            }}
                          />
                        </td>
                        <td className="p-2 border text-right font-mono text-gray-500">
                          {monthExempt > 0 ? fmtRp(monthExempt) : '-'}
                        </td>
                        <td className="p-2 border text-right font-mono">
                          {taxable > 0 ? fmtRp(taxable) : '-'}
                        </td>
                        <td className="p-2 border text-right font-mono text-green-700 font-bold">
                          {tax > 0 ? fmtRp(tax) : '-'}
                        </td>
                        <td className="p-1 border">
                          <Input type="number" className="h-7 text-xs font-mono text-right"
                            value={monthlyPaid[i] || ''}
                            onChange={e => {
                              const next = [...monthlyPaid];
                              next[i] = Number(e.target.value) || 0;
                              setMonthlyPaid(next);
                            }}
                          />
                        </td>
                        <td className={`p-2 border text-center text-[10px] font-mono ${
                          diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {monthlyRevenue[i] > 0 ? (diff === 0 ? t('match') : diff > 0 ? `+${fmtRp(diff)}` : fmtRp(diff)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-green-50 font-bold">
                  <tr>
                    <td className="p-2 border">{t('total')}</td>
                    <td className="p-2 border text-right font-mono">{fmtRp(totalRevenue)}</td>
                    <td className="p-2 border text-right font-mono text-gray-500">{fmtRp(Math.min(totalRevenue, EXEMPTION))}</td>
                    <td className="p-2 border text-right font-mono">{fmtRp(taxableRevenue)}</td>
                    <td className="p-2 border text-right font-mono text-green-700">{fmtRp(annualTaxDue)}</td>
                    <td className="p-2 border text-right font-mono">{fmtRp(totalPaid)}</td>
                    <td className={`p-2 border text-center font-mono ${isBalanced ? 'text-green-600' : isOverpaid ? 'text-blue-600' : 'text-red-600'}`}>
                      {isBalanced ? '✓' : isOverpaid ? fmtRp(difference) : `+${fmtRp(difference)}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalRevenue > 0 && totalRevenue < EXEMPTION && (
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span dangerouslySetInnerHTML={{ __html: t.raw('fullyExempt').replace('{exemption}', exemptionFormatted) }} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Other income */}
      {step === 5 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              {t('otherIncomeTitle')}
            </h2>
            <p className="text-xs text-gray-500">
              {t('otherIncomeDesc')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t('otherBusinessIncome')}</Label>
                <Input type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">{t('otherBusinessIncomeNote')}</p>
              </div>
              <div>
                <Label className="text-xs">{t('interestIncome')}</Label>
                <Input type="number" value={interestIncome} onChange={e => setInterestIncome(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">{t('interestIncomeNote')}</p>
              </div>
              <div>
                <Label className="text-xs">{t('assetGainLoss')}</Label>
                <Input type="number" value={assetGainLoss} onChange={e => setAssetGainLoss(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">{t('assetGainLossNote')}</p>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
              <p className="font-bold">{t('taxScopeTitle')}</p>
              <ul className="mt-1 space-y-0.5">
                <li>{t('taxScopeItem1')}</li>
                <li>{t('taxScopeItem2')}</li>
                <li>{t('taxScopeItem3')}</li>
                <li>{t('taxScopeItem4')}</li>
                <li>{t('taxScopeItem5')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Settlement result */}
      {step === 6 && (
        <div className="space-y-4">
          <Card className={`border-l-4 ${isBalanced ? 'border-l-green-500' : isOverpaid ? 'border-l-blue-500' : 'border-l-red-500'}`}>
            <CardContent className="p-5">
              <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5" />
                {t('settlementTitle', { year })}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">{t('annualRevenue')}</p>
                  <p className="text-sm font-bold font-mono">{fmtRp(totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">{t('taxExemptionDeduction')}</p>
                  <p className="text-sm font-bold font-mono text-gray-500">{fmtRp(Math.min(totalRevenue, EXEMPTION))}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-green-600">{t('annualPphFinal')}</p>
                  <p className="text-sm font-bold font-mono text-green-700">{fmtRp(annualTaxDue)}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">{t('alreadyPaid')}</p>
                  <p className="text-sm font-bold font-mono">{fmtRp(totalPaid)}</p>
                </div>
              </div>

              {/* Settlement status */}
              {isBalanced && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-900">{t('settlementBalanced')}</p>
                    <p className="text-xs text-green-700">{t('settlementBalancedDesc')}</p>
                  </div>
                </div>
              )}
              {isUnderpaid && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-900 text-lg">{t('underpaidTitle', { amount: fmtRp(difference) })}</p>
                      <p className="text-xs text-red-700 mt-1">
                        {t('underpaidDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-gray-700 mb-2">{t('breakdownTitle')}</p>
                    <div className="flex justify-between"><span>{t('totalAnnualRevenue')}</span><span className="font-mono">{fmtRp(totalRevenue)}</span></div>
                    <div className="flex justify-between"><span>{t('exemptionDeduction', { exemption: exemptionFormatted })}</span><span className="font-mono text-gray-500">- {fmtRp(Math.min(totalRevenue, EXEMPTION))}</span></div>
                    <div className="flex justify-between"><span>{t('taxableRevenue')}</span><span className="font-mono">{fmtRp(taxableRevenue)}</span></div>
                    <div className="flex justify-between"><span>{t('pphFinalHalf')}</span><span className="font-mono">{fmtRp(annualTaxDue)}</span></div>
                    <div className="flex justify-between border-t pt-1"><span>{t('alreadyPaidTotal')}</span><span className="font-mono">- {fmtRp(totalPaid)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                      <span>{t('unpaidDifference')}</span><span className="font-mono">{fmtRp(difference)}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 text-[11px] text-gray-600">
                    <p className="font-bold text-gray-700 mb-1">{t('whyDifference')}</p>
                    <ul className="space-y-0.5">
                      <li>{t('whyDiffItem1')}</li>
                      <li>{t('whyDiffItem2')}</li>
                      <li>{t('whyDiffItem3')}</li>
                    </ul>
                  </div>

                  <div className="bg-red-100 rounded-lg p-3">
                    <p className="text-xs font-bold text-red-900 mb-2">
                      {t('paymentMethodTitle')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-red-800 mb-2">
                      <span>{t('taxType')} <b>{t('taxTypeValue')}</b></span>
                      <span>&middot;</span>
                      <span>{t('amountLabel')} <b className="font-mono">{fmtRp(difference)}</b></span>
                      <span>&middot;</span>
                      <span>{t('deadlineLabel')} <b>{t('deadlineValue', { nextYear: year + 1 })}</b></span>
                    </div>
                    <a href={`/${locale}/tax/billing`}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                      <DollarSign className="h-3 w-3" />
                      {t('goToBillingPage')}
                    </a>
                  </div>
                </div>
              )}
              {isOverpaid && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-bold text-blue-900">{t('overpaidTitle', { amount: fmtRp(Math.abs(difference)) })}</p>
                    <p className="text-xs text-blue-700">
                      {t('overpaidDesc', { amount: fmtRp(Math.abs(difference)) })}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge className="bg-blue-200 text-blue-800 text-[10px]">{t('carryOver')}</Badge>
                      <Badge className="bg-amber-200 text-amber-800 text-[10px]">{t('refund')}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional income summary */}
          {(Number(otherIncome) > 0 || Number(interestIncome) > 0 || Number(assetGainLoss) > 0) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold text-sm mb-2">{t('otherIncomeSummary')}</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-gray-500">{t('nonBusinessIncome')}</p><p className="font-mono">{fmtRp(Number(otherIncome))}</p></div>
                  <div><p className="text-gray-500">{t('interestIncomeLabel')}</p><p className="font-mono">{fmtRp(Number(interestIncome))}</p></div>
                  <div><p className="text-gray-500">{t('assetGainLossLabel')}</p><p className="font-mono">{fmtRp(Number(assetGainLoss))}</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 7: SPT generation */}
      {step === 7 && (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-5 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h2 className="font-bold text-lg text-green-900">{t('sptReadyTitle')}</h2>
              <p className="text-sm text-green-700 mt-2">
                {t('sptReadyDesc', { year })}
              </p>
              <div className="mt-4 bg-white rounded-xl p-4 text-left max-w-md mx-auto text-xs space-y-2">
                <div className="flex justify-between"><span>{t('annualRevenue')}</span><span className="font-mono font-bold">{fmtRp(totalRevenue)}</span></div>
                <div className="flex justify-between"><span>{t('taxExemptionDeduction')}</span><span className="font-mono">{fmtRp(Math.min(totalRevenue, EXEMPTION))}</span></div>
                <div className="flex justify-between"><span>{t('pphFinalLabel')}</span><span className="font-mono text-green-700 font-bold">{fmtRp(annualTaxDue)}</span></div>
                <div className="flex justify-between"><span>{t('alreadyPaid')}</span><span className="font-mono">{fmtRp(totalPaid)}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>{isUnderpaid ? t('additionalPayment') : isOverpaid ? t('overpayment') : t('noDifference')}</span>
                  <span className={`font-mono ${isBalanced ? 'text-green-600' : isOverpaid ? 'text-blue-600' : 'text-red-600'}`}>
                    {isBalanced ? '0' : fmtRp(Math.abs(difference))}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Button size="lg" className="w-full max-w-md" onClick={() => router.push(`/${locale}/tax/spt-tahunan/1771`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('goToSpt1771')}
                </Button>
                <p className="text-[10px] text-gray-500">
                  {t('sptFinalNote')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t('previous')}
          </Button>
        ) : <div />}
        {step < 7 ? (
          <Button onClick={() => setStep(step + 1)}>
            {t('next')}<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
