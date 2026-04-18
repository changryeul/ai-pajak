'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { AlertTriangle, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  checkForeignAssetThreshold,
  type CountryCode,
} from '@/lib/cross-border/foreign-asset-rules';
import { sumForeignByYear } from '@/lib/snapshots/trend';
import { AutoSaveIndicator } from '@/components/profile/AutoSaveIndicator';
import { useAutoSave } from '@/lib/profile/use-auto-save';

const COUNTRIES: readonly CountryCode[] = ['ID', 'KR', 'US', 'JP'];

interface CustomerProfile {
  nationality: CountryCode | null;
  tax_residence_country: CountryCode | null;
}

interface AssetSnapshotRow {
  snapshot_year: number;
  amount_idr: number;
  is_foreign: boolean;
}

/**
 * Pairs a nationality / tax-residence selector with an (approximate)
 * foreign-asset threshold check. Reads assets from /api/customer/snapshots,
 * filters to is_foreign=true at the latest year, and evaluates the home
 * country's reporting rule (src/lib/cross-border/foreign-asset-rules.ts).
 *
 * The card is a compliance hint, not tax advice — rendered with a
 * "consult your local advisor" disclaimer and a link to the source.
 */
export function ForeignAssetReportingCard() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<CustomerProfile>({
    nationality: null,
    tax_residence_country: null,
  });
  const [totalForeignByYear, setTotalForeignByYear] = useState<{ year: number; total: number }[]>([]);

  // Load profile + snapshots in parallel
  const load = useCallback(async () => {
    try {
      const [profRes, snapRes] = await Promise.all([
        fetch('/api/customer/profile', { credentials: 'include' }),
        fetch('/api/customer/snapshots', { credentials: 'include' }),
      ]);
      if (profRes.ok) {
        const j = (await profRes.json()) as {
          data?: { customer?: CustomerProfile };
        };
        if (j.data?.customer) {
          setProfile({
            nationality: j.data.customer.nationality ?? null,
            tax_residence_country: j.data.customer.tax_residence_country ?? null,
          });
        }
      }
      if (snapRes.ok) {
        const j = (await snapRes.json()) as {
          data?: { assets?: AssetSnapshotRow[] };
        };
        const assets = j.data?.assets ?? [];
        setTotalForeignByYear(
          sumForeignByYear(
            assets.map((a) => ({
              snapshot_year: a.snapshot_year,
              amount_idr: a.amount_idr,
              is_foreign: a.is_foreign,
            })),
          ).map((r) => ({ year: r.year, total: r.total })),
        );
      }
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // Autosave country selections to /api/customer/profile
  const savePayload = useMemo(() => ({
    nationality: profile.nationality,
    tax_residence_country: profile.tax_residence_country,
  }), [profile.nationality, profile.tax_residence_country]);

  const save = useCallback(async (data: typeof savePayload) => {
    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('save_failed');
  }, []);

  const { status: saveStatus, retry } = useAutoSave(savePayload, {
    save,
    enabled: !loading,
  });

  // Pick the most recent year with foreign-asset data
  const latestForeign = useMemo(() => {
    const sorted = [...totalForeignByYear].sort((a, b) => b.year - a.year);
    return sorted[0] ?? { year: new Date().getFullYear(), total: 0 };
  }, [totalForeignByYear]);

  const result = checkForeignAssetThreshold(profile.nationality, latestForeign.total);

  const fmtIdr = (v: number) => 'Rp ' + v.toLocaleString('id-ID');
  const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

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

  return (
    <Card className={cn(result.requiresReporting && 'border-red-300')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-blue-600" />
            {t('crossBorder.title')}
          </CardTitle>
          <AutoSaveIndicator status={saveStatus} onRetry={retry} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-xs text-gray-500 mb-1">{t('crossBorder.nationality')}</div>
            <select
              className="w-full p-2 border rounded"
              value={profile.nationality ?? ''}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  nationality: (e.target.value || null) as CountryCode | null,
                }))
              }
            >
              <option value="">{t('crossBorder.unspecified')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {t(`crossBorder.country.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="text-xs text-gray-500 mb-1">{t('crossBorder.residence')}</div>
            <select
              className="w-full p-2 border rounded"
              value={profile.tax_residence_country ?? ''}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  tax_residence_country: (e.target.value || null) as CountryCode | null,
                }))
              }
            >
              <option value="">{t('crossBorder.unspecified')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {t(`crossBorder.country.${c}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Summary */}
        {!profile.nationality ? (
          <div className="text-xs text-gray-500">
            {t('crossBorder.pickNationalityHint')}
          </div>
        ) : result.rule === null ? (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            {t('crossBorder.noExtraRule')}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-lg p-3 text-sm',
              result.requiresReporting
                ? 'bg-red-50 border border-red-200 text-red-900'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800',
            )}
          >
            <div className="flex items-start gap-2">
              {result.requiresReporting && (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {result.requiresReporting
                    ? t('crossBorder.requiredTitle', { country: t(`crossBorder.country.${result.rule.country}`) })
                    : t('crossBorder.okTitle', { country: t(`crossBorder.country.${result.rule.country}`) })}
                </p>
                <p className="text-xs mt-1">
                  {t('crossBorder.comparison', {
                    total: fmtIdr(result.totalForeignIdr),
                    threshold: fmtIdr(result.rule.thresholdIdr),
                    ratio: result.ratio === null ? '—' : fmtPct(result.ratio),
                  })}
                </p>
                <p className="text-[11px] mt-2 text-gray-500">
                  {t('crossBorder.ratesAsOf', { date: result.rule.ratesAsOf })}
                </p>
                <a
                  href={result.rule.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline mt-1"
                >
                  {t('crossBorder.referenceLink')} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          {t('crossBorder.disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}
