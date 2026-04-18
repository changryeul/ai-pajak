'use client';

/**
 * SPT 1770 "Harta dan Kewajiban" on the dashboard.
 *
 * The INDIVIDUAL SPT requires a snapshot of assets + liabilities at year-end.
 * We already collect this via asset_snapshot / liability_snapshot tables
 * (surfaced for trend analysis via GrowthAnomalyCard), but a flat
 * side-by-side table is how the DJP form actually presents it — and how
 * users expect to see their balance sheet.
 *
 * Reads the LATEST tax year's entries from /api/customer/snapshots,
 * groups by category, and renders two side-by-side cards with category +
 * total. Empty state prompts the user to add entries.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { ArrowRight, Landmark, Loader2, Wallet } from 'lucide-react';

interface AssetRow {
  snapshot_year: number;
  category: string;
  amount_idr: number;
  is_foreign?: boolean;
  label?: string | null;
}

interface LiabilityRow {
  snapshot_year: number;
  category: string;
  amount_idr: number;
  creditor_name?: string | null;
  label?: string | null;
}

interface SnapshotsResponse {
  assets?: AssetRow[];
  liabilities?: LiabilityRow[];
}

function fmtIdr(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function sumByCategory<T extends { category: string; amount_idr: number }>(
  rows: readonly T[],
): { category: string; total: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.category, (m.get(r.category) ?? 0) + (r.amount_idr ?? 0));
  }
  return [...m.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function AssetsLiabilitiesCard() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/snapshots', { credentials: 'include' });
      if (res.ok) {
        const j = (await res.json()) as { data?: SnapshotsResponse };
        setAssets(j.data?.assets ?? []);
        setLiabilities(j.data?.liabilities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Use the most recent year where we have any entry.
  const latestYear = useMemo(() => {
    const years = [...assets, ...liabilities].map((r) => r.snapshot_year);
    return years.length > 0 ? Math.max(...years) : null;
  }, [assets, liabilities]);

  const assetsAtYear = useMemo(
    () => (latestYear == null ? [] : assets.filter((r) => r.snapshot_year === latestYear)),
    [assets, latestYear],
  );
  const liabilitiesAtYear = useMemo(
    () => (latestYear == null ? [] : liabilities.filter((r) => r.snapshot_year === latestYear)),
    [liabilities, latestYear],
  );

  const assetSums = useMemo(() => sumByCategory(assetsAtYear), [assetsAtYear]);
  const liabilitySums = useMemo(() => sumByCategory(liabilitiesAtYear), [liabilitiesAtYear]);

  const assetTotal = assetSums.reduce((s, r) => s + r.total, 0);
  const liabilityTotal = liabilitySums.reduce((s, r) => s + r.total, 0);
  const netWorth = assetTotal - liabilityTotal;

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Assets */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-emerald-100 via-green-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('assetsLiabilities.assets')}</div>
                <div className="text-xs text-gray-500">
                  {latestYear ? t('assetsLiabilities.yearLabel', { year: latestYear }) : t('assetsLiabilities.noDataYet')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-gray-500">{t('assetsLiabilities.total')}</div>
              <div className="font-bold text-emerald-700">{fmtIdr(assetTotal)}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          {assetSums.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 space-y-2">
              <p>{t('assetsLiabilities.emptyAssets')}</p>
              <Link
                href={`/${locale}/tax/spt-tahunan`}
                className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
              >
                {t('assetsLiabilities.addEntry')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {assetSums.map((r) => (
                <div key={r.category} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-gray-700">
                    {t(`assetsLiabilities.assetCategory.${r.category}`, { defaultMessage: r.category } as never)}
                  </span>
                  <span className="font-mono text-gray-900">{fmtIdr(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liabilities */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-rose-100 via-pink-50 to-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('assetsLiabilities.liabilities')}</div>
                <div className="text-xs text-gray-500">
                  {latestYear
                    ? t('assetsLiabilities.netWorthLabel', { net: fmtIdr(netWorth) })
                    : t('assetsLiabilities.noDataYet')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-gray-500">{t('assetsLiabilities.total')}</div>
              <div className="font-bold text-rose-700">{fmtIdr(liabilityTotal)}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          {liabilitySums.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 space-y-2">
              <p>{t('assetsLiabilities.emptyLiabilities')}</p>
              <Link
                href={`/${locale}/tax/spt-tahunan`}
                className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
              >
                {t('assetsLiabilities.addEntry')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {liabilitySums.map((r) => (
                <div key={r.category} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-gray-700">
                    {t(`assetsLiabilities.liabilityCategory.${r.category}`, { defaultMessage: r.category } as never)}
                  </span>
                  <span className="font-mono text-gray-900">{fmtIdr(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
