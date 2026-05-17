'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TAX_TYPE_COLORS,
  TAX_TYPE_FALLBACK,
  YEAR_PALETTE,
} from '@/lib/charts/palette';

/**
 * Quarterly Tax Payment Trend — sibling view to ClosingMultiYearTrend.
 *
 * Data: GET /api/tax/quarterly-trend?years=YYYY,YYYY
 *   - Aggregates tax_monthly_payment rows into Q1-Q4 buckets per year.
 *   - Default years = [currentYear, currentYear - 1].
 *
 * Renders:
 *   - Year selector (last 5 years, multi-select up to 2 for the chart).
 *   - YoY banner: 4 cards (Q1..Q4) with currYear vs prevYear delta.
 *   - Grouped bar chart: x = quarter label, one bar per selected year.
 *   - Table with totals per quarter per year.
 */

interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  total: number;
  byType: Record<string, number>;
}

interface YoyEntry {
  quarter: 1 | 2 | 3 | 4;
  currYear: number;
  prevYear: number;
  currTotal: number;
  prevTotal: number;
  deltaPct: number | null;
}

interface ApiResp {
  success: boolean;
  data?: {
    years: number[];
    taxTypes: string[];
    quarters: Quarter[];
    yoy: YoyEntry[] | null;
  };
  error?: string;
}

const COMPACT_THRESHOLD = 1_000_000_000;
function fmtRp(n: number | null | undefined): string {
  if (n == null) return '—';
  return `Rp ${n.toLocaleString('id-ID')}`;
}
function fmtRpCompact(n: number): string {
  if (Math.abs(n) >= COMPACT_THRESHOLD) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}M`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

type ChartMode = 'TOTAL' | 'BY_TYPE';

export function ClosingQuarterlyView() {
  const t = useTranslations('closingTrend');

  const [selectedYears, setSelectedYears] = useState<number[]>([CURRENT_YEAR, CURRENT_YEAR - 1]);
  const [mode, setMode] = useState<ChartMode>('TOTAL');
  const [data, setData] = useState<ApiResp['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (years: number[]) => {
    setLoading(true);
    setError(null);
    try {
      const qs = years.length ? `?years=${years.join(',')}` : '';
      const res = await fetch(`/api/tax/quarterly-trend${qs}`, { credentials: 'include' });
      const json = (await res.json()) as ApiResp;
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'failed');
        return;
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedYears);
  }, [load, selectedYears]);

  const toggleYear = (y: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(y)) {
        // Keep at least 1 year selected.
        if (prev.length === 1) return prev;
        return prev.filter((v) => v !== y);
      }
      // Cap at 2 years for chart readability.
      const next = [...prev, y].sort((a, b) => b - a);
      return next.slice(0, 2);
    });
  };

  // Build chart rows: one row per quarter, columns per year.
  const chartRows = useMemo(() => {
    if (!data) return [] as Array<{ quarter: string; [yr: string]: number | string }>;
    const map = new Map<1 | 2 | 3 | 4, { quarter: string; [yr: string]: number | string }>();
    ([1, 2, 3, 4] as const).forEach((q) => map.set(q, { quarter: `Q${q}` }));
    for (const r of data.quarters) {
      const row = map.get(r.quarter);
      if (!row) continue;
      row[String(r.year)] = r.total;
    }
    return Array.from(map.values());
  }, [data]);

  const yearsSorted = useMemo(
    () => (data?.years ?? []).slice().sort((a, b) => b - a),
    [data],
  );

  const yearColors: Record<number, string> = {};
  yearsSorted.forEach((y, i) => {
    yearColors[y] = YEAR_PALETTE[i % YEAR_PALETTE.length];
  });

  // BY_TYPE mode renders a single-year stacked bar chart. Pick the most
  // recent year that has data, or fall back to the first selected year.
  const stackedYear = yearsSorted[0] ?? selectedYears[0];

  // Per-tax-type stacked chart rows for the chosen year.
  const stackedRows = useMemo(() => {
    if (!data || mode !== 'BY_TYPE' || stackedYear == null) {
      return [] as Array<Record<string, string | number>>;
    }
    const rows: Array<Record<string, string | number>> = ([1, 2, 3, 4] as const).map(
      (q) => ({ quarter: `Q${q}` }),
    );
    for (const r of data.quarters) {
      if (r.year !== stackedYear) continue;
      const row = rows[r.quarter - 1];
      for (const [tt, amt] of Object.entries(r.byType)) {
        row[tt] = amt;
      }
    }
    return rows;
  }, [data, mode, stackedYear]);

  const stackedTypes = useMemo(() => {
    if (!data || mode !== 'BY_TYPE') return [] as string[];
    // Use data.taxTypes ordering (canonical first, then any custom).
    return data.taxTypes;
  }, [data, mode]);

  if (loading && !data) {
    return (
      <p className="text-sm text-slate-500">
        <Loader2 className="inline h-4 w-4 mr-1 animate-spin" />
        {t('loading')}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">
        <AlertCircle className="inline h-4 w-4 mr-1" />
        {error}
      </p>
    );
  }

  const hasAnyData = data?.quarters && data.quarters.length > 0;
  const yoy = data?.yoy ?? null;

  return (
    <div>
      {/* Year selector + mode toggle */}
      <div className="mt-2 flex items-center flex-wrap gap-3">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-700">{t('yearSelector')}:</span>
          {AVAILABLE_YEARS.map((y) => {
            const on = selectedYears.includes(y);
            return (
              <button
                key={y}
                onClick={() => toggleYear(y)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  on
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {y}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="tablist">
          {([
            ['TOTAL', t('modeTotal')],
            ['BY_TYPE', t('modeByType')],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                mode === m ? 'bg-slate-950 text-white' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-1">{t('quarterSubtitle')}</p>

      {!hasAnyData ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
          <p className="text-sm text-slate-500">{t('quarterEmpty')}</p>
        </div>
      ) : (
        <>
          {/* YoY banner (only if 2 years requested + both have data) */}
          {yoy && yearsSorted.length >= 2 && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-xs font-bold text-emerald-900">
                {t('yoyQuarterTitle')}
              </p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {yoy.map((q) => (
                  <div key={q.quarter}>
                    <p className="text-[10px] uppercase tracking-wide text-emerald-700">
                      Q{q.quarter} ({q.prevYear} → {q.currYear})
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                      {q.deltaPct == null
                        ? '—'
                        : `${q.deltaPct > 0 ? '+' : ''}${q.deltaPct.toFixed(1)}%`}
                    </p>
                    <p className="text-[10px] text-slate-500">{fmtRpCompact(q.currTotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart */}
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-bold text-slate-900">
                {mode === 'BY_TYPE' && stackedYear
                  ? t('stackedTitle', { year: stackedYear })
                  : t('quarterTitle')}
              </p>
            </div>
            {mode === 'BY_TYPE' && yearsSorted.length > 1 && stackedYear && (
              <p className="text-[11px] text-slate-500 mb-2">
                {t('stackedSingleYearHint', { year: stackedYear })}
              </p>
            )}
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={mode === 'BY_TYPE' ? stackedRows : chartRows}
                  margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    tickFormatter={(v: number) => fmtRpCompact(v)}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const num = typeof value === 'number' ? value : Number(value ?? 0);
                      return [fmtRp(num), String(name)];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {mode === 'TOTAL'
                    ? yearsSorted.map((y) => (
                        <Bar
                          key={y}
                          dataKey={String(y)}
                          name={String(y)}
                          fill={yearColors[y]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))
                    : stackedTypes.map((tt, i) => (
                        <Bar
                          key={tt}
                          dataKey={tt}
                          name={tt}
                          stackId="taxtype"
                          fill={TAX_TYPE_COLORS[tt] ?? TAX_TYPE_FALLBACK}
                          radius={i === stackedTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-2 px-3">{t('thQuarter')}</th>
                  {yearsSorted.map((y) => (
                    <th key={y} className="text-right py-2 px-3">
                      {y} {t('thTotal')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([1, 2, 3, 4] as const).map((q) => (
                  <tr key={q}>
                    <td className="py-2 px-3 font-semibold text-slate-900">Q{q}</td>
                    {yearsSorted.map((y) => {
                      const r = data!.quarters.find((x) => x.year === y && x.quarter === q);
                      return (
                        <td key={y} className="py-2 px-3 text-right font-mono text-slate-900">
                          {r ? fmtRp(r.total) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
