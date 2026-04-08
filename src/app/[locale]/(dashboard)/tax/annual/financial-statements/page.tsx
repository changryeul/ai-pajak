'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BookOpen, Loader2, CheckCircle, AlertTriangle, Sparkles,
  FileText, DollarSign, TrendingUp, TrendingDown, ArrowRight, RefreshCw, Download,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface LedgerEntry {
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface FinancialItem {
  code: string;
  name: string;
  amount: number;
}

interface FSData {
  trialBalance: {
    entries: LedgerEntry[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
  incomeStatement: {
    revenue: FinancialItem[];
    cogs: FinancialItem[];
    grossProfit: number;
    operatingExpenses: FinancialItem[];
    operatingIncome: number;
    otherIncome: FinancialItem[];
    incomeBeforeTax: number;
    taxExpense: FinancialItem[];
    netIncome: number;
  };
  balanceSheet: {
    assets: { current: FinancialItem[]; fixed: FinancialItem[]; other: FinancialItem[]; totalAssets: number };
    liabilities: { current: FinancialItem[]; longTerm: FinancialItem[]; totalLiabilities: number };
    equity: { items: FinancialItem[]; netIncome: number; totalEquity: number };
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
  };
  validation: { isValid: boolean; errors: string[] };
  journalEntryCount: number;
  journalLineCount: number;
}

export default function FinancialStatementsPage() {
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear - 1);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; company_name?: string; full_name: string }>>([]);
  const [data, setData] = useState<FSData | null>(null);
  const [prevData, setPrevData] = useState<FSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConsultant = session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';

  useEffect(() => {
    if (isConsultant) {
      fetch('/api/customers').then(r => r.json()).then(d => {
        const list = d.customers || [];
        setCustomers(list);
        if (list.length > 0 && !customerId) setCustomerId(list[0].id);
      }).catch(() => {});
    } else if (session?.customerId) {
      setCustomerId(session.customerId);
    }
  }, [session, isConsultant]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleGenerate = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      // Current year
      const res = await fetch('/api/accounting/financial-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, fiscalYear: year, action: 'generate' }),
      });
      const d = await res.json();
      if (d.success) {
        setData(d.data);
        if (d.data.validation.isValid) {
          showMsg('success', `재무제표 생성 완료 — 저널 ${d.data.journalEntryCount}건, ${d.data.journalLineCount}줄`);
        } else {
          showMsg('error', `경고: ${d.data.validation.errors.join(', ')}`);
        }
      } else {
        showMsg('error', d.error || '생성 실패');
      }

      // Previous year (for comparison)
      try {
        const prevRes = await fetch('/api/accounting/financial-statements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, fiscalYear: year - 1, action: 'generate' }),
        });
        const pd = await prevRes.json();
        if (pd.success) setPrevData(pd.data);
        else setPrevData(null);
      } catch { setPrevData(null); }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customerId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/financial-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, fiscalYear: year, action: 'save' }),
      });
      const d = await res.json();
      if (d.success) {
        setData(d.data);
        showMsg('success', 'DB에 저장되었습니다');
      } else {
        showMsg('error', d.error || '저장 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSaving(false);
    }
  };

  const findPrevAmount = (code: string, prevItems?: FinancialItem[]) => {
    if (!prevItems) return null;
    const found = prevItems.find(i => i.code === code);
    return found ? found.amount : null;
  };

  const changeIndicator = (current: number, prev: number | null) => {
    if (prev === null || prev === 0) return null;
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct) < 0.5) return null;
    return (
      <span className={`text-[9px] ml-1 ${pct > 0 ? 'text-red-500' : 'text-green-600'}`}>
        {pct > 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  const SectionRow = ({ items, label, prevItems }: { items: FinancialItem[]; label: string; prevItems?: FinancialItem[] }) => (
    items.length > 0 ? (
      <div className="mb-3">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{label}</p>
        {items.map(item => {
          const prev = findPrevAmount(item.code, prevItems);
          return (
            <div key={item.code} className="flex justify-between py-0.5 text-xs">
              <span className="text-gray-700">{item.code} {item.name}</span>
              <div className="flex items-center gap-2">
                {prev !== null && <span className="text-[9px] text-gray-400 font-mono">{fmtRp(prev)}</span>}
                <span className="font-mono">{fmtRp(item.amount)}</span>
                {changeIndicator(item.amount, prev)}
              </div>
            </div>
          );
        })}
      </div>
    ) : null
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          재무제표 (Laporan Keuangan)
        </h1>
        <p className="text-sm text-gray-500 mt-1">저널 데이터를 기반으로 시산표, 손익계산서, 재무상태표를 자동 생성합니다</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isConsultant && (
          <div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="고객 선택" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleGenerate} disabled={loading || !customerId}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          재무제표 생성
        </Button>
        {data && (
          <>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              DB에 저장
            </Button>
            <Button variant="outline"
              onClick={() => window.open(`/api/accounting/financial-statements/pdf?customerId=${customerId}&year=${year}`, '_blank')}>
              <Download className="h-4 w-4 mr-1" />PDF 인쇄
            </Button>
          </>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {!data ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">"재무제표 생성" 버튼을 클릭하면 저널 데이터를 분석합니다</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Validation */}
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${data.validation.isValid ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {data.validation.isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {data.validation.isValid
              ? `✓ 검증 통과 — 저널 ${data.journalEntryCount}건, 시산표 균형, 대차대조표 균형`
              : `검증 오류: ${data.validation.errors.join('; ')}`}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="border-0 shadow-sm"><CardContent className="p-3">
              <p className="text-[10px] text-gray-500">저널</p>
              <p className="font-bold">{data.journalEntryCount}건 / {data.journalLineCount}줄</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500"><CardContent className="p-3">
              <p className="text-[10px] text-blue-600">매출</p>
              <p className="font-bold font-mono text-sm">{fmtRp(data.incomeStatement.revenue.reduce((s, i) => s + i.amount, 0))}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-green-500"><CardContent className="p-3">
              <p className="text-[10px] text-green-600">순이익</p>
              <p className="font-bold font-mono text-sm text-green-700">{fmtRp(data.incomeStatement.netIncome)}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500"><CardContent className="p-3">
              <p className="text-[10px] text-indigo-600">총 자산</p>
              <p className="font-bold font-mono text-sm">{fmtRp(data.balanceSheet.assets.totalAssets)}</p>
            </CardContent></Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="income">
            <TabsList className="mb-4">
              <TabsTrigger value="trial"><RefreshCw className="h-3 w-3 mr-1" />시산표</TabsTrigger>
              <TabsTrigger value="income"><TrendingUp className="h-3 w-3 mr-1" />손익계산서</TabsTrigger>
              <TabsTrigger value="balance"><DollarSign className="h-3 w-3 mr-1" />재무상태표</TabsTrigger>
            </TabsList>

            {/* Trial Balance */}
            <TabsContent value="trial">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">시산표 (Neraca Saldo) — {year}년</h3>
                    <Badge className={data.trialBalance.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {data.trialBalance.isBalanced ? '✓ 균형' : '✗ 불균형'}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 text-left">코드</th>
                          <th className="p-2 text-left">계정명</th>
                          <th className="p-2 text-center">유형</th>
                          <th className="p-2 text-right">차변 (Debit)</th>
                          <th className="p-2 text-right">대변 (Credit)</th>
                          <th className="p-2 text-right">잔액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trialBalance.entries.map(e => (
                          <tr key={e.accountCode} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono">{e.accountCode}</td>
                            <td className="p-2">{e.accountName}</td>
                            <td className="p-2 text-center">
                              <Badge variant="outline" className="text-[8px]">{e.accountType}</Badge>
                            </td>
                            <td className="p-2 text-right font-mono">{e.totalDebit > 0 ? fmtRp(e.totalDebit) : ''}</td>
                            <td className="p-2 text-right font-mono">{e.totalCredit > 0 ? fmtRp(e.totalCredit) : ''}</td>
                            <td className={`p-2 text-right font-mono font-bold ${e.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                              {fmtRp(e.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50 font-bold">
                        <tr>
                          <td colSpan={3} className="p-2">합계</td>
                          <td className="p-2 text-right font-mono">{fmtRp(data.trialBalance.totalDebit)}</td>
                          <td className="p-2 text-right font-mono">{fmtRp(data.trialBalance.totalCredit)}</td>
                          <td className="p-2 text-right font-mono">
                            {data.trialBalance.isBalanced ? '✓' : fmtRp(data.trialBalance.totalDebit - data.trialBalance.totalCredit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Income Statement */}
            <TabsContent value="income">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm">손익계산서 (Laporan Laba Rugi) — {year}년</h3>
                    {prevData && <Badge className="bg-blue-100 text-blue-700 text-[9px]">{year-1}년 비교 표시</Badge>}
                  </div>

                  {/* Header row for comparison */}
                  {prevData && (
                    <div className="flex justify-end gap-2 mb-2 text-[9px] text-gray-400">
                      <span className="w-24 text-right">{year-1}년</span>
                      <span className="w-24 text-right">{year}년</span>
                      <span className="w-10">변동</span>
                    </div>
                  )}

                  <div className="max-w-2xl">
                    <SectionRow items={data.incomeStatement.revenue} label="수익 (Pendapatan)" prevItems={prevData?.incomeStatement.revenue} />
                    <SectionRow items={data.incomeStatement.cogs} label="매출원가 (HPP)" prevItems={prevData?.incomeStatement.cogs} />
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>매출총이익 (Laba Kotor)</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.grossProfit)}</span>
                    </div>

                    <div className="mt-3">
                      <SectionRow items={data.incomeStatement.operatingExpenses} label="영업비용 (Biaya Operasional)" prevItems={prevData?.incomeStatement.operatingExpenses} />
                    </div>
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>영업이익 (Laba Operasional)</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.operatingIncome)}</span>
                    </div>

                    <SectionRow items={data.incomeStatement.otherIncome} label="기타 손익" prevItems={prevData?.incomeStatement.otherIncome} />
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>세전이익 (Laba Sebelum Pajak)</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.incomeBeforeTax)}</span>
                    </div>

                    <SectionRow items={data.incomeStatement.taxExpense} label="세금 (Pajak)" prevItems={prevData?.incomeStatement.taxExpense} />
                    <div className="flex justify-between py-2 border-t-2 border-green-500 text-sm font-bold text-green-700">
                      <span>순이익 (Laba Bersih)</span>
                      <div className="flex items-center gap-2">
                        {prevData && <span className="text-[10px] text-gray-400 font-mono">{fmtRp(prevData.incomeStatement.netIncome)}</span>}
                        <span className="font-mono">{fmtRp(data.incomeStatement.netIncome)}</span>
                        {prevData && changeIndicator(data.incomeStatement.netIncome, prevData.incomeStatement.netIncome)}
                      </div>
                    </div>

                    {/* Profitability ratios */}
                    {data.incomeStatement.revenue.length > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">매출총이익률</p>
                          <p className="font-bold">{(data.incomeStatement.grossProfit / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">영업이익률</p>
                          <p className="font-bold">{(data.incomeStatement.operatingIncome / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">순이익률</p>
                          <p className="font-bold text-green-700">{(data.incomeStatement.netIncome / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">영업비용 비율</p>
                          <p className="font-bold">{(data.incomeStatement.operatingExpenses.reduce((s,i) => s + i.amount, 0) / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Balance Sheet */}
            <TabsContent value="balance">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm">재무상태표 (Neraca) — {year}년 12월 31일</h3>
                    <Badge className={data.balanceSheet.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {data.balanceSheet.isBalanced ? '✓ 자산 = 부채+자본' : '✗ 불균형'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Assets */}
                    <div>
                      <h4 className="font-bold text-xs text-blue-700 border-b border-blue-200 pb-1 mb-2">자산 (AKTIVA)</h4>
                      <SectionRow items={data.balanceSheet.assets.current} label="유동자산 (Aktiva Lancar)" prevItems={prevData?.balanceSheet.assets.current} />
                      <SectionRow items={data.balanceSheet.assets.fixed} label="고정자산 (Aktiva Tetap)" prevItems={prevData?.balanceSheet.assets.fixed} />
                      <SectionRow items={data.balanceSheet.assets.other} label="기타자산" prevItems={prevData?.balanceSheet.assets.other} />
                      <div className="flex justify-between py-2 border-t-2 border-blue-500 text-sm font-bold text-blue-700">
                        <span>총 자산</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.assets.totalAssets)}</span>
                      </div>
                    </div>

                    {/* Right: Liabilities + Equity */}
                    <div>
                      <h4 className="font-bold text-xs text-indigo-700 border-b border-indigo-200 pb-1 mb-2">부채 & 자본 (PASIVA)</h4>
                      <SectionRow items={data.balanceSheet.liabilities.current} label="유동부채 (Kewajiban Lancar)" prevItems={prevData?.balanceSheet.liabilities.current} />
                      <SectionRow items={data.balanceSheet.liabilities.longTerm} label="장기부채 (Kewajiban Jangka Panjang)" prevItems={prevData?.balanceSheet.liabilities.longTerm} />
                      <div className="flex justify-between py-1 border-t text-xs font-bold mb-3">
                        <span>부채 소계</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.liabilities.totalLiabilities)}</span>
                      </div>

                      <SectionRow items={data.balanceSheet.equity.items} label="자본 (Modal)" prevItems={prevData?.balanceSheet.equity.items} />
                      <div className="flex justify-between py-0.5 text-xs">
                        <span className="text-green-700 font-medium">당기순이익 (Laba Bersih)</span>
                        <span className="font-mono text-green-700 font-bold">{fmtRp(data.balanceSheet.equity.netIncome)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t text-xs font-bold mb-3">
                        <span>자본 소계</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.equity.totalEquity)}</span>
                      </div>

                      <div className="flex justify-between py-2 border-t-2 border-indigo-500 text-sm font-bold text-indigo-700">
                        <span>부채 + 자본</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.totalLiabilitiesAndEquity)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
