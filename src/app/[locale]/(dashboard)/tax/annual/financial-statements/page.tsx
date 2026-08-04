'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BookOpen, Loader2, CheckCircle, AlertTriangle, Sparkles,
  FileText, DollarSign, TrendingUp, RefreshCw, Download, X,
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
  const t = useTranslations('financialStatements');
  const { session } = useSession();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear - 1);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; company_name?: string; full_name: string }>>([]);
  const [data, setData] = useState<FSData | null>(null);
  const [prevData, setPrevData] = useState<FSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Drill-down
  const [drilldown, setDrilldown] = useState<{
    accountCode: string; accountName: string;
    transactions: Array<{ date: string; number: string; description: string; source: string; debit: number; credit: number }>;
    totalDebit: number; totalCredit: number; balance: number; count: number;
  } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const handleDrilldown = async (code: string, name: string) => {
    if (!customerId) return;
    setDrillLoading(true);
    try {
      const res = await fetch(`/api/accounting/drilldown?customerId=${customerId}&year=${year}&accountCode=${code}`);
      const d = await res.json();
      if (d.success) setDrilldown({ accountCode: code, accountName: name, ...d.data });
    } catch { /* */ }
    finally { setDrillLoading(false); }
  };

  const isConsultant = session?.role === 'CONSULTANT' || session?.role === 'TAX_ADVISOR';

  useEffect(() => {
    if (isConsultant) {
      fetch('/api/customers').then(r => r.json()).then(d => {
        const list = d.customers || [];
        setCustomers(list);
        if (list.length > 0) setCustomerId(prev => prev || list[0].id);
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
          showMsg('success', t('generateSuccess', { entries: d.data.journalEntryCount, lines: d.data.journalLineCount }));
        } else {
          showMsg('error', t('generateWarning', { errors: d.data.validation.errors.join(', ') }));
        }
      } else {
        showMsg('error', d.error || t('generateFail'));
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
      showMsg('error', t('serverError'));
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
        showMsg('success', t('savedToDb'));
      } else {
        showMsg('error', d.error || t('saveFail'));
      }
    } catch {
      showMsg('error', t('serverError'));
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
            <div key={item.code} className="flex justify-between py-0.5 text-xs group">
              <span className="text-gray-700">{item.code} {item.name}</span>
              <div className="flex items-center gap-2">
                {prev !== null && <span className="text-[9px] text-gray-400 font-mono">{fmtRp(prev)}</span>}
                <button
                  type="button"
                  onClick={() => handleDrilldown(item.code, item.name)}
                  className="font-mono text-blue-700 hover:text-blue-900 hover:underline cursor-pointer transition-colors"
                  title={t('viewDetail', { code: item.code })}
                >
                  {fmtRp(item.amount)}
                </button>
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
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {isConsultant && (
          <div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-56"><SelectValue placeholder={t('selectCustomer')} /></SelectTrigger>
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
              <SelectItem key={y} value={String(y)}>{t('yearSuffix', { year: y })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleGenerate} disabled={loading || !customerId}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {t('generateBtn')}
        </Button>
        {data && (
          <>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
              {t('saveToDb')}
            </Button>
            <Button variant="outline"
              onClick={() => window.open(`/api/accounting/financial-statements/pdf?customerId=${customerId}&year=${year}`, '_blank')}>
              <Download className="h-4 w-4 mr-1" />{t('pdfPrint')}
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
            <p className="text-sm">{t('generatePrompt')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Validation */}
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${data.validation.isValid ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {data.validation.isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {data.validation.isValid
              ? '✓ ' + t('validationPass', { entries: data.journalEntryCount })
              : t('validationError', { errors: data.validation.errors.join('; ') })}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="border-0 shadow-sm"><CardContent className="p-3">
              <p className="text-[10px] text-gray-500">{t('journalLabel')}</p>
              <p className="font-bold">{t('journalCount', { entries: data.journalEntryCount, lines: data.journalLineCount })}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500"><CardContent className="p-3">
              <p className="text-[10px] text-blue-600">{t('revenueLabel')}</p>
              <p className="font-bold font-mono text-sm">{fmtRp(data.incomeStatement.revenue.reduce((s, i) => s + i.amount, 0))}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-green-500"><CardContent className="p-3">
              <p className="text-[10px] text-green-600">{t('netIncomeLabel')}</p>
              <p className="font-bold font-mono text-sm text-green-700">{fmtRp(data.incomeStatement.netIncome)}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500"><CardContent className="p-3">
              <p className="text-[10px] text-indigo-600">{t('totalAssetsLabel')}</p>
              <p className="font-bold font-mono text-sm">{fmtRp(data.balanceSheet.assets.totalAssets)}</p>
            </CardContent></Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="income">
            <TabsList className="mb-4">
              <TabsTrigger value="trial"><RefreshCw className="h-3 w-3 mr-1" />{t('tabTrialBalance')}</TabsTrigger>
              <TabsTrigger value="income"><TrendingUp className="h-3 w-3 mr-1" />{t('tabIncomeStatement')}</TabsTrigger>
              <TabsTrigger value="balance"><DollarSign className="h-3 w-3 mr-1" />{t('tabBalanceSheet')}</TabsTrigger>
            </TabsList>

            {/* Trial Balance */}
            <TabsContent value="trial">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">{t('trialBalanceTitle', { year })}</h3>
                    <Badge className={data.trialBalance.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {data.trialBalance.isBalanced ? '✓ ' + t('balanced') : '✗ ' + t('unbalanced')}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 text-left">{t('code')}</th>
                          <th className="p-2 text-left">{t('accountName')}</th>
                          <th className="p-2 text-center">{t('type')}</th>
                          <th className="p-2 text-right">{t('debit')}</th>
                          <th className="p-2 text-right">{t('credit')}</th>
                          <th className="p-2 text-right">{t('balance')}</th>
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
                              <button type="button" onClick={() => handleDrilldown(e.accountCode, e.accountName)}
                                className="hover:text-blue-700 hover:underline cursor-pointer">
                                {fmtRp(e.balance)}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50 font-bold">
                        <tr>
                          <td colSpan={3} className="p-2">{t('total')}</td>
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
                    <h3 className="font-bold text-sm">{t('incomeStatementTitle', { year })}</h3>
                    {prevData && <Badge className="bg-blue-100 text-blue-700 text-[9px]">{t('comparisonLabel', { year: year - 1 })}</Badge>}
                  </div>

                  {/* Header row for comparison */}
                  {prevData && (
                    <div className="flex justify-end gap-2 mb-2 text-[9px] text-gray-400">
                      <span className="w-24 text-right">{t('yearSuffix', { year: year - 1 })}</span>
                      <span className="w-24 text-right">{t('yearSuffix', { year })}</span>
                      <span className="w-10">{t('change')}</span>
                    </div>
                  )}

                  <div className="max-w-2xl">
                    <SectionRow items={data.incomeStatement.revenue} label={t('revenue')} prevItems={prevData?.incomeStatement.revenue} />
                    <SectionRow items={data.incomeStatement.cogs} label={t('cogs')} prevItems={prevData?.incomeStatement.cogs} />
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>{t('grossProfit')}</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.grossProfit)}</span>
                    </div>

                    <div className="mt-3">
                      <SectionRow items={data.incomeStatement.operatingExpenses} label={t('operatingExpenses')} prevItems={prevData?.incomeStatement.operatingExpenses} />
                    </div>
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>{t('operatingIncome')}</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.operatingIncome)}</span>
                    </div>

                    <SectionRow items={data.incomeStatement.otherIncome} label={t('otherIncome')} prevItems={prevData?.incomeStatement.otherIncome} />
                    <div className="flex justify-between py-1 border-t text-xs font-bold">
                      <span>{t('incomeBeforeTax')}</span>
                      <span className="font-mono">{fmtRp(data.incomeStatement.incomeBeforeTax)}</span>
                    </div>

                    <SectionRow items={data.incomeStatement.taxExpense} label={t('taxExpense')} prevItems={prevData?.incomeStatement.taxExpense} />
                    <div className="flex justify-between py-2 border-t-2 border-green-500 text-sm font-bold text-green-700">
                      <span>{t('netIncome')}</span>
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
                          <p className="text-gray-500">{t('grossProfitMargin')}</p>
                          <p className="font-bold">{(data.incomeStatement.grossProfit / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('operatingMargin')}</p>
                          <p className="font-bold">{(data.incomeStatement.operatingIncome / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('netMargin')}</p>
                          <p className="font-bold text-green-700">{(data.incomeStatement.netIncome / Math.max(data.incomeStatement.revenue.reduce((s,i) => s + i.amount, 0), 1) * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('opexRatio')}</p>
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
                    <h3 className="font-bold text-sm">{t('balanceSheetTitle', { year })}</h3>
                    <Badge className={data.balanceSheet.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {data.balanceSheet.isBalanced ? '✓ ' + t('assetsEqualsLiabilities') : '✗ ' + t('unbalanced')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Assets */}
                    <div>
                      <h4 className="font-bold text-xs text-blue-700 border-b border-blue-200 pb-1 mb-2">{t('assets')}</h4>
                      <SectionRow items={data.balanceSheet.assets.current} label={t('currentAssets')} prevItems={prevData?.balanceSheet.assets.current} />
                      <SectionRow items={data.balanceSheet.assets.fixed} label={t('fixedAssets')} prevItems={prevData?.balanceSheet.assets.fixed} />
                      <SectionRow items={data.balanceSheet.assets.other} label={t('otherAssets')} prevItems={prevData?.balanceSheet.assets.other} />
                      <div className="flex justify-between py-2 border-t-2 border-blue-500 text-sm font-bold text-blue-700">
                        <span>{t('totalAssets')}</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.assets.totalAssets)}</span>
                      </div>
                    </div>

                    {/* Right: Liabilities + Equity */}
                    <div>
                      <h4 className="font-bold text-xs text-indigo-700 border-b border-indigo-200 pb-1 mb-2">{t('liabilitiesEquity')}</h4>
                      <SectionRow items={data.balanceSheet.liabilities.current} label={t('currentLiabilities')} prevItems={prevData?.balanceSheet.liabilities.current} />
                      <SectionRow items={data.balanceSheet.liabilities.longTerm} label={t('longTermLiabilities')} prevItems={prevData?.balanceSheet.liabilities.longTerm} />
                      <div className="flex justify-between py-1 border-t text-xs font-bold mb-3">
                        <span>{t('liabilitiesSubtotal')}</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.liabilities.totalLiabilities)}</span>
                      </div>

                      <SectionRow items={data.balanceSheet.equity.items} label={t('equity')} prevItems={prevData?.balanceSheet.equity.items} />
                      <div className="flex justify-between py-0.5 text-xs">
                        <span className="text-green-700 font-medium">{t('currentNetIncome')}</span>
                        <span className="font-mono text-green-700 font-bold">{fmtRp(data.balanceSheet.equity.netIncome)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t text-xs font-bold mb-3">
                        <span>{t('equitySubtotal')}</span>
                        <span className="font-mono">{fmtRp(data.balanceSheet.equity.totalEquity)}</span>
                      </div>

                      <div className="flex justify-between py-2 border-t-2 border-indigo-500 text-sm font-bold text-indigo-700">
                        <span>{t('liabilitiesPlusEquity')}</span>
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

      {/* Drill-down Modal */}
      {(drilldown || drillLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !drillLoading && setDrilldown(null)}>
          <div className="bg-white rounded-xl max-w-3xl max-h-[80vh] w-full overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {drillLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-gray-500 mt-2">{t('loadingTransactions')}</p>
              </div>
            ) : drilldown ? (
              <>
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div>
                    <h3 className="font-bold text-sm">
                      {drilldown.accountCode} {drilldown.accountName}
                    </h3>
                    <p className="text-xs text-gray-500">{t('transactionCount', { count: drilldown.count, year })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">{t('balance')}</p>
                      <p className="font-mono font-bold text-sm">{fmtRp(drilldown.balance)}</p>
                    </div>
                    <button onClick={() => setDrilldown(null)}><X className="h-5 w-5 text-gray-400 hover:text-gray-700" /></button>
                  </div>
                </div>
                <div className="p-4">
                  {drilldown.transactions.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">{t('noTransactions')}</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 text-left">{t('date')}</th>
                          <th className="p-2 text-left">{t('number')}</th>
                          <th className="p-2 text-left">{t('description')}</th>
                          <th className="p-2 text-center">{t('source')}</th>
                          <th className="p-2 text-right">{t('debit')}</th>
                          <th className="p-2 text-right">{t('credit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldown.transactions.map((tx, i) => (
                          <tr key={i} className="border-b hover:bg-blue-50/50">
                            <td className="p-2 text-gray-500">{tx.date}</td>
                            <td className="p-2 font-mono text-[10px] text-indigo-600">{tx.number}</td>
                            <td className="p-2">{tx.description}</td>
                            <td className="p-2 text-center">
                              <Badge variant="outline" className="text-[8px]">{tx.source}</Badge>
                            </td>
                            <td className="p-2 text-right font-mono">{tx.debit > 0 ? fmtRp(tx.debit) : ''}</td>
                            <td className="p-2 text-right font-mono">{tx.credit > 0 ? fmtRp(tx.credit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50 font-bold">
                        <tr>
                          <td colSpan={4} className="p-2">{t('total')}</td>
                          <td className="p-2 text-right font-mono">{fmtRp(drilldown.totalDebit)}</td>
                          <td className="p-2 text-right font-mono">{fmtRp(drilldown.totalCredit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
