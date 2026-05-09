'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * /tax/annual 진입 페이지에서 사용하는 최근 5년 결산 트렌드 카드.
 * /api/tax/closing-filings 응답을 사용 — fiscalYear별 PL + 세액을 테이블로 표시.
 * 데이터가 0건이면 안내 placeholder, 1건이면 변화율 없이 단일 행만.
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

function fmtRp(n: number | null): string {
  if (n == null) return '—';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** 전년 대비 변화율 — 전년이 null/0 이면 null. */
function changeRate(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev;
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
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700">
        <TrendingUp className="h-2.5 w-2.5" />
        {pctStr}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700">
      <TrendingDown className="h-2.5 w-2.5" />
      {pctStr}
    </span>
  );
}

export function ClosingMultiYearTrend() {
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
        // fiscalYear desc 로 정렬 + 최근 5년만
        data.sort((a, b) => b.fiscalYear - a.fiscalYear);
        setRows(data.slice(0, N_YEARS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <p className="text-base font-bold text-slate-900">최근 결산 트렌드</p>
        <p className="text-sm text-slate-400 mt-2">불러오는 중…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 mb-6">
        <p className="text-base font-bold text-slate-900">최근 결산 트렌드</p>
        <p className="text-sm text-slate-500 mt-2">
          이전 회계연도 결산 기록이 아직 없습니다. 첫 결산을 완료하면 다년 비교가 여기 표시됩니다.
        </p>
      </div>
    );
  }

  // 표는 오래된 → 최신 순으로 보여주는 게 자연스러움 (변화율 계산 방향과 일치)
  const ordered = [...rows].reverse(); // ASC

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-base font-bold text-slate-900">최근 결산 트렌드</p>
          <p className="text-xs text-slate-500 mt-0.5">
            최근 {N_YEARS}년 결산 PL + 세액 변동. 전년 대비 변화율 자동 계산.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left py-2 px-3">연도</th>
              <th className="text-left py-2 px-3">유형</th>
              <th className="text-right py-2 px-3">매출</th>
              <th className="text-right py-2 px-3">매입원가</th>
              <th className="text-right py-2 px-3">순이익</th>
              <th className="text-right py-2 px-3">세액</th>
              <th className="text-left py-2 px-3">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map((r, i) => {
              const prev = i > 0 ? ordered[i - 1] : null;
              const submissionStatus = r.submission?.status ?? '—';
              const completed = submissionStatus === 'COMPLETED';
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
                        <ChangeBadge rate={changeRate(r.taxAmount, prev.taxAmount)} />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {completed ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        신고 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        진행 중
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
        <p className="text-[11px] text-slate-500 mt-3">
          1개 연도 기록만 있어 변화율은 표시되지 않습니다. 다음 결산이 완료되면 전년 대비 비교가 자동으로 추가됩니다.
        </p>
      )}
    </div>
  );
}
