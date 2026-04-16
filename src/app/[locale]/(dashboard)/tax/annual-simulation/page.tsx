'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  Loader2, TrendingUp, DollarSign, Calculator, BarChart3, Sparkles,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { fmtRp as fmt } from '@/lib/utils';

interface SimulationData {
  taxYear: number;
  monthsElapsed: number;
  monthsRemaining: number;
  ytd: { pph21Gross: number; pph21Withheld: number; pph23Withheld: number; pph22Withheld: number; pph25Installments: number; totalCredits: number };
  projected: { annualGross: number; annualPPh21: number; annualPPh23: number; totalCredits: number };
  monthlyBreakdown: Array<{ month: number; period: string; grossIncome: number; taxWithheld: number; isProjected: boolean }>;
  monthsWithData: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AnnualSimulationPage() {
  const t = useTranslations('annualSimulation');
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SimulationData | null>(null);

  const loadSimulation = useCallback(async () => {
    if (!session?.customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/tax/annual-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: session.customerId, taxYear: year }),
      });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [session?.customerId, year]);

  useEffect(() => { loadSimulation(); }, [loadSimulation]);

  const incomeActualLabel = t('incomeActual');
  const incomeProjectedLabel = t('incomeProjected');
  const taxActualLabel = t('taxActual');
  const taxProjectedLabel = t('taxProjected');

  const chartData = data?.monthlyBreakdown.map((m, i) => ({
    month: MONTHS[i],
    [incomeActualLabel]: m.isProjected ? 0 : m.grossIncome,
    [incomeProjectedLabel]: m.isProjected ? m.grossIncome : 0,
    [taxActualLabel]: m.isProjected ? 0 : m.taxWithheld,
    [taxProjectedLabel]: m.isProjected ? m.taxWithheld : 0,
  })) || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-green-200 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />Annual Tax Simulation
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('title')}</h1>
          <p className="text-green-200 mt-2 text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadSimulation} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calculator className="h-4 w-4 mr-1" />}
          Simulate
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" /></div>
      )}

      {data && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{t('ytdGrossIncome')}</p>
                <p className="text-lg font-bold">{fmt(data.ytd.pph21Gross)}</p>
                <p className="text-[10px] text-gray-400">{t('monthsActual', { count: data.monthsElapsed })}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{t('ytdTotalCredits')}</p>
                <p className="text-lg font-bold text-green-600">{fmt(data.ytd.totalCredits)}</p>
                <p className="text-[10px] text-gray-400">PPh 21+22+23+25</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="pt-4">
                <p className="text-xs text-emerald-700 flex items-center gap-1"><TrendingUp className="h-3 w-3" />{t('projectedAnnualIncome')}</p>
                <p className="text-lg font-bold text-emerald-800">{fmt(data.projected.annualGross)}</p>
                <Badge className="text-[8px] bg-emerald-100 text-emerald-700">{t('includesProjection')}</Badge>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="pt-4">
                <p className="text-xs text-emerald-700 flex items-center gap-1"><DollarSign className="h-3 w-3" />{t('projectedTotalCredits')}</p>
                <p className="text-lg font-bold text-emerald-800">{fmt(data.projected.totalCredits)}</p>
                <Badge className="text-[8px] bg-emerald-100 text-emerald-700">{t('monthsProjected', { count: data.monthsRemaining })}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Tax Credit Breakdown */}
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('taxCreditBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-500">{t('pph21Withheld')}</p>
                  <p className="font-bold font-mono">{fmt(data.ytd.pph21Withheld)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-500">{t('pph23Withheld')}</p>
                  <p className="font-bold font-mono">{fmt(data.ytd.pph23Withheld)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-500">{t('pph22ImportTax')}</p>
                  <p className="font-bold font-mono">{fmt(data.ytd.pph22Withheld)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-500">{t('pph25Installments')}</p>
                  <p className="font-bold font-mono">{fmt(data.ytd.pph25Installments)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />{t('monthlyChart', { year })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1 ? Math.round(v).toLocaleString('id-ID') : ''} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine x={MONTHS[data.monthsElapsed - 1]} stroke="#10b981" strokeDasharray="3 3" label={{ value: t('current'), fontSize: 9 }} />
                  <Bar dataKey={incomeActualLabel} fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={incomeProjectedLabel} fill="#a5b4fc" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={taxActualLabel} fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={taxProjectedLabel} fill="#6ee7b7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                {t('chartLegend')}
              </p>
            </CardContent>
          </Card>

          {data.monthsWithData === 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              {t('noDataWarning')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
