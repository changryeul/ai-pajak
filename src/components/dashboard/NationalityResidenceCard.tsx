'use client';

/**
 * Top-of-dashboard selectors for nationality + tax residence.
 *
 * JTC's differentiated INDIVIDUAL segment is expats (Korean, Japanese,
 * American) who file in Indonesia but may also owe home-country reporting.
 * Surfacing these two knobs up top — instead of burying them inside the
 * ForeignAssetReportingCard — signals upfront that the product supports
 * cross-border situations.
 *
 * Pairs with ForeignAssetReportingCard below, which reads the SAME
 * customer row and evaluates the home-country threshold rule.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui';
import { Globe, Loader2 } from 'lucide-react';
import { AutoSaveIndicator } from '@/components/profile/AutoSaveIndicator';
import { useAutoSave } from '@/lib/profile/use-auto-save';
import type { CountryCode } from '@/lib/cross-border/foreign-asset-rules';

const COUNTRIES: readonly CountryCode[] = ['ID', 'KR', 'US', 'JP'];

interface Profile {
  nationality: CountryCode | null;
  tax_residence_country: CountryCode | null;
}

export function NationalityResidenceCard() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({
    nationality: null,
    tax_residence_country: null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/profile', { credentials: 'include' });
      if (res.ok) {
        const j = (await res.json()) as {
          data?: { customer?: Profile };
        };
        if (j.data?.customer) {
          setProfile({
            nationality: j.data.customer.nationality ?? null,
            tax_residence_country: j.data.customer.tax_residence_country ?? null,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const payload = useMemo(() => ({
    nationality: profile.nationality,
    tax_residence_country: profile.tax_residence_country,
  }), [profile.nationality, profile.tax_residence_country]);

  const save = useCallback(async (data: typeof payload) => {
    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('save_failed');
  }, []);

  const { status: saveStatus, retry } = useAutoSave(payload, {
    save,
    enabled: !loading,
    skipFirst: true,
  });

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-sky-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Globe className="h-4 w-4 text-sky-600" />
            {t('nationality.heading')}
          </div>
          <AutoSaveIndicator status={saveStatus} onRetry={retry} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-gray-500 mb-1">{t('nationality.nationality')}</div>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
              value={profile.nationality ?? ''}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  nationality: (e.target.value || null) as CountryCode | null,
                }))
              }
            >
              <option value="">{t('nationality.unspecified')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {t(`nationality.country.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-500 mb-1">{t('nationality.taxResidence')}</div>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
              value={profile.tax_residence_country ?? ''}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  tax_residence_country: (e.target.value || null) as CountryCode | null,
                }))
              }
            >
              <option value="">{t('nationality.unspecified')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {t(`nationality.country.${c}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
