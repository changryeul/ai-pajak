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
  Store, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft,
  Loader2, Shield, Calendar, DollarSign, FileText, Sparkles,
  Download, HelpCircle, Upload, Camera, FolderOpen, BookOpen,
  ClipboardList,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

const UMKM_RATE = 0.005;
const EXEMPTION = 500_000_000;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function PPhFinalAnnualPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState(1);
  const [year, setYear] = useState(currentYear - 1); // 전년도 결산
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [npwp, setNpwp] = useState('');
  const [umkmStartYear, setUmkmStartYear] = useState(0);

  // Step 2: Monthly revenue data
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>(Array(12).fill(0));
  const [monthlyPaid, setMonthlyPaid] = useState<number[]>(Array(12).fill(0));

  // Step 2: Required documents checklist
  const [docs, setDocs] = useState({
    aktaPendirian: false,     // 최초 정관
    aktaPerubahan: false,     // 최종 수정 정관
    skMenteri: false,         // SK (Surat Keputusan Menteri)
    fixedAssetList: false,    // 고정자산 리스트
    contracts: false,         // 연중 계약서 사본
    monthlyTaxRecords: false, // 매월 세무신고 자료
  });

  // Step 3: Financial statement path
  const [fsPath, setFsPath] = useState<'JOURNAL' | 'BANK_PETTY' | null>(null);
  // JOURNAL: 고객이 저널 제공 → 우리가 재무제표 작성
  // BANK_PETTY: 은행거래내역 + petty cash → 우리가 저널+재무제표 작성

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
  const getMonthlyTax = (monthIdx: number): number => {
    const cumulativeRevBefore = monthlyRevenue.slice(0, monthIdx).reduce((s, v) => s + v, 0);
    const cumulativeRevAfter = cumulativeRevBefore + monthlyRevenue[monthIdx];
    const exemptBefore = Math.min(cumulativeRevBefore, EXEMPTION);
    const exemptAfter = Math.min(cumulativeRevAfter, EXEMPTION);
    const newExempt = exemptAfter - exemptBefore;
    const taxable = monthlyRevenue[monthIdx] - newExempt;
    return Math.round(Math.max(taxable, 0) * UMKM_RATE);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-green-600" />
          연 결산 — PPh Final UMKM
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {year}년 UMKM 법인세 연간 정산 및 SPT Tahunan Badan 1771 작성
        </p>
      </div>

      {/* Educational banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-green-900">
            <p className="font-bold mb-1">PPh Final UMKM 연 결산이란?</p>
            <ul className="space-y-0.5 text-green-800">
              <li>• 매월 납부한 PPh Final 0.5%의 <b>연간 합계</b>를 정리합니다</li>
              <li>• 연 매출 <b>{fmtRp(EXEMPTION)} (5억)</b>까지 비과세 (PP 55/2022)</li>
              <li>• 과부족이 있으면 추가 납부 또는 이월 처리합니다</li>
              <li>• SPT Tahunan Badan 1771 양식으로 DJP에 제출합니다</li>
              <li>• <b>제출 기한</b>: 다음 해 4월 30일</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto">
        {[
          { id: 1, label: '기본 정보' },
          { id: 2, label: '필요 서류' },
          { id: 3, label: '재무제표' },
          { id: 4, label: '월별 매출' },
          { id: 5, label: '기타 소득' },
          { id: 6, label: '정산 결과' },
          { id: 7, label: 'SPT 생성' },
        ].map((s, i) => (
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
              기본 정보 확인
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">회사명</Label>
                <Input value={companyName} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label className="text-xs">NPWP</Label>
                <Input value={npwp} readOnly className="bg-gray-50 font-mono" />
              </div>
              <div>
                <Label className="text-xs">결산 연도</Label>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  {[currentYear - 1, currentYear - 2, currentYear].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">UMKM PPh Final 시작 연도</Label>
                <Input value={umkmStartYear || '미등록'} readOnly className="bg-gray-50" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
              <p className="font-bold">적용 세율</p>
              <p className="mt-1">
                PPh Final <b>0.5%</b> × (월 매출 - 비과세 공제)
              </p>
              <p className="mt-1">
                비과세: 연 {fmtRp(EXEMPTION)} (누적 기준, 초과분부터 과세)
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <Calendar className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">제출 기한</p>
                <p>{year + 1}년 4월 30일 — 이 날까지 SPT Tahunan Badan 1771을 DJP에 제출해야 합니다</p>
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
              필요 서류 체크리스트
            </h2>
            <p className="text-xs text-gray-500">
              연 결산 및 SPT 1771 작성에 필요한 서류입니다. 준비된 서류를 체크하고 업로드해 주세요.
              <b> 미준비 항목은 JTC 담당자가 별도 요청</b>합니다.
            </p>

            <div className="space-y-2">
              {[
                { key: 'aktaPendirian', label: '최초 정관 (Akta Pendirian)', desc: '회사 설립 시 작성한 공증 정관 원본. Notaris 공증 포함.', required: true },
                { key: 'aktaPerubahan', label: '최종 수정 정관 (Akta Perubahan Terakhir)', desc: '가장 최근 수정한 정관. 주주/이사 변경 등이 반영된 버전.', required: true },
                { key: 'skMenteri', label: 'SK Menteri (법무부 승인서)', desc: 'Surat Keputusan Menteri Hukum & HAM. AHU 번호 포함.', required: true },
                { key: 'fixedAssetList', label: '고정자산 리스트 (Daftar Aktiva Tetap)', desc: '보유 자산 목록: 취득일, 취득가, 감가상각 내역. 없으면 "없음" 체크.', required: false },
                { key: 'contracts', label: '연중 체결 계약서 사본', desc: `${year}년 중 체결한 모든 계약서 (거래처/임대/서비스/고용 등).`, required: true },
                { key: 'monthlyTaxRecords', label: '매월 세무신고 자료', desc: `${year}년 1~12월 SPT Masa 신고 내역 (PPh 21/23/4(2)/PPN). AI Pajak으로 신고했다면 자동 수집됨.`, required: true },
              ].map(doc => (
                <label key={doc.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    docs[doc.key as keyof typeof docs] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input type="checkbox"
                    checked={docs[doc.key as keyof typeof docs]}
                    onChange={e => setDocs({ ...docs, [doc.key]: e.target.checked })}
                    className="mt-0.5 accent-green-600" />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.label}</span>
                      {doc.required && <Badge className="text-[8px] bg-red-100 text-red-700">필수</Badge>}
                    </div>
                    <p className="text-gray-500 mt-0.5">{doc.desc}</p>
                  </div>
                  {docs[doc.key as keyof typeof docs] && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                </label>
              ))}
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
              <Upload className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">서류 업로드</p>
                <p className="mt-0.5">
                  "자료 업로드" 메뉴에서 위 서류를 업로드할 수 있습니다.
                  업로드된 서류는 JTC 세무사가 검토합니다.
                </p>
                <a href={`/${locale}/documents/upload`} className="text-blue-600 hover:underline mt-1 inline-block">
                  자료 업로드 페이지로 이동 →
                </a>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs">
              <p className="text-gray-600">
                준비 상태: <b>{Object.values(docs).filter(Boolean).length}/6</b> 완료
                {Object.values(docs).filter(Boolean).length < 4 && (
                  <span className="text-amber-600 ml-2">— 미준비 서류는 JTC가 별도 요청합니다</span>
                )}
              </p>
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
              재무제표 준비
            </h2>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                PPh Final도 SPT 1771에 재무제표가 필수입니다
              </p>
              <p className="text-xs text-amber-800 mt-1">
                UMKM이라도 SPT Tahunan Badan 1771 제출 시 <b>Laporan Keuangan (재무제표)</b>가 반드시 첨부되어야 합니다.
                재무제표에는 Neraca (재무상태표)와 Laporan Laba Rugi (손익계산서)가 포함됩니다.
              </p>
            </div>

            <p className="text-sm font-medium">재무제표 준비 방법을 선택하세요:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Path A: Customer has journal */}
              <button type="button"
                onClick={() => setFsPath('JOURNAL')}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  fsPath === 'JOURNAL' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <BookOpen className={`h-8 w-8 mb-2 ${fsPath === 'JOURNAL' ? 'text-green-600' : 'text-gray-400'}`} />
                <p className="font-bold text-sm">A. 저널(회계 장부)이 있습니다</p>
                <p className="text-xs text-gray-600 mt-2">
                  회사에서 작성한 회계 저널(Jurnal Umum)을 업로드하면
                  JTC가 이를 기반으로 재무제표를 작성합니다.
                </p>
                <div className="mt-3 text-[10px] text-green-700 bg-green-100 rounded p-2">
                  <p className="font-bold">필요한 것:</p>
                  <p>• Jurnal Umum (일반 저널) — Excel 또는 회계SW 출력물</p>
                  <p>• Buku Besar (총계정원장) — 있으면 추가</p>
                </div>
              </button>

              {/* Path B: No journal — bank statements */}
              <button type="button"
                onClick={() => setFsPath('BANK_PETTY')}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  fsPath === 'BANK_PETTY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <FolderOpen className={`h-8 w-8 mb-2 ${fsPath === 'BANK_PETTY' ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="font-bold text-sm">B. 저널이 없습니다</p>
                <p className="text-xs text-gray-600 mt-2">
                  회계 장부가 없는 경우, 법인 계좌 거래내역과 현금 출납(Petty Cash)을
                  제출하면 JTC가 저널 + 재무제표를 대신 작성합니다.
                </p>
                <div className="mt-3 text-[10px] text-blue-700 bg-blue-100 rounded p-2">
                  <p className="font-bold">필요한 것:</p>
                  <p>• 법인 은행 계좌 거래내역서 (Rekening Koran) — {year}년 1~12월 전체</p>
                  <p>• Petty Cash (현금 출납부) — 있으면 (Excel 또는 수기 노트 촬영)</p>
                  <p>• 매출/매입 영수증 원본 (증빙)</p>
                </div>
              </button>
            </div>

            {fsPath && (
              <div className={`rounded-xl p-4 border ${
                fsPath === 'JOURNAL' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <p className="text-xs font-bold mb-2">
                  {fsPath === 'JOURNAL' ? '✅ 저널 기반 재무제표 작성' : '✅ 은행거래 기반 재무제표 작성'}
                </p>
                <p className="text-xs text-gray-700">
                  {fsPath === 'JOURNAL'
                    ? '저널 데이터를 "자료 업로드" 페이지에서 업로드해 주세요. JTC 세무사가 검토 후 Neraca + Laporan Laba Rugi를 작성합니다.'
                    : '은행 거래내역서와 Petty Cash 내역을 "자료 업로드" 페이지에서 업로드해 주세요. JTC가 저널 작성 → 재무제표 작성을 대행합니다.'}
                </p>
                <a href={`/${locale}/documents/upload`}
                  className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                    fsPath === 'JOURNAL' ? 'text-green-700' : 'text-blue-700'
                  } hover:underline`}>
                  <Upload className="h-3 w-3" />자료 업로드 페이지로 이동
                </a>

                {fsPath === 'BANK_PETTY' && (
                  <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-800">
                    <p className="font-bold">💡 Petty Cash가 뭔가요?</p>
                    <p className="mt-0.5">
                      사무실에서 현금으로 소액 결제한 내역입니다 (교통비, 사무용품, 식대 등).
                      Excel로 정리하거나, 수기 노트를 촬영하여 업로드해도 됩니다.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 text-xs">
              <p className="font-bold text-gray-700 mb-1">JTC 재무제표 작성 프로세스</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <Badge className="bg-gray-200 text-gray-700">1</Badge>
                <span>자료 접수</span>
                <span>→</span>
                <Badge className="bg-gray-200 text-gray-700">2</Badge>
                <span>저널 정리</span>
                <span>→</span>
                <Badge className="bg-gray-200 text-gray-700">3</Badge>
                <span>시산표</span>
                <span>→</span>
                <Badge className="bg-gray-200 text-gray-700">4</Badge>
                <span>Neraca + L/R</span>
                <span>→</span>
                <Badge className="bg-gray-200 text-gray-700">5</Badge>
                <span>고객 확인</span>
              </div>
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
              {year}년 월별 매출 및 납부 내역
            </h2>
            <p className="text-xs text-gray-500">
              각 월의 사업 매출(Omzet)과 실제 납부한 PPh Final을 입력하세요.
              월신고 데이터가 있으면 자동으로 채워집니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-50">
                    <th className="p-2 text-left border">월</th>
                    <th className="p-2 text-right border">매출 (Rp)</th>
                    <th className="p-2 text-right border">비과세 공제</th>
                    <th className="p-2 text-right border">과세 매출</th>
                    <th className="p-2 text-right border">세액 (0.5%)</th>
                    <th className="p-2 text-right border">실제 납부</th>
                    <th className="p-2 text-center border">차이</th>
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
                          {monthlyRevenue[i] > 0 ? (diff === 0 ? '일치' : diff > 0 ? `+${fmtRp(diff)}` : fmtRp(diff)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-green-50 font-bold">
                  <tr>
                    <td className="p-2 border">합계</td>
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
                <span>연 매출이 {fmtRp(EXEMPTION)} 미만으로 <b>전액 비과세</b>입니다. PPh Final = 0원.</span>
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
              기타 소득 및 조정 항목
            </h2>
            <p className="text-xs text-gray-500">
              UMKM PPh Final과 별도로 발생한 소득이 있으면 입력합니다. 없으면 비워두세요.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">기타 사업외 소득 (Rp)</Label>
                <Input type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">PPh Final 대상이 아닌 소득 (예: 임대소득은 별도 PPh 4(2))</p>
              </div>
              <div>
                <Label className="text-xs">이자 소득 (Rp)</Label>
                <Input type="number" value={interestIncome} onChange={e => setInterestIncome(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">은행 이자 등 (이미 원천징수된 경우 PPh 23/4(2))</p>
              </div>
              <div>
                <Label className="text-xs">자산 처분 손익 (Rp)</Label>
                <Input type="number" value={assetGainLoss} onChange={e => setAssetGainLoss(e.target.value)}
                  placeholder="0" className="font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">고정자산 매각 이익/손실</p>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
              <p className="font-bold">UMKM PPh Final 과세 범위</p>
              <ul className="mt-1 space-y-0.5">
                <li>✅ 사업 매출 (Omzet) — PPh Final 0.5% 적용</li>
                <li>⚠️ 임대 소득 — PPh 4(2) Final 10% (별도 신고)</li>
                <li>⚠️ 이자 소득 — PPh 23 또는 PPh 4(2) (이미 원천징수됨)</li>
                <li>⚠️ 배당 소득 — PPh 23 15% (이미 원천징수됨)</li>
                <li>ℹ️ 위 항목은 SPT 1771에 기재하되 추가 과세 없음 (이미 Final/원천징수됨)</li>
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
                {year}년 PPh Final UMKM 정산 결과
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">연간 매출</p>
                  <p className="text-sm font-bold font-mono">{fmtRp(totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">비과세 공제</p>
                  <p className="text-sm font-bold font-mono text-gray-500">{fmtRp(Math.min(totalRevenue, EXEMPTION))}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-green-600">연간 PPh Final</p>
                  <p className="text-sm font-bold font-mono text-green-700">{fmtRp(annualTaxDue)}</p>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <p className="text-[10px] text-gray-500">이미 납부</p>
                  <p className="text-sm font-bold font-mono">{fmtRp(totalPaid)}</p>
                </div>
              </div>

              {/* Settlement status */}
              {isBalanced && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-900">정산 완료 — 과부족 없음</p>
                    <p className="text-xs text-green-700">연간 납부 세액과 의무 세액이 일치합니다. SPT Tahunan을 제출하면 됩니다.</p>
                  </div>
                </div>
              )}
              {isUnderpaid && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-bold text-red-900">추가 납부 필요: {fmtRp(difference)}</p>
                    <p className="text-xs text-red-700">
                      SPT Tahunan 제출 전까지 차액 {fmtRp(difference)}을 납부해야 합니다.
                      납부 페이지에서 ID Billing을 생성하세요.
                    </p>
                  </div>
                </div>
              )}
              {isOverpaid && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-bold text-blue-900">초과 납부: {fmtRp(Math.abs(difference))}</p>
                    <p className="text-xs text-blue-700">
                      {fmtRp(Math.abs(difference))}이 초과 납부되었습니다.
                      다음 연도로 이월(Kompensasi)하거나, 환급 신청(Restitusi)이 가능합니다.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge className="bg-blue-200 text-blue-800 text-[10px]">이월 (Kompensasi) — 무료</Badge>
                      <Badge className="bg-amber-200 text-amber-800 text-[10px]">환급 (Restitusi) — 세무조사 수반</Badge>
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
                <h3 className="font-bold text-sm mb-2">기타 소득 (SPT 기재, 추가 과세 없음)</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-gray-500">사업외 소득</p><p className="font-mono">{fmtRp(Number(otherIncome))}</p></div>
                  <div><p className="text-gray-500">이자 소득</p><p className="font-mono">{fmtRp(Number(interestIncome))}</p></div>
                  <div><p className="text-gray-500">자산 처분 손익</p><p className="font-mono">{fmtRp(Number(assetGainLoss))}</p></div>
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
              <h2 className="font-bold text-lg text-green-900">SPT Tahunan Badan 1771 생성 준비 완료</h2>
              <p className="text-sm text-green-700 mt-2">
                {year}년 PPh Final UMKM 결산 데이터가 정리되었습니다.
              </p>
              <div className="mt-4 bg-white rounded-xl p-4 text-left max-w-md mx-auto text-xs space-y-2">
                <div className="flex justify-between"><span>연간 매출</span><span className="font-mono font-bold">{fmtRp(totalRevenue)}</span></div>
                <div className="flex justify-between"><span>비과세 공제</span><span className="font-mono">{fmtRp(Math.min(totalRevenue, EXEMPTION))}</span></div>
                <div className="flex justify-between"><span>PPh Final (0.5%)</span><span className="font-mono text-green-700 font-bold">{fmtRp(annualTaxDue)}</span></div>
                <div className="flex justify-between"><span>이미 납부</span><span className="font-mono">{fmtRp(totalPaid)}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>{isUnderpaid ? '추가 납부' : isOverpaid ? '초과 납부' : '과부족'}</span>
                  <span className={`font-mono ${isBalanced ? 'text-green-600' : isOverpaid ? 'text-blue-600' : 'text-red-600'}`}>
                    {isBalanced ? '0' : fmtRp(Math.abs(difference))}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Button size="lg" className="w-full max-w-md" onClick={() => router.push(`/${locale}/tax/spt-tahunan/1771`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  SPT 1771 작성 페이지로 이동
                </Button>
                <p className="text-[10px] text-gray-500">
                  JTC 세무사가 SPT 1771을 최종 검토 후 DJP에 제출합니다
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
            <ArrowLeft className="h-4 w-4 mr-1" />이전
          </Button>
        ) : <div />}
        {step < 7 ? (
          <Button onClick={() => setStep(step + 1)}>
            다음<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
