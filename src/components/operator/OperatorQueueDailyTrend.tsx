'use client';

import { useEffect, useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
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

/**
 * Supervisor dashboard daily activity chart.
 *
 * Data: /api/operator/queue-daily-trend?days=N
 *   - Stacked bars: x = day, segments = queue items that reached each
 *     status that day.
 *   - "Reached/last-touched" = grouped by updated_at::date.
 *
 * Layout: full-width card, header with day-range chips (7 / 14 / 30).
 */

interface DayRow {
  date: string;
  byStatus: Record<string, number>;
  total: number;
}

interface ApiResp {
  success: boolean;
  data?: { days: DayRow[]; statuses: string[] };
  error?: string;
}

// Same canonical palette as the queue page status badges so the chart stays
// consistent with the rest of the operator surface.
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#64748b',
  DATA_REVIEW: '#3b82f6',
  PENDING_APPROVAL: '#f97316',
  APPROVED: '#10b981',
  EBILLING_GENERATED: '#6366f1',
  PAYMENT_PENDING: '#facc15',
  PAYMENT_UPLOADED: '#06b6d4',
  PAYMENT_VERIFIED: '#a855f7',
  DJP_SUBMITTED: '#f59e0b',
  BPE_UPLOADED: '#14b8a6',
  COMPLETED: '#22c55e',
  FAILED: '#ef4444',
};
const FALLBACK_COLOR = '#94a3b8';

const DAY_RANGES = [7, 14, 30] as const;

export function OperatorQueueDailyTrend() {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [data, setData] = useState<ApiResp['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/operator/queue-daily-trend?days=${days}`)
      .then((r) => r.json())
      .then((j: ApiResp) => {
        if (cancelled) return;
        if (!j.success || !j.data) setError(j.error ?? 'failed');
        else setData(j.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  // Recharts row: keys = status names, values = counts.
  const chartRows = (data?.days ?? []).map((d) => ({
    date: d.date.slice(5), // MM-DD for X-axis (saves horizontal space)
    ...d.byStatus,
  }));

  const statuses = data?.statuses ?? [];
  const totalAcrossRange = (data?.days ?? []).reduce((s, d) => s + d.total, 0);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-600" />
            큐 일별 활동 추이
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            지난 {days}일간 큐 항목이 각 상태에 도달한 건수 (updated_at 기준).
            총 {totalAcrossRange.toLocaleString('ko-KR')}건.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {DAY_RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                days === d ? 'bg-slate-950 text-white' : 'text-slate-600'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-slate-500">
          <Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> 불러오는 중…
        </p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : !data || statuses.length === 0 ? (
        <p className="text-sm text-slate-400">표시할 데이터가 없습니다.</p>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} width={36} />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === 'number' ? value : Number(value ?? 0),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {statuses.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="status"
                  fill={STATUS_COLORS[s] ?? FALLBACK_COLOR}
                  name={s}
                  radius={i === statuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
