'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft,
  Shield, DollarSign, FileText, Sparkles, HelpCircle, BookOpen,
  Calculator, Calendar, Loader2, Plus, X, ClipboardList,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const CORPORATE_RATE = 0.22; // PPh Badan 22%
const SME_THRESHOLD = 50_000_000_000; // Rp 50B for 50% discount on first 4.8B
const SME_BRACKET = 4_800_000_000; // Rp 4.8B

// Koreksi Fiskal items (common corrections)
const POSITIVE_CORRECTIONS = [
  { key: 'entertainment', label: 'Biaya entertainment tanpa daftar nominatif', desc: '접대비 (명목 리스트 미작성)', hint: '접대비 전액은 세무 비용 불인정. 명목 리스트가 있으면 50%만 인정.' },
  { key: 'donation', label: 'Sumbangan/donasi', desc: '기부금 (비용 불인정)', hint: '자연재해 기부금 등 일부만 인정. 일반 기부는 비용 불인정.' },
  { key: 'taxPenalty', label: 'Denda & sanksi pajak', desc: '세금 벌금/가산금', hint: '세무 벌금은 세무상 비용으로 인정되지 않음.' },
  { key: 'personalExpense', label: 'Biaya pribadi pemegang saham', desc: '주주 개인 비용', hint: '회사 비용으로 처리된 주주 개인 지출.' },
  { key: 'pphBorne', label: 'PPh ditanggung perusahaan', desc: '회사 부담 PPh', hint: '직원의 PPh 21을 회사가 부담한 경우 (Gross-up 제외).' },
  { key: 'provision', label: 'Cadangan/penyisihan', desc: '대손충당금 등 충당금', hint: '은행/보험 외 업종은 충당금 비용 불인정.' },
  { key: 'depreciationDiff', label: 'Selisih penyusutan (komersial > fiskal)', desc: '감가상각 차이 (상업>세무)', hint: '회계 감가상각이 세무 감가상각보다 큰 차이.' },
  { key: 'otherPositive', label: 'Koreksi positif lainnya', desc: '기타 가산 조정', hint: '' },
];

const NEGATIVE_CORRECTIONS = [
  { key: 'pphFinalIncome', label: 'Penghasilan PPh Final', desc: 'PPh Final 대상 소득 차감', hint: 'PPh Final로 이미 과세된 소득 (임대, UMKM 등). 법인세에서 제외.' },
  { key: 'nonTaxableIncome', label: 'Penghasilan bukan objek pajak', desc: '비과세 소득', hint: '지분 25% 이상 보유 자회사 배당금 등.' },
  { key: 'depreciationDiffNeg', label: 'Selisih penyusutan (fiskal > komersial)', desc: '감가상각 차이 (세무>상업)', hint: '세무 감가상각이 회계보다 큰 차이.' },
  { key: 'otherNegative', label: 'Koreksi negatif lainnya', desc: '기타 차감 조정', hint: '' },
];

export default function PPh25AnnualPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

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

  // Step 3: Inventory (재고관리대장)
  const [inventoryItems, setInventoryItems] = useState<Array<{
    name: string; beginning: string; purchases: string; ending: string;
  }>>([{ name: '', beginning: '', purchases: '', ending: '' }]);

  // Step 5: Koreksi Fiskal
  const [positiveCorr, setPositiveCorr] = useState<Record<string, string>>({});
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
  const totalPositive = Object.values(positiveCorr).reduce((s, v) => s + (Number(v) || 0), 0);
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
    { id: 1, label: '기본 정보' },
    { id: 2, label: '필요 서류' },
    { id: 3, label: '재고관리' },
    { id: 4, label: '상업이익' },
    { id: 5, label: '세무 조정' },
    { id: 6, label: '세액 공제' },
    { id: 7, label: '법인세 계산' },
    { id: 8, label: 'PPh 25 산정' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-600" />
          연 결산 — PPh 25 (일반 법인세 22%)
        </h1>
        <p className="text-sm text-gray-500 mt-1">{year}년 법인세 정산 + {year + 1}년 PPh 25 월분할액 산정</p>
      </div>

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-900">
            <p className="font-bold mb-1">PPh 25 연 결산이란?</p>
            <ul className="space-y-0.5 text-indigo-800">
              <li>• 회계 이익에 <b>세무 조정(Koreksi Fiskal)</b>을 적용하여 과세소득(PKP) 산출</li>
              <li>• PKP × <b>22%</b> = 법인세 (PPh Badan Terutang)</li>
              <li>• 매출 500억 이하 기업은 첫 48억분에 <b>50% 할인</b> (실효 11%)</li>
              <li>• 이미 납부한 세액(PPh 22/23/24/25)을 공제</li>
              <li>• 차기 년도 <b>PPh 25 월분할액</b> = (법인세 - 세액공제) ÷ 12</li>
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
          <h2 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-indigo-600" />기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-xs">회사명</Label><Input value={companyName} readOnly className="bg-gray-50" /></div>
            <div><Label className="text-xs">NPWP</Label><Input value={npwp} readOnly className="bg-gray-50 font-mono" /></div>
            <div>
              <Label className="text-xs">결산 연도</Label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full h-9 px-3 rounded-md border text-sm">
                {[currentYear - 1, currentYear - 2, currentYear].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">연간 매출</Label>
              <Input value={annualRevenue ? fmtRp(annualRevenue) : '미입력'} readOnly className="bg-gray-50 font-mono" />
              {annualRevenue > 0 && annualRevenue <= SME_THRESHOLD && (
                <p className="text-[11px] text-green-600 mt-1">✓ 매출 500억 이하 — PPh Badan 50% 할인 적용 대상</p>
              )}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>제출 기한: <b>{year + 1}년 4월 30일</b></span>
          </div>
        </CardContent></Card>
      )}

      {/* Step 2: Required documents */}
      {step === 2 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600" />필요 서류 체크리스트</h2>
          <p className="text-xs text-gray-500">PPh 25 연 결산에 필요한 서류입니다. PPh Final보다 더 많은 서류가 필요합니다.</p>
          <div className="space-y-2">
            {[
              { key: 'aktaPendirian', label: '최초 정관 (Akta Pendirian)', required: true },
              { key: 'aktaPerubahan', label: '최종 수정 정관 (Akta Perubahan Terakhir)', required: true },
              { key: 'skMenteri', label: 'SK Menteri (법무부 승인서)', required: true },
              { key: 'financialStatements', label: '재무제표 (Neraca + Laba Rugi)', required: true },
              { key: 'inventoryLedger', label: '재고관리대장 (Kartu Persediaan)', required: false },
              { key: 'depreciationSchedule', label: '감가상각 명세서 (Daftar Penyusutan)', required: true },
              { key: 'fixedAssetList', label: '고정자산 리스트', required: true },
              { key: 'contracts', label: '연중 체결 계약서 사본', required: true },
              { key: 'monthlyTaxRecords', label: '매월 세무신고 자료 (SPT Masa)', required: true },
            ].map(doc => (
              <label key={doc.key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  docs[doc.key as keyof typeof docs] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                <input type="checkbox" checked={docs[doc.key as keyof typeof docs]}
                  onChange={e => setDocs({ ...docs, [doc.key]: e.target.checked })}
                  className="mt-0.5 accent-green-600" />
                <div className="text-xs">
                  <span className="font-medium">{doc.label}</span>
                  {doc.required && <Badge className="ml-1 text-[8px] bg-red-100 text-red-700">필수</Badge>}
                </div>
                {docs[doc.key as keyof typeof docs] && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">준비: {Object.values(docs).filter(Boolean).length}/9</p>
        </CardContent></Card>
      )}

      {/* Step 3: Inventory ledger */}
      {step === 3 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" />재고관리대장 (Kartu Persediaan)</h2>
          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">HPP (매출원가) 계산 공식</p>
            <p className="font-mono mt-1">HPP = 기초재고 + 매입 - 기말재고</p>
            <p className="mt-1">재고가 없는 서비스업은 이 단계를 건너뛰어도 됩니다.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left border">품목명</th>
                  <th className="p-2 text-right border w-32">기초재고 (Rp)</th>
                  <th className="p-2 text-right border w-32">매입 (Rp)</th>
                  <th className="p-2 text-right border w-32">기말재고 (Rp)</th>
                  <th className="p-2 text-right border w-32">HPP (Rp)</th>
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
                          placeholder="품목명" />
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
                  <td className="p-2 border">합계</td>
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
            <Plus className="h-3 w-3 mr-1" />품목 추가
          </Button>
        </CardContent></Card>
      )}

      {/* Step 4: Commercial profit */}
      {step === 4 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-indigo-600" />상업 이익 (Laba Komersial)</h2>
          <p className="text-xs text-gray-500">재무제표의 순이익(Laba Bersih)을 입력하세요. 재무제표가 시스템에 있으면 자동으로 불러옵니다.</p>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">상업 순이익 (Rp)</Label>
              <Input type="number" value={commercialProfit} onChange={e => setCommercialProfit(e.target.value)} placeholder="0" className="font-mono" />
            </div>
            <Button variant="outline" onClick={loadFinancialStatements} disabled={loadingFS}>
              {loadingFS ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BookOpen className="h-3 w-3 mr-1" />}
              재무제표에서 불러오기
            </Button>
          </div>

          {fsNetIncome !== null && (
            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>재무제표 순이익: <b className="font-mono">{fmtRp(fsNetIncome)}</b></span>
            </div>
          )}

          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">다음 단계: 세무 조정 (Koreksi Fiskal)</p>
            <p className="mt-1">회계 이익 ≠ 세무 이익. 세무상 인정되지 않는 비용을 가산하고, 이미 과세된 소득을 차감합니다.</p>
          </div>
        </CardContent></Card>
      )}

      {/* Step 3: Koreksi Fiskal */}
      {step === 5 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Calculator className="h-5 w-5 text-indigo-600" />세무 조정 (Koreksi Fiskal)</h2>

          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-800">
            <p className="font-bold">세무 조정이란?</p>
            <p className="mt-1">회계(상업) 이익을 세무(과세) 이익으로 변환하는 과정입니다.</p>
            <p className="font-mono mt-1">과세소득(PKP) = 상업이익 + 가산조정(양) - 차감조정(음)</p>
          </div>

          {/* Positive corrections (가산) */}
          <div>
            <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">
              <Plus className="h-3 w-3" />가산 조정 (Koreksi Positif) — 비용 불인정
            </h3>
            <div className="space-y-2">
              {POSITIVE_CORRECTIONS.map(item => (
                <div key={item.key} className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                    {item.hint && <p className="text-[9px] text-amber-600 mt-0.5">{item.hint}</p>}
                  </div>
                  <Input type="number" className="w-40 h-8 text-xs font-mono text-right"
                    value={positiveCorr[item.key] || ''}
                    onChange={e => setPositiveCorr({ ...positiveCorr, [item.key]: e.target.value })}
                    placeholder="0" />
                </div>
              ))}
              <div className="flex justify-between p-2 bg-red-50 rounded font-bold text-xs text-red-700">
                <span>가산 소계</span><span className="font-mono">+ {fmtRp(totalPositive)}</span>
              </div>
            </div>
          </div>

          {/* Negative corrections (차감) */}
          <div>
            <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
              <X className="h-3 w-3" />차감 조정 (Koreksi Negatif) — 비과세/기과세 소득
            </h3>
            <div className="space-y-2">
              {NEGATIVE_CORRECTIONS.map(item => (
                <div key={item.key} className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                    {item.hint && <p className="text-[9px] text-blue-600 mt-0.5">{item.hint}</p>}
                  </div>
                  <Input type="number" className="w-40 h-8 text-xs font-mono text-right"
                    value={negativeCorr[item.key] || ''}
                    onChange={e => setNegativeCorr({ ...negativeCorr, [item.key]: e.target.value })}
                    placeholder="0" />
                </div>
              ))}
              <div className="flex justify-between p-2 bg-blue-50 rounded font-bold text-xs text-blue-700">
                <span>차감 소계</span><span className="font-mono">- {fmtRp(totalNegative)}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-100 rounded-xl p-4 space-y-1 text-xs">
            <div className="flex justify-between"><span>상업 이익</span><span className="font-mono">{fmtRp(commercial)}</span></div>
            <div className="flex justify-between text-red-700"><span>+ 가산 조정</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
            <div className="flex justify-between text-blue-700"><span>- 차감 조정</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
            <div className="flex justify-between font-bold text-sm border-t border-indigo-300 pt-2">
              <span>과세소득 (PKP)</span>
              <span className="font-mono">{fmtRp(fiscalProfit)}</span>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Step 4: Tax credits */}
      {step === 6 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-indigo-600" />세액 공제 (Kredit Pajak)</h2>
          <p className="text-xs text-gray-500">연중 이미 납부하거나 원천징수된 세액을 입력하세요. 이 금액이 법인세에서 공제됩니다.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">PPh 22 (수입 원천징수)</Label>
              <Input type="number" value={pph22Credit} onChange={e => setPph22Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">수입 시 세관에서 원천징수된 PPh 22</p>
            </div>
            <div>
              <Label className="text-xs">PPh 23 (서비스 원천징수)</Label>
              <Input type="number" value={pph23Credit} onChange={e => setPph23Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">거래처가 원천징수한 PPh 23 (Bukti Potong 합계)</p>
            </div>
            <div>
              <Label className="text-xs">PPh 24 (해외 세액공제)</Label>
              <Input type="number" value={pph24Credit} onChange={e => setPph24Credit(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">해외에서 납부한 세금 (DTA 조세조약 한도)</p>
            </div>
            <div>
              <Label className="text-xs">PPh 25 (월 분할납부 합계)</Label>
              <Input type="number" value={pph25Paid} onChange={e => setPph25Paid(e.target.value)} className="font-mono" placeholder="0" />
              <p className="text-[10px] text-gray-400 mt-1">{year}년 1~12월 PPh 25 납부 합계</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs font-bold flex justify-between">
            <span>세액 공제 합계</span><span className="font-mono">{fmtRp(totalCredits)}</span>
          </div>
        </CardContent></Card>
      )}

      {/* Step 5: Tax calculation result */}
      {step === 7 && (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-indigo-500"><CardContent className="p-5">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Calculator className="h-5 w-5 text-indigo-600" />{year}년 법인세 (PPh Badan) 계산</h2>

            <div className="max-w-lg space-y-1 text-xs">
              <div className="flex justify-between"><span>상업 이익</span><span className="font-mono">{fmtRp(commercial)}</span></div>
              <div className="flex justify-between text-red-700"><span>+ 가산 조정</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
              <div className="flex justify-between text-blue-700"><span>- 차감 조정</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>과세소득 (PKP)</span><span className="font-mono">{fmtRp(fiscalProfit)}</span></div>
              <div className="flex justify-between mt-2">
                <span>PPh Badan {hasSmeDiscount ? '(50% 할인 적용)' : ''} × 22%</span>
                <span className="font-mono font-bold">{fmtRp(pphBadan)}</span>
              </div>
              {hasSmeDiscount && (
                <p className="text-[10px] text-green-600">✓ 매출 {fmtRp(annualRevenue)} ≤ 500억 → 첫 48억분에 50% 할인</p>
              )}
              <div className="border-t mt-2 pt-2 space-y-0.5">
                <div className="flex justify-between"><span>- PPh 22 공제</span><span className="font-mono">{fmtRp(Number(pph22Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>- PPh 23 공제</span><span className="font-mono">{fmtRp(Number(pph23Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>- PPh 24 공제</span><span className="font-mono">{fmtRp(Number(pph24Credit) || 0)}</span></div>
                <div className="flex justify-between"><span>- PPh 25 납부</span><span className="font-mono">{fmtRp(Number(pph25Paid) || 0)}</span></div>
              </div>
              <div className={`flex justify-between font-bold text-sm border-t-2 pt-2 ${isUnderpaid ? 'text-red-700 border-red-500' : isOverpaid ? 'text-blue-700 border-blue-500' : 'text-green-700 border-green-500'}`}>
                <span>{isUnderpaid ? '추가 납부 (Kurang Bayar)' : isOverpaid ? '초과 납부 (Lebih Bayar)' : '정산 완료'}</span>
                <span className="font-mono">{fmtRp(Math.abs(taxDue))}</span>
              </div>
            </div>
          </CardContent></Card>

          {isUnderpaid && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-bold text-red-900">추가 납부: {fmtRp(taxDue)}</p>
                <p className="text-xs text-red-700">SPT Tahunan 제출 전까지 차액을 납부해야 합니다 (PPh 29).</p>
              </div>
            </div>
          )}
          {isOverpaid && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-bold text-blue-900">초과 납부: {fmtRp(Math.abs(taxDue))}</p>
                <p className="text-xs text-blue-700">이월(Kompensasi) 또는 환급(Restitusi) 선택 가능</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 6: Next year PPh 25 */}
      {step === 8 && (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-green-500 bg-green-50"><CardContent className="p-5">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Calendar className="h-5 w-5 text-green-600" />{year + 1}년 PPh 25 월 분할액 산정</h2>

            <div className="bg-white rounded-lg p-4 max-w-lg space-y-1 text-xs">
              <div className="flex justify-between"><span>{year}년 PPh Badan</span><span className="font-mono">{fmtRp(pphBadan)}</span></div>
              <div className="flex justify-between"><span>- PPh 22 공제</span><span className="font-mono">{fmtRp(Number(pph22Credit) || 0)}</span></div>
              <div className="flex justify-between"><span>- PPh 23 공제</span><span className="font-mono">{fmtRp(Number(pph23Credit) || 0)}</span></div>
              <div className="flex justify-between"><span>- PPh 24 공제</span><span className="font-mono">{fmtRp(Number(pph24Credit) || 0)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>PPh 25 기준액</span><span className="font-mono">{fmtRp(Math.max(pphBadan - (Number(pph22Credit) || 0) - (Number(pph23Credit) || 0) - (Number(pph24Credit) || 0), 0))}</span></div>
              <div className="flex justify-between"><span>÷ 12개월</span><span></span></div>
              <div className="flex justify-between font-bold text-lg border-t-2 border-green-500 pt-2 text-green-700">
                <span>{year + 1}년 월 PPh 25</span>
                <span className="font-mono">{fmtRp(nextYearMonthly)}</span>
              </div>
            </div>

            <p className="text-xs text-green-800 mt-3">
              {year + 1}년 1월부터 매월 <b>{fmtRp(nextYearMonthly)}</b>을 10일까지 납부합니다.
              매출 변동이 크면 PMK-44로 조정 신청이 가능합니다.
            </p>
          </CardContent></Card>

          <Card className="bg-gray-50"><CardContent className="p-4">
            <h3 className="font-bold text-sm mb-2">다음 단계</h3>
            <div className="space-y-2 text-xs">
              {isUnderpaid && (
                <div className="flex items-center gap-2 p-2 bg-white rounded border">
                  <Badge className="bg-red-100 text-red-700">1</Badge>
                  <span>PPh 29 추가 납부: {fmtRp(taxDue)}</span>
                  <a href={`/${locale}/tax/monthly-payments`} className="ml-auto text-blue-600 hover:underline">납부 →</a>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Badge className="bg-blue-100 text-blue-700">{isUnderpaid ? '2' : '1'}</Badge>
                <span>SPT Tahunan 1771 작성 + DJP 제출</span>
                <a href={`/${locale}/tax/spt-tahunan/1771`} className="ml-auto text-blue-600 hover:underline">SPT 1771 →</a>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border">
                <Badge className="bg-blue-100 text-blue-700">{isUnderpaid ? '3' : '2'}</Badge>
                <span>{year + 1}년 월 PPh 25 {fmtRp(nextYearMonthly)} 납부 시작</span>
                <a href={`/${locale}/tax/monthly-payments`} className="ml-auto text-blue-600 hover:underline">납부 →</a>
              </div>
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />이전</Button>
        ) : <div />}
        {step < 8 ? (
          <Button onClick={() => setStep(step + 1)}>다음<ArrowRight className="h-4 w-4 ml-1" /></Button>
        ) : null}
      </div>
    </div>
  );
}
