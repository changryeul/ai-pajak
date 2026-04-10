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
  Calculator, Calendar, Loader2, Plus, X, ClipboardList, Upload,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const CORPORATE_RATE = 0.22; // PPh Badan 22%
const SME_THRESHOLD = 50_000_000_000; // Rp 50B for 50% discount on first 4.8B
const SME_BRACKET = 4_800_000_000; // Rp 4.8B

// Koreksi Fiskal items (common corrections)
const POSITIVE_CORRECTIONS = [
  // ── 전액 손금불산입 (100%) ──
  {
    key: 'entertainment', hasRate: false,
    label: 'Biaya entertainment (접대비)',
    desc: '접대비 — 전액 손금불산입',
    hint: 'Pasal 9(1)(e) UU PPh — 접대비는 전액 세무상 비용으로 인정되지 않습니다. 다만, "Daftar Nominatif"(명목 리스트)를 첨부하면 50%까지 인정됩니다. 명목 리스트가 없으면 100% 불산입.',
  },
  {
    key: 'welfare', hasRate: true, defaultRate: 100,
    label: 'Biaya kesejahteraan karyawan (복리후생비)',
    desc: '복리후생비 — 전직원 회식비 제외, 나머지 전액 불산입',
    hint: '전 직원 대상 회식비(makan bersama seluruh karyawan)만 100% 손금산입. 개인 식대, 일부 직원 대상 혜택, 레크리에이션 등은 불산입. 회식 영수증에 참석자 명단이 있어야 인정됩니다.',
  },
  {
    key: 'donation', hasRate: false,
    label: 'Sumbangan/donasi (기부금)',
    desc: '기부금 — 전액 손금불산입',
    hint: 'Pasal 9(1)(g) UU PPh — 일반 기부금은 전액 불인정. 단, 국가 재난 기부금(PP 93/2010)과 교육/R&D/사회시설 기부금은 일부 인정.',
  },
  {
    key: 'taxPenalty', hasRate: false,
    label: 'Denda & sanksi pajak (세금 벌금)',
    desc: '세금 벌금/가산금 — 전액 손금불산입',
    hint: 'Pasal 9(1)(k) UU PPh — 세무 관련 벌금, 가산금, 이자 제재는 세무상 비용으로 인정되지 않습니다.',
  },
  {
    key: 'personalExpense', hasRate: false,
    label: 'Biaya pribadi (주주/경영진 개인비용)',
    desc: '개인 비용 — 전액 손금불산입',
    hint: 'Pasal 9(1)(b) UU PPh — 회사 비용으로 처리된 주주/이사 개인 지출(가족 여행, 개인 물품 등).',
  },
  {
    key: 'pphBorne', hasRate: false,
    label: 'PPh ditanggung perusahaan (회사부담 PPh)',
    desc: '회사가 부담한 직원 소득세 — 전액 불산입',
    hint: 'Pasal 9(1)(h) UU PPh — 회사가 직원 PPh 21을 대신 부담한 경우. 단, Gross-up 방식(세금을 수당으로 처리)이면 손금산입 가능.',
  },
  {
    key: 'provision', hasRate: false,
    label: 'Cadangan/penyisihan (충당금)',
    desc: '충당금 — 전액 손금불산입',
    hint: 'Pasal 9(1)(c) UU PPh — 대손충당금, 보증충당금 등. 은행/보험/리스/광업 업종만 일부 인정.',
  },

  // ── 감가상각 차이 ──
  {
    key: 'depreciationDiff', hasRate: false,
    label: 'Selisih penyusutan (감가상각 차이)',
    desc: '감가상각 — 세무 규정에 따라 전액 손금산입',
    hint: 'Pasal 11 UU PPh — 감가상각은 세무 규정(Kelompok 1~4, 건물)에 따라 계산한 금액을 전액 손금산입합니다. 상업 감가상각이 세무보다 크면 그 차이만 가산 조정합니다.',
  },

  // ── 비율 선택 항목 ──
  {
    key: 'vehicleFuel', hasRate: true, defaultRate: 50,
    label: 'Biaya BBM kendaraan (차량 연료비)',
    desc: '차량 연료비 — 50% 손금산입 (영수증 100%시 전액)',
    hint: 'SE-09/PJ.42/2002 — 업무 겸용 차량 연료비는 50%만 인정. 단, 업무 전용 차량임을 증명(운행일지)하면 100% 인정 가능.',
  },
  {
    key: 'tollExpense', hasRate: true, defaultRate: 50,
    label: 'Biaya tol (고속도로 톨비)',
    desc: '톨비 — 기본 50%, 영수증 전부 첨부 시 100%',
    hint: '톨 영수증(struk tol)을 모두 첨부하면 100% 손금산입. 영수증이 불완전하면 50%만 인정. e-Toll 이용내역서도 인정됩니다.',
  },
  {
    key: 'vehicleMaint', hasRate: true, defaultRate: 50,
    label: 'Biaya perawatan kendaraan (차량 유지비)',
    desc: '차량 정비/보험/감가상각 — 50% 손금산입',
    hint: 'SE-09/PJ.42/2002 — 업무 겸용 차량의 정비, 보험, 감가상각은 50%만 인정.',
  },
  {
    key: 'phoneExpense', hasRate: true, defaultRate: 50,
    label: 'Biaya telepon/pulsa (통신비)',
    desc: '통신비 — 50% 손금산입',
    hint: '업무 겸용 휴대폰/인터넷 비용은 50%만 인정. 회사 전용 회선이면 100%.',
  },
  {
    key: 'housingRent', hasRate: true, defaultRate: 100,
    label: 'Biaya sewa rumah karyawan (직원 주택 렌트비)',
    desc: '직원 주택 — 세법에 따라 손금산입 여부 결정',
    hint: 'Pasal 9(1)(e) & PMK-167/2018 — 직원 주택 렌트비는 "natura/kenikmatan"에 해당합니다.\n\n• 2024년 이후: PP 55/2022에 따라 직원 주택 제공이 과세 소득이 되므로 회사는 손금산입 가능.\n• 단, 직원의 PPh 21에 주택 혜택이 포함되어야 합니다.\n• 임원/이사 주택은 별도 검토 필요.',
  },
  {
    key: 'educationFee', hasRate: true, defaultRate: 100,
    label: 'Biaya pendidikan (직원 학자금)',
    desc: '학자금 — 업무 관련성에 따라 손금산입',
    hint: 'SE-27/PJ.22/1986 — 직원 교육/훈련비는 업무와 직접 관련된 경우 100% 손금산입.\n\n• 업무 관련 교육(세미나, 자격증, 직무 훈련): 100% 인정\n• 직원 자녀 학비: 불인정 (개인 비용)\n• 임원 MBA 등 일반 학위: 관련성 증빙 필요\n\n비율을 조정하여 업무 무관 부분을 불산입 처리하세요.',
  },

  // ── 기타 ──
  {
    key: 'travelExpense', hasRate: true, defaultRate: 40,
    label: 'Biaya perjalanan dinas (출장비)',
    desc: '출장비 — 증빙 불비분 불산입',
    hint: '출장비 중 영수증/증빙이 없는 부분은 불인정. 비율을 조정하세요.',
  },
  {
    key: 'otherOpex', hasRate: true, defaultRate: 50,
    label: 'Biaya operasional lainnya (기타 운영비)',
    desc: '기타 — 비율 선택하여 부분 불인정',
    hint: '위 항목에 해당하지 않는 기타 비용. 불산입 비율을 선택하세요.',
  },
  {
    key: 'otherPositive', hasRate: false,
    label: 'Koreksi positif lainnya (기타 가산 전액)',
    desc: '기타 가산 조정 — 전액',
    hint: '',
  },
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
  const [positiveCorrRates, setPositiveCorrRates] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    POSITIVE_CORRECTIONS.filter(c => c.hasRate).forEach(c => {
      defaults[c.key] = (c as { defaultRate?: number }).defaultRate || 50;
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

      {/* Step 2: Required documents (PPh Final과 동일 수준 상세) */}
      {step === 2 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600" />필요 서류 체크리스트</h2>
          <p className="text-xs text-gray-500">
            PPh 25 연 결산에 필요한 서류입니다. 각 항목을 확인하고 <b>업로드</b>해 주세요.
            미준비 서류는 <b>AI가 자동으로 요청</b>합니다.
          </p>
          <div className="space-y-2">
            {[
              { key: 'aktaPendirian', label: '최초 정관 (Akta Pendirian)', required: true,
                desc: '회사를 처음 설립할 때 Notaris(공증인)가 작성한 공증 정관입니다.',
                detail: '어디서 찾나요? → 회사 설립 시 Notaris가 준 원본 또는 사본. 분실 시 해당 Notaris 사무실에 재발급 요청.',
                format: 'PDF 스캔 또는 사진 촬영' },
              { key: 'aktaPerubahan', label: '최종 수정 정관 (Akta Perubahan Terakhir)', required: true,
                desc: '가장 최근에 수정한 정관입니다. 주주/이사 변경, 자본금 변경 등이 반영됩니다.',
                detail: '설립 후 변경이 없다면 최초 정관과 동일합니다.',
                format: 'PDF 스캔 또는 사진 촬영' },
              { key: 'skMenteri', label: 'SK Menteri (법무인권부 승인서)', required: true,
                desc: 'Surat Keputusan Menteri Hukum dan HAM — 법무인권부 장관이 발행하는 법인 설립/변경 승인서입니다.',
                detail: 'AHU 번호가 포함된 문서입니다. Notaris를 통해 받으며, AHU Online (ahu.go.id)에서도 확인 가능합니다.',
                format: 'PDF 또는 사진 (AHU 번호가 보이게)' },
              { key: 'financialStatements', label: '재무제표 (Neraca + Laba Rugi)', required: true,
                desc: '재무상태표(Neraca)와 손익계산서(Laporan Laba Rugi)입니다.',
                detail: '회계사가 작성했거나 AI Pajak의 재무제표 생성 기능으로 만든 것을 사용하세요. 저널이 없으면 은행거래+Petty Cash로 생성 가능.',
                format: 'PDF 또는 Excel' },
              { key: 'inventoryLedger', label: '재고관리대장 (Kartu Persediaan)', required: false,
                desc: '재고 품목별 기초재고/매입/기말재고 내역입니다. HPP(매출원가) 계산에 사용됩니다.',
                detail: '서비스업(재고 없음)은 제출 불필요. 다음 단계(Step 3)에서 직접 입력할 수도 있습니다.',
                format: 'Excel 또는 PDF' },
              { key: 'depreciationSchedule', label: '감가상각 명세서 (Daftar Penyusutan Aktiva Tetap)', required: true,
                desc: '고정자산별 감가상각 내역입니다. 세무 감가상각은 Kelompok 1~4 및 건물로 구분됩니다.',
                detail: 'Kelompok 1: 4년(25%), Kelompok 2: 8년(12.5%), Kelompok 3: 16년(6.25%), Kelompok 4: 20년(5%), 건물(영구): 20년(5%), 건물(비영구): 10년(10%).',
                format: 'Excel (취득일/취득가/내용연수/상각액)' },
              { key: 'fixedAssetList', label: '고정자산 리스트 (Daftar Aktiva Tetap)', required: true,
                desc: '회사가 보유한 모든 자산 목록입니다.',
                detail: '차량, 컴퓨터, 가구, 건물, 기계 등. 각 자산의 취득일, 취득 가격을 포함합니다.',
                format: 'Excel 또는 PDF' },
              { key: 'contracts', label: '연중 체결 계약서 사본', required: true,
                desc: `${year}년 중 체결한 모든 계약서입니다.`,
                detail: '거래처 계약, 사무실 임대차 계약, 서비스 계약, 고용 계약 등 금액이 포함된 모든 계약.',
                format: 'PDF 스캔 또는 사진 (여러 파일 가능)' },
              { key: 'monthlyTaxRecords', label: '매월 세무신고 자료 (SPT Masa)', required: true,
                desc: `${year}년 1~12월 매월 신고한 세무 자료입니다.`,
                detail: '다음 중 해당하는 것을 모두 업로드하세요:\n• SPT Masa PPh 21 — 직원이 있는 경우 (급여 원천징수)\n• SPT Masa PPh 23 — 서비스 비용을 지급한 경우\n• SPT Masa PPh 4(2) — 임대/건설 등 Final Tax\n• SPT Masa PPN — PKP 등록 사업자인 경우\n• PPh 25 월 분할 납부 영수증 (NTPN)\n\nAI Pajak으로 신고했다면 자동 수집되므로 별도 업로드 불필요.',
                format: 'PDF 또는 사진 (월별로 업로드)' },
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
                      {doc.required && <Badge className="text-[8px] bg-red-100 text-red-700">필수</Badge>}
                    </div>
                    <p className="text-gray-600 mt-0.5">{doc.desc}</p>
                    <details className="mt-1">
                      <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">자세한 안내 보기</summary>
                      <div className="mt-1 p-2 bg-white rounded text-[10px] text-gray-600 whitespace-pre-line">
                        {doc.detail}
                        <p className="mt-1 text-blue-700">📎 업로드 형식: {doc.format}</p>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {docs[doc.key as keyof typeof docs] && <CheckCircle className="h-4 w-4 text-green-600" />}
                    <a href={`/${locale}/documents/upload`}
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                      title="이 서류 업로드">
                      <Upload className="h-3 w-3 text-blue-600" />
                    </a>
                  </div>
                </label>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs">
            <p className="text-gray-600">
              준비 상태: <b>{Object.values(docs).filter(Boolean).length}/9</b> 완료
              {Object.values(docs).filter(Boolean).length < 6 && (
                <span className="text-amber-600 ml-2">— 미준비 서류는 AI가 자동으로 요청합니다</span>
              )}
            </p>
          </div>
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
              {POSITIVE_CORRECTIONS.map(item => {
                const hasRate = item.hasRate;
                const rate = positiveCorrRates[item.key] || 100;
                const rawAmount = Number(positiveCorr[item.key]) || 0;
                const adjustedAmount = hasRate ? Math.round(rawAmount * rate / 100) : rawAmount;
                return (
                <div key={item.key} className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                    {item.hint && <p className="text-[9px] text-amber-600 mt-0.5">{item.hint}</p>}
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
                      placeholder="총액" />
                  </div>
                  {hasRate && rawAmount > 0 && (
                    <p className="text-[9px] text-red-600 flex-shrink-0 w-24 text-right">
                      불산입: {fmtRp(adjustedAmount)}
                    </p>
                  )}
                </div>
                );
              })}
              <div className="flex justify-between p-2 bg-red-50 rounded font-bold text-xs text-red-700">
                <span>가산 소계 (비율 적용 후)</span><span className="font-mono">+ {fmtRp(totalPositive)}</span>
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
                  <div className="flex-shrink-0">
                    <Input type="number" className="w-40 h-8 text-xs font-mono text-right"
                      value={negativeCorr[item.key] || ''}
                      onChange={e => setNegativeCorr({ ...negativeCorr, [item.key]: e.target.value })}
                      placeholder="0" />
                  </div>
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
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-900 text-lg">추가 납부 필요: {fmtRp(taxDue)}</p>
                  <p className="text-xs text-red-700 mt-1">SPT Tahunan 제출 전까지 납부해야 합니다 (PPh 29).</p>
                </div>
              </div>

              {/* 차액 산출 내역 */}
              <div className="bg-white rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-gray-700 mb-2">차액 산출 내역</p>
                <div className="flex justify-between"><span>상업 이익</span><span className="font-mono">{fmtRp(commercial)}</span></div>
                <div className="flex justify-between"><span>+ 가산 조정</span><span className="font-mono">{fmtRp(totalPositive)}</span></div>
                <div className="flex justify-between"><span>- 차감 조정</span><span className="font-mono">{fmtRp(totalNegative)}</span></div>
                <div className="flex justify-between border-t pt-1"><span>과세소득 (PKP)</span><span className="font-mono">{fmtRp(fiscalProfit)}</span></div>
                <div className="flex justify-between"><span>PPh Badan 22%{hasSmeDiscount ? ' (SME 할인)' : ''}</span><span className="font-mono">{fmtRp(pphBadan)}</span></div>
                <div className="flex justify-between"><span>- 세액 공제 합계</span><span className="font-mono">- {fmtRp(totalCredits)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-red-700">
                  <span>미납 차액 (PPh 29)</span><span className="font-mono">{fmtRp(taxDue)}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 text-[11px] text-gray-600">
                <p className="font-bold text-gray-700 mb-1">왜 차액이 발생하나요?</p>
                <ul className="space-y-0.5">
                  <li>• 실제 이익이 전년도 기준으로 납부한 PPh 25보다 높은 경우</li>
                  <li>• 세무 조정(Koreksi Fiskal)으로 과세소득이 증가한 경우</li>
                  <li>• PPh 25 월 분할 납부가 일부 누락된 경우</li>
                </ul>
              </div>

              <div className="bg-red-100 rounded-lg p-3">
                <p className="text-xs font-bold text-red-900 mb-2">납부 방법: AI가 ID Billing을 생성합니다</p>
                <div className="flex items-center gap-2 text-xs text-red-800 mb-2">
                  <span>세목: <b>PPh 29</b></span>
                  <span>·</span>
                  <span>금액: <b className="font-mono">{fmtRp(taxDue)}</b></span>
                  <span>·</span>
                  <span>기한: <b>{year + 1}년 4월 30일</b></span>
                </div>
                <a href={`/${locale}/tax/billing`}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                  <DollarSign className="h-3 w-3" />
                  청구서 · 납부 페이지에서 확인
                </a>
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
              {year + 1}년 1월부터 매월 <b>{fmtRp(nextYearMonthly)}</b>을 <b>15일까지</b> 납부합니다 (Coretax / PMK 81/2024).
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
