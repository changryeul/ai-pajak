'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AlertTriangle, HelpCircle, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAssetGrowthAnomaly, yoyGrowth, type YearTotal } from '@/lib/snapshots/trend';

type FundingKind = 'SALARY' | 'BUSINESS' | 'INVESTMENT' | 'LOAN' | 'INHERITANCE' | 'OTHER';
const FUNDING_KINDS: readonly FundingKind[] = [
  'SALARY', 'BUSINESS', 'INVESTMENT', 'LOAN', 'INHERITANCE', 'OTHER',
];

interface SnapshotsResponse {
  summary?: {
    assetByYear?: YearTotal[];
    incomeByYear?: YearTotal[];
  };
}

interface FundingRow {
  snapshot_year: number;
  sources: FundingKind[];
  note: string | null;
}

/**
 * Reads /api/customer/snapshots, computes asset + income YoY growth for the
 * latest available year, runs isAssetGrowthAnomaly (1.5× rule), and renders:
 *
 *   * The two growth rates (always, if data exists)
 *   * A warning banner when the rule fires
 *   * A funding-source checklist + note field (T-003) when the warning fires,
 *     bound to /api/customer/funding-source with upsert semantics.
 *
 * No chart. The card is the FLAG, not the visualisation — chart follows in
 * a later batch.
 */
export function GrowthAnomalyCard() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assetByYear, setAssetByYear] = useState<YearTotal[]>([]);
  const [incomeByYear, setIncomeByYear] = useState<YearTotal[]>([]);
  const [existing, setExisting] = useState<FundingRow[]>([]);

  // Survey state
  const [selectedKinds, setSelectedKinds] = useState<Set<FundingKind>>(new Set());
  const [note, setNote] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const loadAll = useCallback(async () => {
    try {
      const [snapRes, fundRes] = await Promise.all([
        fetch('/api/customer/snapshots', { credentials: 'include' }),
        fetch('/api/customer/funding-source', { credentials: 'include' }),
      ]);
      if (!snapRes.ok) throw new Error('snap');
      const snap: { data?: SnapshotsResponse['summary'] extends infer _S ? { summary?: _S } : never } =
        await snapRes.json();
      const s = (snap as { data?: SnapshotsResponse }).data?.summary ?? {};
      setAssetByYear(s.assetByYear ?? []);
      setIncomeByYear(s.incomeByYear ?? []);

      if (fundRes.ok) {
        const fund = (await fundRes.json()) as { data?: FundingRow[] };
        setExisting(fund.data ?? []);
      }
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Derive the latest available year that has BOTH asset + income data.
  const { latestYear, prevYear, assetGrowth, incomeGrowth, anomaly } = useMemo(() => {
    const yearsWithAssets = new Set(assetByYear.map((y) => y.year));
    const yearsWithIncome = new Set(incomeByYear.map((y) => y.year));
    const common = [...yearsWithAssets].filter((y) => yearsWithIncome.has(y)).sort((a, b) => b - a);
    const latest = common[0];
    const prev = latest !== undefined ? latest - 1 : undefined;
    if (latest === undefined || prev === undefined) {
      return { latestYear: undefined, prevYear: undefined, assetGrowth: null, incomeGrowth: null, anomaly: null };
    }
    const findA = (y: number) => assetByYear.find((r) => r.year === y)?.total;
    const findI = (y: number) => incomeByYear.find((r) => r.year === y)?.total;
    const aCurr = findA(latest) ?? 0;
    const aPrev = findA(prev);
    const iCurr = findI(latest) ?? 0;
    const iPrev = findI(prev);
    const aG = yoyGrowth(aPrev, aCurr);
    const iG = yoyGrowth(iPrev, iCurr);
    return {
      latestYear: latest,
      prevYear: prev,
      assetGrowth: aG,
      incomeGrowth: iG,
      anomaly: isAssetGrowthAnomaly(aG, iG),
    };
  }, [assetByYear, incomeByYear]);

  // Seed survey from any existing answer for the current latestYear.
  useEffect(() => {
    if (!latestYear) return;
    const row = existing.find((r) => r.snapshot_year === latestYear);
    if (row) {
      setSelectedKinds(new Set(row.sources));
      setNote(row.note ?? '');
    } else {
      setSelectedKinds(new Set());
      setNote('');
    }
  }, [latestYear, existing]);

  const toggleKind = (kind: FundingKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const saveSurvey = async () => {
    if (!latestYear) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/customer/funding-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          snapshot_year: latestYear,
          sources: [...selectedKinds],
          note: note || null,
        }),
      });
      if (!res.ok) throw new Error('save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      await loadAll();
    } catch {
      setSaveStatus('error');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>;
  }

  // Not enough data → informational card encouraging the user to add snapshots.
  if (anomaly === null) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            {t('anomaly.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500">
          {t('anomaly.notEnoughData')}
        </CardContent>
      </Card>
    );
  }

  const fmtPct = (v: number | null) => v === null ? '—' : `${(v * 100).toFixed(1)}%`;

  return (
    <Card className={cn(anomaly && 'border-amber-300')}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {anomaly ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          )}
          {t('anomaly.title')}
          <span className="text-xs font-normal text-gray-500">
            · {prevYear} → {latestYear}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Growth rate summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">{t('anomaly.assetGrowth')}</div>
            <div className="text-lg font-bold mt-0.5">{fmtPct(assetGrowth)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">{t('anomaly.incomeGrowth')}</div>
            <div className="text-lg font-bold mt-0.5">{fmtPct(incomeGrowth)}</div>
          </div>
        </div>

        {anomaly ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">{t('anomaly.warningTitle')}</p>
            <p className="text-xs mt-1">
              {t('anomaly.warningBody', {
                assetGrowth: fmtPct(assetGrowth),
                incomeGrowth: fmtPct(incomeGrowth),
              })}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ {t('anomaly.okBody')}
          </div>
        )}

        {/* Funding-source survey — only when anomaly fires */}
        {anomaly && (
          <div className="pt-3 border-t space-y-3">
            <p className="text-sm font-medium flex items-center gap-1">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              {t('anomaly.fundingPrompt')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {FUNDING_KINDS.map((kind) => (
                <label key={kind} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedKinds.has(kind)}
                    onChange={() => toggleKind(kind)}
                  />
                  {t(`anomaly.funding.${kind}`)}
                </label>
              ))}
            </div>
            <textarea
              className="w-full p-2 border rounded text-sm"
              rows={2}
              placeholder={t('anomaly.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-gray-500">
                {saveStatus === 'saving' && t('autoSave.saving')}
                {saveStatus === 'saved'  && `✓ ${t('autoSave.saved')}`}
                {saveStatus === 'error'  && t('autoSave.error')}
              </span>
              <Button size="sm" onClick={saveSurvey} disabled={saveStatus === 'saving'}>
                {t('anomaly.saveAnswer')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
