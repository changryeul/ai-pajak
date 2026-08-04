'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import { useEffectiveCustomerId } from '@/hooks/useEffectiveCustomerId';
import {
  Loader2, TrendingUp, DollarSign, Calculator, BarChart3, Sparkles,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { fmtRp as fmt } from '@/lib/utils';
import { CHART_ACCENT_POSITIVE } from '@/lib/charts/palette';
import { TrendBadge } from '@/components/ui/TrendBadge';

// Okabe-Ito derived tints for the projection-card backgrounds. Pairs with
// CHART_ACCENT_POSITIVE for headers and amounts so deuteranopes see one
// consistent positive-projection treatment instead of Tailwind emerald,
// which collides with rose for them.
const PROJECTION_CARD_BG = '#E6F6F0';
const PROJECTION_BADGE_BG = '#D0F0E5';
const PROJECTION_BADGE_TEXT = '#00684D';

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
  const tsc = useTranslations('taxScreen');
  const { session: _session } = useSession();
  const {
    customerId,
    isConsultant,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
  } = useEffectiveCustomerId();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SimulationData | null>(null);

  const loadSimulation = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/tax/annual-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxYear: year }),
      });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [customerId, year]);

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

      {isConsultant && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label htmlFor="as-customer" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {tsc('selectCustomer')}
          </label>
          {customers.length === 0 ? (
            <span className="text-xs text-slate-400">{tsc('noAssignedCustomers')}</span>
          ) : (
            <select
              id="as-customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
                <p
                  className="text-lg font-bold"
                  style={{ color: CHART_ACCENT_POSITIVE }}
                >
                  {fmt(data.ytd.totalCredits)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-gray-400">PPh 21+22+23+25</p>
                  {/* Collection progress vs projected annual credits. */}
                  {data.projected.totalCredits > 0 && (
                    <TrendBadge
                      value={(data.ytd.totalCredits / data.projected.totalCredits) * 100}
                      suffix="% of proj."
                      precision={0}
                      direction="up-good"
                      size="text-[10px]"
                      showSign={false}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" style={{ backgroundColor: PROJECTION_CARD_BG }}>
              <CardContent className="pt-4">
                <p
                  className="text-xs flex items-center gap-1 font-semibold"
                  style={{ color: CHART_ACCENT_POSITIVE }}
                >
                  <TrendingUp className="h-3 w-3" />
                  {t('projectedAnnualIncome')}
                </p>
                <p className="text-lg font-bold" style={{ color: PROJECTION_BADGE_TEXT }}>
                  {fmt(data.projected.annualGross)}
                </p>
                <Badge
                  className="text-[8px]"
                  style={{
                    backgroundColor: PROJECTION_BADGE_BG,
                    color: PROJECTION_BADGE_TEXT,
                  }}
                >
                  {t('includesProjection')}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" style={{ backgroundColor: PROJECTION_CARD_BG }}>
              <CardContent className="pt-4">
                <p
                  className="text-xs flex items-center gap-1 font-semibold"
                  style={{ color: CHART_ACCENT_POSITIVE }}
                >
                  <DollarSign className="h-3 w-3" />
                  {t('projectedTotalCredits')}
                </p>
                <p className="text-lg font-bold" style={{ color: PROJECTION_BADGE_TEXT }}>
                  {fmt(data.projected.totalCredits)}
                </p>
                <Badge
                  className="text-[8px]"
                  style={{
                    backgroundColor: PROJECTION_BADGE_BG,
                    color: PROJECTION_BADGE_TEXT,
                  }}
                >
                  {t('monthsProjected', { count: data.monthsRemaining })}
                </Badge>
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
                  <ReferenceLine x={MONTHS[data.monthsElapsed - 1]} stroke={CHART_ACCENT_POSITIVE} strokeDasharray="3 3" label={{ value: t('current'), fontSize: 9 }} />
                  <Bar dataKey={incomeActualLabel} fill="#0072B2" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={incomeProjectedLabel} fill="#56B4E9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={taxActualLabel} fill={CHART_ACCENT_POSITIVE} radius={[2, 2, 0, 0]} />
                  <Bar dataKey={taxProjectedLabel} fill="#A6E2CB" radius={[2, 2, 0, 0]} />
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
