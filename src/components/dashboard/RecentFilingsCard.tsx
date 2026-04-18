'use client';

/**
 * 최근 3년 신고 이력 — compact year-by-year status list.
 *
 * INDIVIDUAL customers file one SPT per year (1770SS/S/full). Instead of
 * the noisy stat-card quartet (Total/Submitted/Draft/Accepted), this card
 * shows the last 3 tax years with a single-word status:
 *
 *   2025년 신고 — 완료 | 진행 중 | 시작하기
 *
 * Any year without a filing gets a "시작하기" CTA that routes to the
 * 1770 picker.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { CheckCircle2, Clock, PlusCircle, Loader2, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Filing {
  id: string;
  filing_year?: number;
  tax_year?: number;
  status: string;
  tax_type?: string;
}

interface RecentFilingsCardProps {
  customerId?: string;
}

function yearStatus(filings: Filing[], year: number) {
  const hit = filings.find((f) => (f.filing_year ?? f.tax_year) === year);
  if (!hit) return 'empty' as const;
  const s = hit.status.toUpperCase();
  if (['ACCEPTED', 'PAID', 'COMPLETED', 'BPE_UPLOADED', 'DJP_SUBMITTED'].includes(s)) return 'done' as const;
  return 'inprogress' as const;
}

export function RecentFilingsCard({ customerId }: RecentFilingsCardProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [loading, setLoading] = useState(true);
  const [filings, setFilings] = useState<Filing[]>([]);

  const years = useMemo(() => {
    // Indonesian SPT is for the PRIOR tax year, filed by end-March.
    // Show the last 3 prior tax years.
    const current = new Date().getFullYear();
    return [current - 1, current - 2, current - 3];
  }, []);

  const fetch_ = useCallback(async () => {
    if (!customerId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/tax/filings?customerId=${customerId}&limit=30`);
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
                  <div className="font-medium text-sm">
                    {t('recentFilings.yearLabel', { year: y })}
                  </div>
                  {status === 'done' && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {t('recentFilings.done')}
                    </span>
                  )}
                  {status === 'inprogress' && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                      <Clock className="h-4 w-4" />
                      {t('recentFilings.inProgress')}
                    </span>
                  )}
                  {status === 'empty' && (
                    <Link
                      href={`/${locale}/tax/1770/new?year=${y}`}
                      className={cn(
                        'inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700',
                      )}
                    >
                      <PlusCircle className="h-4 w-4" />
                      {t('recentFilings.start')}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
