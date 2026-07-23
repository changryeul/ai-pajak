'use client';

/**
 * 최근 5년 신고 이력 — AI가 기억하는 개인의 연간 SPT 이력.
 *
 * Keynote spec: "AI는 이 개인의 결산신고 내역 5년치를 기억하고 보여줍니다."
 *
 * INDIVIDUAL customers file one SPT per year (1770SS/S/1770). The card shows
 * five tax years with: status, SPT type, and tax amount when completed.
 *
 *   2024년 신고 — ✓ 완료 · 1770S · Rp 1.5M
 *   2023년 신고 — ⧗ 진행 중
 *   2022년 신고 — + 시작하기
 *
 * Any year without a filing gets a "시작하기" CTA that routes to the
 * 1770 picker for that year.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { CheckCircle2, Clock, PlusCircle, Loader2, History } from 'lucide-react';
import { cn, fmtRp } from '@/lib/utils';

const ANNUAL_SPT_TYPES = new Set([
  'SPT_TAHUNAN',
  'SPT_1770SS',
  'SPT_1770S',
  'SPT_1770',
]);

interface Filing {
  id: string;
  filing_year?: number;
  tax_year?: number;
  /** The schema-canonical field — e.g. "2024" or "2024-03" for PPh 21 monthly. */
  tax_period?: string;
  status: string;
  tax_type?: string;
  tax_data?: Record<string, unknown> | null;
}

interface RecentFilingsCardProps {
  customerId?: string;
}

function parseFilingYear(f: Filing): number | null {
  // Canonical schema is the tax_period string (e.g. "2024" annual,
  // "2024-03" monthly). Also accept the legacy optional fields.
  if (typeof f.filing_year === 'number') return f.filing_year;
  if (typeof f.tax_year === 'number') return f.tax_year;
  if (typeof f.tax_period === 'string') {
    const m = f.tax_period.match(/^(\d{4})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function sptShortName(taxType: string | undefined): string | null {
  if (!taxType) return null;
  if (taxType === 'SPT_1770SS') return '1770SS';
  if (taxType === 'SPT_1770S') return '1770S';
  if (taxType === 'SPT_1770') return '1770';
  return null;
}

function readTaxPayable(f: Filing): number | null {
  // All 3 1770-series calculators output `taxPayable` (Rupiah). Accept
  // both camelCase (TypeScript) and snake_case (if stored post-backend).
  const d = f.tax_data;
  if (!d || typeof d !== 'object') return null;
  const pick = (k: string): number | null => {
    const v = (d as Record<string, unknown>)[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  return pick('taxPayable') ?? pick('tax_payable') ?? pick('total_tax_due') ?? null;
}

interface YearStatus {
  kind: 'done' | 'inprogress' | 'empty';
  sptShort: string | null;
  taxPayable: number | null;
}

function yearStatus(filings: Filing[], year: number): YearStatus {
  // Accept all annual SPT types (SPT_TAHUNAN, SPT_1770SS, SPT_1770S, SPT_1770).
  // Monthly PPh21/23 filings share the same table via SPT_MASA/PPh21 etc.
  // and are excluded here.
  const hit = filings.find((f) => {
    if (f.tax_type && !ANNUAL_SPT_TYPES.has(f.tax_type)) return false;
    return parseFilingYear(f) === year;
  });
  if (!hit) {
    return { kind: 'empty', sptShort: null, taxPayable: null };
  }
  const s = hit.status.toUpperCase();
  const isDone = ['ACCEPTED', 'PAID', 'COMPLETED', 'FILED'].includes(s);
  return {
    kind: isDone ? 'done' : 'inprogress',
    sptShort: sptShortName(hit.tax_type),
    taxPayable: readTaxPayable(hit),
  };
}

export function RecentFilingsCard({ customerId }: RecentFilingsCardProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [loading, setLoading] = useState(true);
  const [filings, setFilings] = useState<Filing[]>([]);

  const years = useMemo(() => {
    // Indonesian SPT is for the PRIOR tax year, filed by end-March.
    // Show the last 5 prior tax years (keynote: AI remembers 5 years).
    const current = new Date().getFullYear();
    return [current - 1, current - 2, current - 3, current - 4, current - 5];
  }, []);

  const fetch_ = useCallback(async () => {
    if (!customerId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/tax/filings?customerId=${customerId}&limit=50`);
      const j = await res.json();
      if (j.success) setFilings(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void fetch_(); }, [fetch_]);

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <div className="p-5 bg-gradient-to-r from-slate-100 via-gray-50 to-slate-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-sm">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{t('recentFilings.title')}</div>
            <div className="text-xs text-gray-500">{t('recentFilings.subtitle')}</div>
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
          </div>
        ) : (
          <div className="divide-y">
            {years.map((y) => {
              const status = yearStatus(filings, y);
              return (
                <div key={y} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm">
                      {t('recentFilings.yearLabel', { year: y })}
                    </div>
                    {status.sptShort && (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-700">
                        {status.sptShort}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {status.taxPayable !== null && status.kind === 'done' && (
                      <span className="text-xs font-mono text-gray-600">
                        {fmtRp(status.taxPayable)}
                      </span>
                    )}
                    {status.kind === 'done' && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('recentFilings.done')}
                      </span>
                    )}
                    {status.kind === 'inprogress' && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                        <Clock className="h-4 w-4" />
                        {t('recentFilings.inProgress')}
                      </span>
                    )}
                    {status.kind === 'empty' && (
                      <Link
                        href={`/${locale}/tax/spt-tahunan?year=${y}`}
                        className={cn(
                          'inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700',
                        )}
                      >
                        <PlusCircle className="h-4 w-4" />
                        {t('recentFilings.start')}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
