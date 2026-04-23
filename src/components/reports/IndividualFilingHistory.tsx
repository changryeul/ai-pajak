'use client';

/**
 * IndividualFilingHistory — 5-year accordion of annual SPT filings.
 *
 * Keynote slide-18/19 target: each year block shows filing header (type, date,
 * status) and a table of documents (SPT / BPE / A1 / 재무제표) with preview +
 * download actions.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, Loader2 } from 'lucide-react';

interface DocEntry {
  type: string;
  name: string;
  path: string;
  number?: string | null;
}

interface YearEntry {
  year: number;
  filingId: string;
  filingType: string;
  submittedAt: string | null;
  status: string;
  documents: DocEntry[];
}

function statusBadge(t: (k: string) => string, status: string) {
  if (status === 'COMPLETED' || status === 'SUBMITTED') {
    return { text: t('statusCompleted'), cls: 'bg-emerald-100 text-emerald-700' };
  }
  if (status === 'UNDER_REVIEW' || status === 'PENDING_APPROVAL') {
    return { text: t('statusInProgress'), cls: 'bg-blue-100 text-blue-700' };
  }
  if (status === 'DRAFT') {
    return { text: t('statusDraft'), cls: 'bg-amber-100 text-amber-700' };
  }
  return { text: t('statusNone'), cls: 'bg-gray-100 text-gray-500' };
}

function docStatus(t: (k: string) => string, type: string) {
  if (type === 'SPT') return t('docStatusSubmitted');
  if (type === 'BPE') return t('docStatusIssued');
  return t('docStatusAvailable');
}

export default function IndividualFilingHistory() {
  const t = useTranslations('filingHistory');
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<YearEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/filing-history', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && data?.success) {
          setYears(data.data.years as YearEntry[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('pageSubtitle')}</p>
      </header>

      <div className="space-y-4">
        {years.map((y) => {
          const badge = statusBadge(t, y.status);
          const hasFiling = y.status !== 'NONE';
          return (
            <Card key={y.year} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {t('yearHeader', { year: y.year })}
                    </p>
                    {hasFiling ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('yearMeta', {
                          type: y.filingType,
                          date: y.submittedAt
                            ? new Date(y.submittedAt).toISOString().slice(0, 10)
                            : '-',
                          status: badge.text,
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">{t('noFilingForYear')}</p>
                    )}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                {hasFiling && y.documents.length > 0 && (
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[90px_1fr_110px_auto] gap-2 px-4 py-2 bg-gray-50 text-[11px] font-semibold text-gray-600 uppercase">
                      <span>{t('colType')}</span>
                      <span>{t('colName')}</span>
                      <span>{t('colStatus')}</span>
                      <span className="text-right">{t('colAction')}</span>
                    </div>
                    {y.documents.map((d, i) => (
                      <div
                        key={`${d.type}-${i}`}
                        className="grid grid-cols-[90px_1fr_110px_auto] gap-2 px-4 py-3 items-center text-sm border-t"
                      >
                        <span className="text-xs font-semibold text-gray-700">{d.type}</span>
                        <span className="truncate text-gray-800 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          {d.name}
                          {d.number && (
                            <span className="text-[10px] text-gray-400 font-mono ml-1">
                              #{d.number}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">{docStatus(t, d.type)}</span>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => window.open(d.path, '_blank')}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t('actionPreview')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = d.path;
                              a.download = d.name;
                              a.click();
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {t('actionDownload')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
