'use client';

/**
 * External tax-consultant firm billing view — Phase B-3.
 *
 * Unlike corporate customers (customer_subscription) and individuals
 * (per-SPT transactions), external firms pay a monthly tier fee based
 * on the number of clients they manage. This view surfaces:
 *
 *   1. Current tier subscription status (tax_partner_subscription)
 *   2. Managed client count + tier capacity
 *   3. Subscription history
 *   4. Upgrade CTA to /pricing
 *
 * The page renders null for JTC internal consultants (API returns 403)
 * so they aren't confused by a subscription they don't pay.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle, Loader2, Sparkles, ArrowRight, Users, AlertCircle } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface TierData {
  partnerId: string;
  partnerName: string;
  subscription: {
    id: string;
    tier_id: string;
    price_idr: number;
    status: string;
    valid_from: string;
    valid_until: string;
  } | null;
  managedClientCount: number;
  recommendation: { tierId: string | null; reason: string };
  availableTiers: {
    id: string;
    priceIdr: number;
    billingCycle: string;
    maxClients: number;
    featureCount: number;
  }[];
}

export function ConsultantBillingView() {
  const t = useTranslations('consultantBilling');
  const tTier = useTranslations('consultantTier');
  const tPlans = useTranslations('pricingPlans');
  const params = useParams();
  const locale = (params?.locale as string) || 'id';
  const [data, setData] = useState<TierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/consultant-plan')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  // JTC internal consultants get { success: true, data: null } from the API —
  // render nothing (no error banner) since they have no standalone subscription.
  if (!error && !data) {
    return null;
  }

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  // Type guard — past the !data check above, TS still needs the assertion.
  if (!data) return null;

  const hasActive = data.subscription?.status === 'ACTIVE';
  const currentTier = hasActive
    ? data.availableTiers.find((t) => t.id === data.subscription?.tier_id)
    : null;
  const clientPct = currentTier
    ? Math.min(100, Math.round((data.managedClientCount / Math.max(1, currentTier.maxClients)) * 100))
    : 0;
  const nearLimit = currentTier
    ? currentTier.maxClients < 999_999 && data.managedClientCount >= currentTier.maxClients * 0.8
    : false;
  const overLimit = currentTier
    ? currentTier.maxClients < 999_999 && data.managedClientCount > currentTier.maxClients
    : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('headerTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('headerSubtitle', { partner: data.partnerName })}</p>
      </div>

      {/* No active subscription */}
      {!hasActive && (
        <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-600">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-purple-900">{tTier('subscriptionNeeded')}</p>
                <p className="text-sm text-purple-700 mt-1">
                  {tTier('currentClientsPrefix', { count: data.managedClientCount })}{' '}
                  <b>{tPlans(`${data.recommendation.tierId || 'STARTER'}.name`)}</b>{' '}
                  {tTier('tierRecommended')}
                </p>
                <Button className="mt-4 bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href={`/${locale}/pricing`}>
                    {tTier('viewPlans')} <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active subscription card */}
      {hasActive && currentTier && data.subscription && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-purple-100 via-fuchsia-50 to-pink-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-sm">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 font-medium">{tTier('currentTier')}</p>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg">
                    {tPlans(`${data.subscription.tier_id}.name`)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${locale}/pricing`}>{tTier('changeTier')}</Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">{t('monthlyFee')}</p>
                <p className="font-semibold text-gray-900">{fmtRp(data.subscription.price_idr)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('renewsOn')}</p>
                <p className="font-semibold text-gray-900">
                  {new Date(data.subscription.valid_until).toLocaleDateString(
                    locale === 'ko' ? 'ko-KR'
                    : locale === 'en' ? 'en-US'
                    : 'id-ID',
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('status')}</p>
                <Badge className="bg-emerald-100 text-emerald-800">{data.subscription.status}</Badge>
              </div>
            </div>
          </div>

          {/* Client capacity */}
          <CardContent className="p-6 pt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-700">{t('clientCapacity')}</p>
                </div>
                <p className="text-sm text-gray-900 font-semibold">
                  {data.managedClientCount} /{' '}
                  {currentTier.maxClients >= 999_999 ? '∞' : currentTier.maxClients}
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    overLimit ? 'bg-red-500'
                    : nearLimit ? 'bg-amber-500'
                    : 'bg-emerald-500'
                  }`}
                  style={{ width: `${clientPct}%` }}
                />
              </div>
              {overLimit && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">{t('overLimitTitle')}</p>
                    <p className="mt-0.5">{t('overLimitBody')}</p>
                  </div>
                  <Button size="sm" variant="destructive" asChild>
                    <Link href={`/${locale}/pricing`}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {tTier('upgrade')}
                    </Link>
                  </Button>
                </div>
              )}
              {!overLimit && nearLimit && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">{t('nearLimitTitle')}</p>
                    <p className="mt-0.5">{t('nearLimitBody', { count: currentTier.maxClients })}</p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/${locale}/pricing`}>{tTier('upgrade')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier comparison table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">{t('availableTiers')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {data.availableTiers.map((tier) => {
              const isCurrent = data.subscription?.tier_id === tier.id && hasActive;
              return (
                <div
                  key={tier.id}
                  className={`rounded-xl border p-4 ${isCurrent ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 text-sm">{tPlans(`${tier.id}.name`)}</p>
                    {isCurrent && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900">{fmtRp(tier.priceIdr)}</p>
                  <p className="text-[11px] text-gray-500">
                    {tier.maxClients >= 999_999
                      ? tTier('managedClients', { count: '∞' })
                      : tTier('managedClients', { count: tier.maxClients })}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
