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
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
      </Card>
    );
  }

  // Shared header — colored icon badge + title + subtitle
  const Header = ({ tone }: { tone: 'neutral' | 'ok' | 'warn' }) => {
    const grad =
      tone === 'warn' ? 'from-amber-100 via-orange-50 to-yellow-50'
      : tone === 'ok' ? 'from-emerald-100 via-green-50 to-teal-50'
      :                 'from-gray-100 via-slate-50 to-gray-50';
    const badgeGrad =
      tone === 'warn' ? 'from-amber-500 to-orange-600'
      : tone === 'ok' ? 'from-emerald-500 to-teal-600'
      :                 'from-gray-400 to-slate-500';
    const Icon = tone === 'warn' ? AlertTriangle : TrendingUp;
    return (
      <CardHeader className={cn('pb-4 bg-gradient-to-r', grad)}>
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br', badgeGrad)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">
              {t('anomaly.title')}
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {prevYear && latestYear ? `${prevYear} → ${latestYear}` : t('anomaly.subtitle')}
            </p>
          </div>
        </div>
      </CardHeader>
    );
  };

  // Not enough data → informational card encouraging the user to add snapshots.
  if (anomaly === null) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <Header tone="neutral" />
        <CardContent className="pt-5 text-sm text-gray-500">
          {t('anomaly.notEnoughData')}
        </CardContent>
      </Card>
    );
  }

  const fmtPct = (v: number | null) => v === null ? '—' : `${(v * 100).toFixed(1)}%`;

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <Header tone={anomaly ? 'warn' : 'ok'} />
      <CardContent className="space-y-4 pt-5">
        {/* Growth rate summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4">
            <div className="text-xs text-blue-700 font-medium uppercase tracking-wide">{t('anomaly.assetGrowth')}</div>
            <div className="text-2xl font-bold mt-1 text-blue-900 tracking-tight">{fmtPct(assetGrowth)}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-4">
            <div className="text-xs text-violet-700 font-medium uppercase tracking-wide">{t('anomaly.incomeGrowth')}</div>
            <div className="text-2xl font-bold mt-1 text-violet-900 tracking-tight">{fmtPct(incomeGrowth)}</div>
          </div>
        </div>

        {anomaly ? (
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-sm text-amber-900">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {t('anomaly.warningTitle')}
            </p>
            <p className="text-xs mt-1.5 text-amber-800/90">
              {t('anomaly.warningBody', {
                assetGrowth: fmtPct(assetGrowth),
                incomeGrowth: fmtPct(incomeGrowth),
              })}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-sm text-emerald-800 font-medium">
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
