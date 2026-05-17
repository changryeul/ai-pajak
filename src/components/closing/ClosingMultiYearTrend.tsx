'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CLOSING_BAR_REVENUE,
  CLOSING_BAR_NET_INCOME,
  CLOSING_LINE_ETR,
  CHART_ACCENT_POSITIVE,
  CHART_ACCENT_NEGATIVE,
} from '@/lib/charts/palette';
import { ClosingQuarterlyView } from './ClosingQuarterlyView';

/**
 * /tax/annual 진입 페이지에서 사용하는 최근 5년 결산 트렌드 패널.
 *
 * 데이터: /api/tax/closing-filings — fiscalYear별 PL + 세액.
 *
 * 표시:
 *   1. YoY 배너 — 가장 최근 두 연도가 모두 있으면 매출/순이익/세액 변화율 + ETR Δ 요약.
 *   2. 차트 — 2개 이상이면 매출/순이익 막대 + ETR 선 (Composed chart).
 *   3. 테이블 — 모든 연도 행. ETR 컬럼 포함. 변화율 배지.
 */

interface ClosingApiRow {
  kind: 'CLOSING';
  sessionId: string;
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  sessionStatus: string;
  pl: {
    annualRevenue: number | null;
    cogs: number | null;
    salary: number | null;
    opex: number | null;
    netIncome: number | null;
  };
  taxAmount: number | null;
  submission: { status: string; bpeNumber: string | null } | null;
}

const N_YEARS = 5;
const COMPACT_THRESHOLD = 1_000_000_000; // ≥ 10억 IDR 부터 short 표기

function fmtRp(n: number | null): string {
  if (n == null) return '—';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function fmtRpCompact(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= COMPACT_THRESHOLD) {
    return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `Rp ${(n / 1_000_000).toFixed(0)}M`;
  }
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** 전년 대비 변화율 — 전년이 null/0 이면 null. */
function changeRate(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev;
}

/** Effective Tax Rate — 세액 / 매출 (UMKM/PPh25 모두 의미가 있는 단일 비교 지표). */
function etr(taxAmount: number | null, annualRevenue: number | null): number | null {
  if (taxAmount == null || annualRevenue == null || annualRevenue <= 0) return null;
  return taxAmount / annualRevenue;
}

function ChangeBadge({ rate }: { rate: number | null }) {
  if (rate == null) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const pct = Math.abs(rate * 100);
  const pctStr = pct >= 100 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
  if (Math.abs(rate) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
        <Minus className="h-2.5 w-2.5" />
        {pctStr}
      </span>
    );
  }
  if (rate > 0) {
    // 매출/순이익 증가 = 긍정 — Okabe-Ito 청록 (#009E73)
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
        style={{ color: CHART_ACCENT_POSITIVE }}
      >
        <TrendingUp className="h-2.5 w-2.5" />
        +{pctStr}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
      style={{ color: CHART_ACCENT_NEGATIVE }}
    >
      <TrendingDown className="h-2.5 w-2.5" />
      −{pctStr}
    </span>
  );
}

/** Tax/ETR delta — direction is "tax up = bad, tax down = good" (opposite of revenue). */
function TaxChangeBadge({ rate }: { rate: number | null }) {
  if (rate == null) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const pct = Math.abs(rate * 100);
  const pctStr = pct >= 100 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
  if (Math.abs(rate) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
        <Minus className="h-2.5 w-2.5" /> {pctStr}
      </span>
    );
  }
  if (rate > 0) {
    // 세액/ETR 증가 = 부정 — Okabe-Ito vermillion (#D55E00)
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
        style={{ color: CHART_ACCENT_NEGATIVE }}
      >
        <TrendingUp className="h-2.5 w-2.5" />
        +{pctStr}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
      style={{ color: CHART_ACCENT_POSITIVE }}
    >
      <TrendingDown className="h-2.5 w-2.5" />
      −{pctStr}
    </span>
  );
}

interface ChartPoint {
  year: number;
  revenue: number | null;
  netIncome: number | null;
  etrPct: number | null;
}

export function ClosingMultiYearTrend() {
  const t = useTranslations('closingTrend');
  const [rows, setRows] = useState<ClosingApiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tax/closing-filings', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const data = (json?.data ?? []) as ClosingApiRow[];
        data.sort((a, b) => b.fiscalYear - a.fiscalYear);
        setRows(data.slice(0, N_YEARS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ASC ordering for table + chart so x-axis flows left-to-right oldest → latest.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);

  const chartData: ChartPoint[] = useMemo(
    () =>
      ordered.map((r) => {
        const e = etr(r.taxAmount, r.pl.annualRevenue);
        return {
          year: r.fiscalYear,
          revenue: r.pl.annualRevenue,
          netIncome: r.pl.netIncome,
          etrPct: e == null ? null : Number((e * 100).toFixed(2)),
        };
      }),
    [ordered],
  );

  const yoy = useMemo(() => {
    if (ordered.length < 2) return null;
    const prev = ordered[ordered.length - 2];
    const curr = ordered[ordered.length - 1];
    const prevEtr = etr(prev.taxAmount, prev.pl.annualRevenue);
    const currEtr = etr(curr.taxAmount, curr.pl.annualRevenue);
    return {
      prevYear: prev.fiscalYear,
      currYear: curr.fiscalYear,
      revenueRate: changeRate(curr.pl.annualRevenue, prev.pl.annualRevenue),
      netIncomeRate: changeRate(curr.pl.netIncome, prev.pl.netIncome),
      taxRate: changeRate(curr.taxAmount, prev.taxAmount),
      etrDelta: prevEtr != null && currEtr != null ? currEtr - prevEtr : null,
    };
  }, [ordered]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-base font-bold text-slate-900">{t('title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('subtitle', { n: N_YEARS })}</p>
        </div>
      </div>

      <Tabs defaultValue="annual" className="mt-4">
        <TabsList>
          <TabsTrigger value="annual">{t('tabAnnual')}</TabsTrigger>
          <TabsTrigger value="quarterly">{t('tabQuarterly')}</TabsTrigger>
        </TabsList>

        <TabsContent value="annual">
          <AnnualContent
            t={t}
            loading={loading}
            rows={rows}
            ordered={ordered}
            chartData={chartData}
            yoy={yoy}
          />
        </TabsContent>

        <TabsContent value="quarterly">
          <ClosingQuarterlyView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AnnualContentProps {
  t: ReturnType<typeof useTranslations<'closingTrend'>>;
  loading: boolean;
  rows: ClosingApiRow[];
  ordered: ClosingApiRow[];
  chartData: ChartPoint[];
  yoy: {
    prevYear: number;
    currYear: number;
    revenueRate: number | null;
    netIncomeRate: number | null;
    taxRate: number | null;
    etrDelta: number | null;
  } | null;
}

function AnnualContent({ t, loading, rows, ordered, chartData, yoy }: AnnualContentProps) {
  if (loading) {
    return <p className="text-sm text-slate-400 mt-2">{t('loading')}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
        <p className="text-sm text-slate-500">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* YoY summary banner */}
      {yoy && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-xs font-bold text-emerald-900">
            {t('yoyTitle', { prev: yoy.prevYear, curr: yoy.currYear })}
          </p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <YoYStat label={t('yoyRevenue')} rate={yoy.revenueRate} />
            <YoYStat label={t('yoyNetIncome')} rate={yoy.netIncomeRate} />
            <YoYStat label={t('yoyTax')} rate={yoy.taxRate} invertSign />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">
                {t('yoyEtrDelta')}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                {yoy.etrDelta == null
                  ? '—'
                  : `${yoy.etrDelta > 0 ? '+' : ''}${(yoy.etrDelta * 100).toFixed(2)}pp`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-bold text-slate-900">{t('chartTitle')}</p>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">{t('chartSubtitle')}</p>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis
                  yAxisId="rp"
                  tick={{ fontSize: 11 }}
                  stroke="#64748b"
                  tickFormatter={(v: number) => fmtRpCompact(v)}
                  width={80}
                />
                <YAxis
                  yAxisId="etr"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  stroke={CLOSING_LINE_ETR}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  width={48}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const num = typeof value === 'number' ? value : Number(value ?? 0);
                    const label = String(name);
                    if (label === t('legendEtr')) return [`${num.toFixed(2)}%`, label];
                    return [fmtRp(num), label];
                  }}
                  labelFormatter={(label) => String(label)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="rp"
                  dataKey="revenue"
                  name={t('legendRevenue')}
                  fill={CLOSING_BAR_REVENUE}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="rp"
                  dataKey="netIncome"
                  name={t('legendNetIncome')}
                  fill={CLOSING_BAR_NET_INCOME}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="etr"
                  type="monotone"
                  dataKey="etrPct"
                  name={t('legendEtr')}
                  stroke={CLOSING_LINE_ETR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CLOSING_LINE_ETR }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left py-2 px-3">{t('thYear')}</th>
              <th className="text-left py-2 px-3">{t('thType')}</th>
              <th className="text-right py-2 px-3">{t('thRevenue')}</th>
              <th className="text-right py-2 px-3">{t('thCogs')}</th>
              <th className="text-right py-2 px-3">{t('thNetIncome')}</th>
              <th className="text-right py-2 px-3">{t('thTax')}</th>
              <th className="text-right py-2 px-3">{t('thEtr')}</th>
              <th className="text-left py-2 px-3">{t('thStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map((r, i) => {
              const prev = i > 0 ? ordered[i - 1] : null;
              const submissionStatus = r.submission?.status ?? '—';
              const completed = submissionStatus === 'COMPLETED';
              const currEtr = etr(r.taxAmount, r.pl.annualRevenue);
              const prevEtr = prev ? etr(prev.taxAmount, prev.pl.annualRevenue) : null;
              return (
                <tr key={r.sessionId}>
                  <td className="py-2 px-3 font-semibold text-slate-900">{r.fiscalYear}</td>
                  <td className="py-2 px-3 text-slate-700">{r.closingType}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono text-slate-900">{fmtRp(r.pl.annualRevenue)}</div>
                    {prev && (
                      <div className="mt-0.5">
                        <ChangeBadge rate={changeRate(r.pl.annualRevenue, prev.pl.annualRevenue)} />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono text-slate-900">{fmtRp(r.pl.cogs)}</div>
                    {prev && (
                      <div className="mt-0.5">
                        <ChangeBadge rate={changeRate(r.pl.cogs, prev.pl.cogs)} />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono text-slate-900">{fmtRp(r.pl.netIncome)}</div>
                    {prev && (
                      <div className="mt-0.5">
                        <ChangeBadge rate={changeRate(r.pl.netIncome, prev.pl.netIncome)} />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono text-slate-900">{fmtRp(r.taxAmount)}</div>
                    {prev && (
                      <div className="mt-0.5">
                        <TaxChangeBadge rate={changeRate(r.taxAmount, prev.taxAmount)} />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="font-mono text-slate-900">
                      {currEtr == null ? '—' : `${(currEtr * 100).toFixed(2)}%`}
                    </div>
                    {prev && prevEtr != null && currEtr != null && (
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Δ {((currEtr - prevEtr) * 100).toFixed(2)}pp
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {completed ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {t('statusCompleted')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        {t('statusInProgress')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ordered.length === 1 && (
        <p className="text-[11px] text-slate-500 mt-3">{t('singleYearNote')}</p>
      )}
    </div>
  );
}

function YoYStat({
  label,
  rate,
  invertSign = false,
}: {
  label: string;
  rate: number | null;
  invertSign?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-emerald-700">{label}</p>
      <div className="mt-0.5">
        {rate == null ? (
          <span className="font-mono text-sm text-slate-400">—</span>
        ) : invertSign ? (
          <TaxChangeBadge rate={rate} />
        ) : (
          <ChangeBadge rate={rate} />
        )}
      </div>
    </div>
  );
}
