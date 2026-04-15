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
  Building2, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft,
  Shield, DollarSign, FileText, Sparkles, HelpCircle, BookOpen,
  Calculator, Calendar, Loader2, Plus, X, ClipboardList, Upload,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const CORPORATE_RATE = 0.22; // PPh Badan 22%
const SME_THRESHOLD = 50_000_000_000; // Rp 50B for 50% discount on first 4.8B
const SME_BRACKET = 4_800_000_000; // Rp 4.8B

interface CorrectionItem {
  key: string;
  hasRate: boolean;
  defaultRate?: number;
  labelKey: string;
  descKey: string;
  hintKey: string;
}

interface NegativeCorrectionItem {
  key: string;
  labelKey: string;
  descKey: string;
  hintKey: string;
}

export default function PPh25AnnualPage() {
  const t = useTranslations('pph25');
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  // Koreksi Fiskal items (common corrections) - moved inside component for i18n
  const POSITIVE_CORRECTIONS: CorrectionItem[] = [
    { key: 'entertainment', hasRate: false, labelKey: 'corrEntertainmentLabel', descKey: 'corrEntertainmentDesc', hintKey: 'corrEntertainmentHint' },
    { key: 'welfare', hasRate: true, defaultRate: 100, labelKey: 'corrWelfareLabel', descKey: 'corrWelfareDesc', hintKey: 'corrWelfareHint' },
    { key: 'donation', hasRate: false, labelKey: 'corrDonationLabel', descKey: 'corrDonationDesc', hintKey: 'corrDonationHint' },
    { key: 'taxPenalty', hasRate: false, labelKey: 'corrTaxPenaltyLabel', descKey: 'corrTaxPenaltyDesc', hintKey: 'corrTaxPenaltyHint' },
    { key: 'personalExpense', hasRate: false, labelKey: 'corrPersonalExpenseLabel', descKey: 'corrPersonalExpenseDesc', hintKey: 'corrPersonalExpenseHint' },
    { key: 'pphBorne', hasRate: false, labelKey: 'corrPphBorneLabel', descKey: 'corrPphBorneDesc', hintKey: 'corrPphBorneHint' },
    { key: 'provision', hasRate: false, labelKey: 'corrProvisionLabel', descKey: 'corrProvisionDesc', hintKey: 'corrProvisionHint' },
    { key: 'depreciationDiff', hasRate: false, labelKey: 'corrDepreciationDiffLabel', descKey: 'corrDepreciationDiffDesc', hintKey: 'corrDepreciationDiffHint' },
    { key: 'vehicleFuel', hasRate: true, defaultRate: 50, labelKey: 'corrVehicleFuelLabel', descKey: 'corrVehicleFuelDesc', hintKey: 'corrVehicleFuelHint' },
    { key: 'tollExpense', hasRate: true, defaultRate: 50, labelKey: 'corrTollExpenseLabel', descKey: 'corrTollExpenseDesc', hintKey: 'corrTollExpenseHint' },
    { key: 'vehicleMaint', hasRate: true, defaultRate: 50, labelKey: 'corrVehicleMaintLabel', descKey: 'corrVehicleMaintDesc', hintKey: 'corrVehicleMaintHint' },
    { key: 'phoneExpense', hasRate: true, defaultRate: 50, labelKey: 'corrPhoneExpenseLabel', descKey: 'corrPhoneExpenseDesc', hintKey: 'corrPhoneExpenseHint' },
    { key: 'housingRent', hasRate: true, defaultRate: 100, labelKey: 'corrHousingRentLabel', descKey: 'corrHousingRentDesc', hintKey: 'corrHousingRentHint' },
    { key: 'educationFee', hasRate: true, defaultRate: 100, labelKey: 'corrEducationFeeLabel', descKey: 'corrEducationFeeDesc', hintKey: 'corrEducationFeeHint' },
    { key: 'travelExpense', hasRate: true, defaultRate: 40, labelKey: 'corrTravelExpenseLabel', descKey: 'corrTravelExpenseDesc', hintKey: 'corrTravelExpenseHint' },
    { key: 'otherOpex', hasRate: true, defaultRate: 50, labelKey: 'corrOtherOpexLabel', descKey: 'corrOtherOpexDesc', hintKey: 'corrOtherOpexHint' },
    { key: 'otherPositive', hasRate: false, labelKey: 'corrOtherPositiveLabel', descKey: 'corrOtherPositiveDesc', hintKey: '' },
  ];

  const NEGATIVE_CORRECTIONS: NegativeCorrectionItem[] = [
    { key: 'pphFinalIncome', labelKey: 'corrPphFinalIncomeLabel', descKey: 'corrPphFinalIncomeDesc', hintKey: 'corrPphFinalIncomeHint' },
    { key: 'nonTaxableIncome', labelKey: 'corrNonTaxableIncomeLabel', descKey: 'corrNonTaxableIncomeDesc', hintKey: 'corrNonTaxableIncomeHint' },
    { key: 'depreciationDiffNeg', labelKey: 'corrDepreciationDiffNegLabel', descKey: 'corrDepreciationDiffNegDesc', hintKey: 'corrDepreciationDiffNegHint' },
    { key: 'otherNegative', labelKey: 'corrOtherNegativeLabel', descKey: 'corrOtherNegativeDesc', hintKey: '' },
  ];

  const [step, setStep] = useState(1);
  const [year, setYear] = useState(currentYear - 1);
  const [companyName, setCompanyName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState(0);

  // Step 2: Commercial profit (from financial statements)
  const [commercialProfit, setCommercialProfit] = useState('');
  const [fsNetIncome, setFsNetIncome] = useState<number | null>(null);
  const [loadingFS, setLoadingFS] = useState(false);

  // Step 2: Required documents
  const [docs, setDocs] = useState({
    aktaPendirian: false, aktaPerubahan: false, skMenteri: false,
    fixedAssetList: false, contracts: false, monthlyTaxRecords: false,
    financialStatements: false, inventoryLedger: false, depreciationSchedule: false,
  });

  // Step 3: Inventory
  const [inventoryItems, setInventoryItems] = useState<Array<{
    name: string; beginning: string; purchases: string; ending: string;
  }>>([{ name: '', beginning: '', purchases: '', ending: '' }]);

  // Step 5: Koreksi Fiskal
  const [positiveCorr, setPositiveCorr] = useState<Record<string, string>>({});
  const [positiveCorrRates, setPositiveCorrRates] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    const rateDefaults: Record<string, number> = {
      welfare: 100, vehicleFuel: 50, tollExpense: 50, vehicleMaint: 50,
      phoneExpense: 50, housingRent: 100, educationFee: 100, travelExpense: 40, otherOpex: 50,
    };
    Object.entries(rateDefaults).forEach(([key, rate]) => {
      defaults[key] = rate;
    });
    return defaults;
  });
  const [negativeCorr, setNegativeCorr] = useState<Record<string, string>>({});

  // Step 6: Tax credits
  const [pph22Credit, setPph22Credit] = useState('');
  const [pph23Credit, setPph23Credit] = useState('');
  const [pph24Credit, setPph24Credit] = useState('');
  const [pph25Paid, setPph25Paid] = useState('');

  // Load company profile
  useEffect(() => {
    if (!session?.customerId) return;
    fetch(`/api/company-profile?customerId=${session.customerId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setCompanyName(d.data.company_name || '');
          setNpwp(d.data.npwp || '');
          setAnnualRevenue(Number(d.data.annual_revenue) || 0);
        }
      })
      .catch(() => {});
  }, [session?.customerId]);

  // Load financial statement net income
  const loadFinancialStatements = async () => {
    if (!session?.customerId) return;
    setLoadingFS(true);
    try {
      const res = await fetch('/api/accounting/financial-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: session.customerId, fiscalYear: year, action: 'generate' }),
      });
      const d = await res.json();
      if (d.success && d.data?.incomeStatement) {
        const ni = d.data.incomeStatement.netIncome;
        setFsNetIncome(ni);
        setCommercialProfit(String(ni));
      }
    } catch { /* */ }
    finally { setLoadingFS(false); }
  };

  // HPP from inventory
  const hppFromInventory = inventoryItems.reduce((s, item) => {
    const b = Number(item.beginning) || 0;
    const p = Number(item.purchases) || 0;
    const e = Number(item.ending) || 0;
    return s + (b + p - e);
  }, 0);

  // Calculations
  const commercial = Number(commercialProfit) || 0;
  const totalPositive = Object.entries(positiveCorr).reduce((s, [key, v]) => {
    const amount = Number(v) || 0;
    const corrItem = POSITIVE_CORRECTIONS.find(c => c.key === key);
    if (corrItem?.hasRate && positiveCorrRates[key]) {
      return s + Math.round(amount * positiveCorrRates[key] / 100);
    }
    return s + amount;
  }, 0);
  const totalNegative = Object.values(negativeCorr).reduce((s, v) => s + (Number(v) || 0), 0);
  const fiscalProfit = commercial + totalPositive - totalNegative; // PKP (Penghasilan Kena Pajak)

  // PPh Badan calculation (with SME discount if applicable)
  const hasSmeDiscount = annualRevenue > 0 && annualRevenue <= SME_THRESHOLD;
  let pphBadan = 0;
  if (fiscalProfit > 0) {
    if (hasSmeDiscount && annualRevenue <= SME_THRESHOLD) {
      // 50% discount on portion up to 4.8B of revenue
      const discountedPortion = Math.min(fiscalProfit, (SME_BRACKET / annualRevenue) * fiscalProfit);
      const fullPortion = fiscalProfit - discountedPortion;
      pphBadan = Math.round(discountedPortion * CORPORATE_RATE * 0.5 + fullPortion * CORPORATE_RATE);
    } else {
      pphBadan = Math.round(fiscalProfit * CORPORATE_RATE);
    }
  }

  const totalCredits = (Number(pph22Credit) || 0) + (Number(pph23Credit) || 0) + (Number(pph24Credit) || 0) + (Number(pph25Paid) || 0);
  const taxDue = pphBadan - totalCredits;
  const isUnderpaid = taxDue > 0;
  const isOverpaid = taxDue < 0;

  // Next year PPh 25 monthly installment
  const nextYearMonthly = Math.max(Math.round((pphBadan - (Number(pph22Credit) || 0) - (Number(pph23Credit) || 0) - (Number(pph24Credit) || 0)) / 12), 0);

  const STEPS = [
    { id: 1, label: t('step1') },
    { id: 2, label: t('step2') },
    { id: 3, label: t('step3') },
    { id: 4, label: t('step4') },
    { id: 5, label: t('step5') },
    { id: 6, label: t('step6') },
    { id: 7, label: t('step7') },
    { id: 8, label: t('step8') },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('pageSubtitle', { year, nextYear: year + 1 })}</p>
      </div>

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-900">
            <p className="font-bold mb-1">{t('bannerTitle')}</p>
            <ul className="space-y-0.5 text-indigo-800">
              <li>• {t('bannerItem1')}</li>
              <li>• {t('bannerItem2')}</li>
              <li>• {t('bannerItem3')}</li>
              <li>• {t('bannerItem4')}</li>
              <li>• {t('bannerItem5')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= s.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s.id ? <CheckCircle className="h-3 w-3" /> : s.id}
              </div>
              <p className="text-[9px] mt-1 text-center">{s.label}</p>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${step > s.id ? 'bg-indigo-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic */}
      {step === 1 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-indigo-600" />{t('basicInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-xs">{t('companyName')}</Label><Input value={companyName} readOnly className="bg-gray-50" /></div>
            <div><Label className="text-xs">{t('npwpLabel')}</Label><Input value={npwp} readOnly className="bg-gray-50 font-mono" /></div>
            <div>
              <Label className="text-xs">{t('fiscalYear')}</Label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full h-9 px-3 rounded-md border text-sm">
                {[currentYear - 1, currentYear - 2, currentYear].map(y => <option key={y} value={y}>{y}{t('yearSuffix')}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{t('annualRevenue')}</Label>
              <Input value={annualRevenue ? fmtRp(annualRevenue) : t('notEntered')} readOnly className="bg-gray-50 font-mono" />
              {annualRevenue > 0 && annualRevenue <= SME_THRESHOLD && (
                <p className="text-[11px] text-green-600 mt-1">{t('smeDiscountEligible')}</p>
              )}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{t('submissionDeadlinePrefix')}<b>{t('submissionDeadlineDate', { year: year + 1 })}</b></span>
          </div>
        </CardContent></Card>
      )}

      {/* Step 2: Required documents */}
      {step === 2 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600" />{t('docChecklist')}</h2>
          <p className="text-xs text-gray-500">
            {t('docChecklistDesc')}
          </p>
          <div className="space-y-2">
            {[
              { key: 'aktaPendirian', label: t('docAktaPendirian'), required: true,
                desc: t('docAktaPendirianDesc'),
                detail: t('docAktaPendirianDetail'),
                format: t('docAktaPendirianFormat') },
              { key: 'aktaPerubahan', label: t('docAktaPerubahan'), required: true,
                desc: t('docAktaPerubahanDesc'),
                detail: t('docAktaPerubahanDetail'),
                format: t('docAktaPerubahanFormat') },
              { key: 'skMenteri', label: t('docSkMenteri'), required: true,
                desc: t('docSkMenteriDesc'),
                detail: t('docSkMenteriDetail'),
                format: t('docSkMenteriFormat') },
              { key: 'financialStatements', label: t('docFinancialStatements'), required: true,
                desc: t('docFinancialStatementsDesc'),
                detail: t('docFinancialStatementsDetail'),
                format: t('docFinancialStatementsFormat') },
              { key: 'inventoryLedger', label: t('docInventoryLedger'), required: false,
                desc: t('docInventoryLedgerDesc'),
                detail: t('docInventoryLedgerDetail'),
                format: t('docInventoryLedgerFormat') },
              { key: 'depreciationSchedule', label: t('docDepreciationSchedule'), required: true,
                desc: t('docDepreciationScheduleDesc'),
                detail: t('docDepreciationScheduleDetail'),
                format: t('docDepreciationScheduleFormat') },
              { key: 'fixedAssetList', label: t('docFixedAssetList'), required: true,
                desc: t('docFixedAssetListDesc'),
                detail: t('docFixedAssetListDetail'),
                format: t('docFixedAssetListFormat') },
              { key: 'contracts', label: t('docContracts'), required: true,
                desc: t('docContractsDesc', { year }),
                detail: t('docContractsDetail'),
                format: t('docContractsFormat') },
              { key: 'monthlyTaxRecords', label: t('docMonthlyTaxRecords'), required: true,
                desc: t('docMonthlyTaxRecordsDesc', { year }),
                detail: t('docMonthlyTaxRecordsDetail'),
                format: t('docMonthlyTaxRecordsFormat') },
            ].map(doc => (
              <div key={doc.key}
                className={`p-3 rounded-lg border transition-all ${
                  docs[doc.key as keyof typeof docs] ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={docs[doc.key as keyof typeof docs]}
                    onChange={e => setDocs({ ...docs, [doc.key]: e.target.checked })}
                    className="mt-0.5 accent-green-600" />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.label}</span>
                      {doc.required && <Badge className="text-[8px] bg-red-100 text-red-700">{t('required')}</Badge>}
                    </div>
                    <p className="text-gray-600 mt-0.5">{doc.desc}</p>
                    <details className="mt-1">
                      <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">{t('detailToggle')}</summary>
                      <div className="mt-1 p-2 bg-white rounded text-[10px] text-gray-600 whitespace-pre-line">
                        {doc.detail}
                        <p className="mt-1 text-blue-700">{t('uploadFormatPrefix')}{doc.format}</p>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {docs[doc.key as keyof typeof docs] && <CheckCircle className="h-4 w-4 text-green-600" />}
                    <a href={`/${locale}/documents/upload`}
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                      title={t('uploadDoc')}>
                      <Upload className="h-3 w-3 text-blue-600" />
                    </a>
                  </div>
                </label>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs">
            <p className="text-gray-600">
              {t('docReadyPrefix')}<b>{t('docReadyCount', { count: Object.values(docs).filter(Boolean).length })}</b>{t('docReadySuffix')}
              {Object.values(docs).filter(Boolean).length < 6 && (
                <span className="text-amber-600 ml-2">{t('docAutoRequest')}</span>
              )}
            </p>
          </div>
        </CardContent></Card>
      )}

      {/* Step 3: Inventory ledger */}
      {step === 3 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" />{t('inventoryTitle')}</h2>
          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">{t('hppFormula')}</p>
            <p className="font-mono mt-1">{t('hppFormulaText')}</p>
            <p className="mt-1">{t('hppSkipNote')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left border">{t('itemName')}</th>
                  <th className="p-2 text-right border w-32">{t('beginningInventory')}</th>
                  <th className="p-2 text-right border w-32">{t('purchases')}</th>
                  <th className="p-2 text-right border w-32">{t('endingInventory')}</th>
                  <th className="p-2 text-right border w-32">{t('hppRp')}</th>
                  <th className="p-2 border w-8"></th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item, i) => {
                  const hpp = (Number(item.beginning) || 0) + (Number(item.purchases) || 0) - (Number(item.ending) || 0);
                  return (
                    <tr key={i}>
                      <td className="p-0.5 border">
                        <Input className="h-7 text-xs" value={item.name}
                          onChange={e => { const next = [...inventoryItems]; next[i] = { ...next[i], name: e.target.value }; setInventoryItems(next); }}
                          placeholder={t('itemNamePlaceholder')} />
                      </td>
                      <td className="p-0.5 border">
                        <Input type="number" className="h-7 text-xs font-mono text-right" value={item.beginning}
                          onChange={e => { const next = [...inventoryItems]; next[i] = { ...next[i], beginning: e.target.value }; setInventoryItems(next); }} />
                      </td>
                      <td className="p-0.5 border">
                        <Input type="number" className="h-7 text-xs font-mono text-right" value={item.purchases}
                          onChange={e => { const next = [...inventoryItems]; next[i] = { ...next[i], purchases: e.target.value }; setInventoryItems(next); }} />
                      </td>
                      <td className="p-0.5 border">
                        <Input type="number" className="h-7 text-xs font-mono text-right" value={item.ending}
                          onChange={e => { const next = [...inventoryItems]; next[i] = { ...next[i], ending: e.target.value }; setInventoryItems(next); }} />
                      </td>
                      <td className="p-2 border text-right font-mono font-bold">{fmtRp(hpp)}</td>
                      <td className="p-0.5 border text-center">
                        {inventoryItems.length > 1 && (
                          <button onClick={() => setInventoryItems(inventoryItems.filter((_, j) => j !== i))}><X className="h-3 w-3 text-gray-400" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-indigo-50 font-bold">
                <tr>
                  <td className="p-2 border">{t('total')}</td>
                  <td className="p-2 border text-right font-mono">{fmtRp(inventoryItems.reduce((s, i) => s + (Number(i.beginning) || 0), 0))}</td>
                  <td className="p-2 border text-right font-mono">{fmtRp(inventoryItems.reduce((s, i) => s + (Number(i.purchases) || 0), 0))}</td>
                  <td className="p-2 border text-right font-mono">{fmtRp(inventoryItems.reduce((s, i) => s + (Number(i.ending) || 0), 0))}</td>
                  <td className="p-2 border text-right font-mono text-indigo-700">{fmtRp(hppFromInventory)}</td>
                  <td className="p-2 border"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Button size="sm" variant="outline" onClick={() => setInventoryItems([...inventoryItems, { name: '', beginning: '', purchases: '', ending: '' }])}>
            <Plus className="h-3 w-3 mr-1" />{t('addItem')}
          </Button>
        </CardContent></Card>
      )}

      {/* Step 4: Commercial profit */}
      {step === 4 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-indigo-600" />{t('commercialProfitTitle')}</h2>
          <p className="text-xs text-gray-500">{t('commercialProfitDesc')}</p>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">{t('commercialNetIncome')}</Label>
              <Input type="number" value={commercialProfit} onChange={e => setCommercialProfit(e.target.value)} placeholder="0" className="font-mono" />
            </div>
            <Button variant="outline" onClick={loadFinancialStatements} disabled={loadingFS}>
              {loadingFS ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BookOpen className="h-3 w-3 mr-1" />}
              {t('loadFromFS')}
            </Button>
          </div>

          {fsNetIncome !== null && (
            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{t('fsNetIncome')}<b className="font-mono">{fmtRp(fsNetIncome)}</b></span>
            </div>
          )}

          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">{t('nextStepFiscalAdj')}</p>
            <p className="mt-1">{t('fiscalAdjExplain')}</p>
          </div>
        </CardContent></Card>
      )}

      {/* Step 5: Koreksi Fiskal */}
      {step === 5 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Calculator className="h-5 w-5 text-indigo-600" />{t('fiscalAdjTitle')}</h2>

          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">{t('fiscalAdjWhat')}</p>
            <p className="mt-1">{t('fiscalAdjDesc')}</p>
            <p className="font-mono mt-1">{t('fiscalAdjFormula')}</p>
          </div>

          {/* Positive corrections */}
          <div>
            <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">
              <Plus className="h-3 w-3" />{t('positiveAdj')}
            </h3>
            <div className="space-y-2">
              {POSITIVE_CORRECTIONS.map(item => {
                const hasRate = item.hasRate;
                const rate = positiveCorrRates[item.key] || 100;
                const rawAmount = Number(positiveCorr[item.key]) || 0;
                const adjustedAmount = hasRate ? Math.round(rawAmount * rate / 100) : rawAmount;
                return (
                <div key={item.key} className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{t(item.labelKey)}</p>
                    <p className="text-[10px] text-gray-500">{t(item.descKey)}</p>
                    {item.hintKey && <p className="text-[9px] text-amber-600 mt-0.5">{t(item.hintKey)}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasRate && (
                      <select value={rate}
                        onChange={e => setPositiveCorrRates({ ...positiveCorrRates, [item.key]: Number(e.target.value) })}
                        className="h-8 px-1 border rounded text-[10px] w-16">
                        <option value="30">30%</option>
                        <option value="40">40%</option>
                        <option value="50">50%</option>
                        <option value="60">60%</option>
                        <option value="70">70%</option>
                        <option value="80">80%</option>
                        <option value="100">100%</option>
                      </select>
                    )}
                    <Input type="number" className="w-32 h-8 text-xs font-mono text-right"
                      value={positiveCorr[item.key] || ''}
                      onChange={e => setPositiveCorr({ ...positiveCorr, [item.key]: e.target.value })}
                      placeholder={t('totalPlaceholder')} />
                  </div>
                  {hasRate && rawAmount > 0 && (
                    <p className="text-[9px] text-red-600 flex-shrink-0 w-24 text-right">
                      {t('disallowedPrefix')}{fmtRp(adjustedAmount)}
                    </p>
                  )}
                </div>
                );
              })}
              <div className="flex justify-between p-2 bg-red-50 rounded font-bold text-xs text-red-700">
                <span>{t('positiveSubtotal')}</span><span className="font-mono">+ {fmtRp(totalPositive)}</span>
              </div>
            </div>
          </div>

          {/* Negative corrections */}
          <div>
            <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
              <X className="h-3 w-3" />{t('negativeAdj')}
            </h3>
            <div className="space-y-2">
              {NEGATIVE_CORRECTIONS.map(item => (
                <div key={item.key} className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{t(item.labelKey)}</p>
                    <p className="text-[10px] text-gray-500">{t(item.descKey)}</p>
                    {item.hintKey && <p className="text-[9px] text-blue-600 mt-0.5">{t(item.hintKey)}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    <Input type="number" className="w-40 h-8 text-xs font-mono text-right"
                      value={negativeCorr[item.key] || ''}
                      onChange={e => setNegativeCorr({ ...negativeCorr, [item.key]: e.target.value })}
                      placeholder="0" />
                  </div>
                </div>
              ))}
              <div className="flex justify-between p-2 bg-blue-50 rounded font-bold text-xs text-blue-700">
                <span>{t('negativeSubtotal')}</span><span className="font-mono">- {fmtRp(totalNegative)}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-100 rounded-xl p-4 space-y-1 text-xs">
            <div className="flex justify-between"><span>{t('commercialProfit')}</span><span className="font-mono">{fmtRp(commercial)}</span></div>
            <div className="flex justify-between text-red-700"><span>{t('plusPositiveAdj')}</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
            <div className="flex justify-between text-blue-700"><span>{t('minusNegativeAdj')}</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
            <div className="flex justify-between font-bold text-sm border-t border-indigo-300 pt-2">
              <span>{t('taxableIncome')}</span>
              <span className="font-mono">{fmtRp(fiscalProfit)}</span>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Step 6: Tax credits */}
      {step === 6 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-indigo-600" />{t('taxCreditsTitle')}</h2>
          <p className="text-xs text-gray-500">{t('taxCreditsDesc')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('pph22Label')}</Label>
              <Input type="number" value={pph22Credit} onChange={e => setPph22Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">{t('pph22Hint')}</p>
            </div>
            <div>
              <Label className="text-xs">{t('pph23Label')}</Label>
              <Input type="number" value={pph23Credit} onChange={e => setPph23Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">{t('pph23Hint')}</p>
            </div>
            <div>
              <Label className="text-xs">{t('pph24Label')}</Label>
              <Input type="number" value={pph24Credit} onChange={e => setPph24Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">{t('pph24Hint')}</p>
            </div>
            <div>
              <Label className="text-xs">{t('pph25PaidLabel')}</Label>
              <Input type="number" value={pph25Paid} onChange={e => setPph25Paid(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">{t('pph25PaidHint', { year })}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs font-bold flex justify-between">
            <span>{t('totalCredits')}</span><span className="font-mono">{fmtRp(totalCredits)}</span>
          </div>
        </CardContent></Card>
      )}

      {/* Step 7: Tax calculation result */}
      {step === 7 && (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-indigo-500"><CardContent className="p-5">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Calculator className="h-5 w-5 text-indigo-600" />{t('taxCalcTitle', { year })}</h2>

            <div className="max-w-lg space-y-1 text-xs">
              <div className="flex justify-between"><span>{t('commercialProfit')}</span><span className="font-mono">{fmtRp(commercial)}</span></div>
              <div className="flex justify-between text-red-700"><span>{t('plusPositiveAdj')}</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
              <div className="flex justify-between text-blue-700"><span>{t('minusNegativeAdj')}</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>{t('taxableIncome')}</span><span className="font-mono">{fmtRp(fiscalProfit)}</span></div>
              <div className="flex justify-between mt-2">
                <span>{hasSmeDiscount ? t('pphBadanWithDiscount') : t('pphBadanNoDiscount')}</span>
                <span className="font-mono font-bold">{fmtRp(pphBadan)}</span>
              </div>
              {hasSmeDiscount && (
                <p className="text-[10px] text-green-600">{t('smeDiscountNote', { revenue: fmtRp(annualRevenue) })}</p>
              )}
              <div className="border-t mt-2 pt-2 space-y-0.5">
                <div className="flex justify-between"><span>{t('minusPph22')}</span><span className="font-mono">{fmtRp(Number(pph22Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>{t('minusPph23')}</span><span className="font-mono">{fmtRp(Number(pph23Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>{t('minusPph24')}</span><span className="font-mono">{fmtRp(Number(pph24Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>{t('minusPph25')}</span><span className="font-mono">{fmtRp(Number(pph25Paid) || 0)}</span></div>
              </div>
              <div className={`flex justify-between font-bold text-sm border-t-2 pt-2 ${isUnderpaid ? 'text-red-700 border-red-500' : isOverpaid ? 'text-blue-700 border-blue-500' : 'text-green-700 border-green-500'}`}>
                <span>{isUnderpaid ? t('underpaid') : isOverpaid ? t('overpaid') : t('settled')}</span>
                <span className="font-mono">{fmtRp(Math.abs(taxDue))}</span>
              </div>
            </div>
          </CardContent></Card>

          {isUnderpaid && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-900 text-lg">{t('additionalPaymentNeeded')}{fmtRp(taxDue)}</p>
                  <p className="text-xs text-red-700 mt-1">{t('payBeforeSPT')}</p>
                </div>
              </div>

              {/* Difference breakdown */}
              <div className="bg-white rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-gray-700 mb-2">{t('differenceBreakdown')}</p>
                <div className="flex justify-between"><span>{t('commercialProfit')}</span><span className="font-mono">{fmtRp(commercial)}</span></div>
                <div className="flex justify-between"><span>{t('plusPositiveAdj')}</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
                <div className="flex justify-between"><span>{t('minusNegativeAdj')}</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
                <div className="flex justify-between border-t pt-1"><span>{t('taxableIncome')}</span><span className="font-mono">{fmtRp(fiscalProfit)}</span></div>
                <div className="flex justify-between"><span>{hasSmeDiscount ? t('pphBadanSmeLabel') : t('pphBadanLabel')}</span><span className="font-mono">{fmtRp(pphBadan)}</span></div>
                <div className="flex justify-between"><span>{t('minusTotalCredits')}</span><span className="font-mono">- {fmtRp(totalCredits)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                  <span>{t('unpaidDifference')}</span><span className="font-mono">{fmtRp(taxDue)}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 text-[11px] text-gray-600">
                <p className="font-bold text-gray-700 mb-1">{t('whyDifference')}</p>
                <ul className="space-y-0.5">
                  <li>• {t('diffReason1')}</li>
                  <li>• {t('diffReason2')}</li>
                  <li>• {t('diffReason3')}</li>
                </ul>
              </div>

              <div className="bg-red-100 rounded-lg p-3">
                <p className="text-xs font-bold text-red-900 mb-2">{t('paymentMethod')}</p>
                <div className="flex items-center gap-2 text-xs text-red-800 mb-2">
                  <span>{t('taxTypeLabel')}<b>{t('taxTypeValue')}</b></span>
                  <span>·</span>
                  <span>{t('amountLabel')}<b className="font-mono">{fmtRp(taxDue)}</b></span>
                  <span>·</span>
                  <span>{t('deadlineLabel')}<b>{t('deadlineDate', { year: year + 1 })}</b></span>
                </div>
                <a href={`/${locale}/tax/billing`}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                  <DollarSign className="h-3 w-3" />
                  {t('goToBilling')}
                </a>
              </div>
            </div>
          )}
          {isOverpaid && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-bold text-blue-900">{t('overpaidAmountPrefix')}{fmtRp(Math.abs(taxDue))}</p>
                <p className="text-xs text-blue-700">{t('overpaidOptions')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 8: Next year PPh 25 */}
      {step === 8 && (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-green-500 bg-green-50"><CardContent className="p-5">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Calendar className="h-5 w-5 text-green-600" />{t('pph25MonthlyTitle', { year: year + 1 })}</h2>

            <div className="bg-white rounded-lg p-4 max-w-lg space-y-1 text-xs">
              <div className="flex justify-between"><span>{t('yearPphBadan', { year })}</span><span className="font-mono">{fmtRp(pphBadan)}</span></div>
              <div className="flex justify-between"><span>{t('minusPph22')}</span><span className="font-mono">{fmtRp(Number(pph22Credit) || 0)}</span></div>
              <div className="flex justify-between"><span>{t('minusPph23')}</span><span className="font-mono">{fmtRp(Number(pph23Credit) || 0)}</span></div>
              <div className="flex justify-between"><span>{t('minusPph24')}</span><span className="font-mono">{fmtRp(Number(pph24Credit) || 0)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>{t('pph25Basis')}</span><span className="font-mono">{fmtRp(Math.max(pphBadan - (Number(pph22Credit) || 0) - (Number(pph23Credit) || 0) - (Number(pph24Credit) || 0), 0))}</span></div>
              <div className="flex justify-between"><span>{t('dividedBy12')}</span><span></span></div>
              <div className="flex justify-between font-bold text-lg border-t-2 border-green-500 pt-2 text-green-700">
                <span>{t('monthlyPph25', { year: year + 1 })}</span>
                <span className="font-mono">{fmtRp(nextYearMonthly)}</span>
              </div>
            </div>

            <p className="text-xs text-green-800 mt-3">
              {t('monthlyPaymentNote1', { year: year + 1 })}<b>{fmtRp(nextYearMonthly)}</b>{t('monthlyPaymentNote2')}<b>{t('monthlyPaymentNote3')}</b>{t('monthlyPaymentNote4')}
            </p>
          </CardContent></Card>

          <Card className="bg-gray-50"><CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2">{t('nextSteps')}</h3>
            <div className="space-y-2 text-xs">
              {isUnderpaid && (
                <div className="flex items-center gap-2 p-2 bg-white rounded border">
                  <Badge className="bg-red-100 text-red-700">1</Badge>
                  <span>{t('payPph29Prefix')}{fmtRp(taxDue)}</span>
                  <a href={`/${locale}/tax/monthly-payments`} className="ml-auto text-blue-600 hover:underline">{t('payLink')}</a>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Badge className="bg-blue-100 text-blue-700">{isUnderpaid ? '2' : '1'}</Badge>
                <span>{t('sptTahunan1771')}</span>
                <a href={`/${locale}/tax/spt-tahunan/1771`} className="ml-auto text-blue-600 hover:underline">{t('sptLink')}</a>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Badge className="bg-blue-100 text-blue-700">{isUnderpaid ? '3' : '2'}</Badge>
                <span>{t('startMonthlyPph25Prefix', { year: year + 1 })}{fmtRp(nextYearMonthly)}{t('startMonthlyPph25Suffix')}</span>
                <a href={`/${locale}/tax/monthly-payments`} className="ml-auto text-blue-600 hover:underline">{t('payLink')}</a>
              </div>
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('prevButton')}</Button>
        ) : <div />}
        {step < 8 ? (
          <Button onClick={() => setStep(step + 1)}>{t('nextButton')}<ArrowRight className="h-4 w-4 ml-1" /></Button>
        ) : null}
      </div>
    </div>
  );
}
