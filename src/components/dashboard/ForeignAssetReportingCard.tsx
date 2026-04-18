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
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-sky-600" />
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

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <CardHeader className={cn(
        'pb-4 bg-gradient-to-r',
        result.requiresReporting
          ? 'from-red-100 via-rose-50 to-pink-50'
          : 'from-sky-100 via-cyan-50 to-blue-50',
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br',
              result.requiresReporting
                ? 'from-red-500 to-rose-600'
                : 'from-sky-500 to-cyan-600',
            )}>
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                {t('crossBorder.title')}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{t('crossBorder.subtitle')}</p>
            </div>
          </div>
          <AutoSaveIndicator status={saveStatus} onRetry={retry} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {/* Country selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-xs text-gray-500 mb-1">{t('crossBorder.nationality')}</div>
            <select
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
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
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
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
              'rounded-xl p-4 text-sm',
              result.requiresReporting
                ? 'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 text-red-900'
                : 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-800',
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
