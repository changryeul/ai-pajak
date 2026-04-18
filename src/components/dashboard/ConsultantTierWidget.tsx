'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, ArrowRight, CheckCircle, Sparkles, CreditCard, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { fmtRp } from '@/lib/utils';

interface TierData {
  partnerId: string;
  partnerName: string;
  subscription: {
    id: string;
    tier_id: string;
    price_idr: number;
    status: string;
    valid_until: string;
  } | null;
  managedClientCount: number;
  recommendation: {
    tierId: string | null;
    reason: string;
  };
  availableTiers: {
    id: string;
    priceIdr: number;
    billingCycle: string;
    maxClients: number;
    featureCount: number;
  }[];
}

export function ConsultantTierWidget() {
  const t = useTranslations('consultantTier');
  const tPlans = useTranslations('pricingPlans');
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const [data, setData] = useState<TierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/consultant-plan')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="h-16 animate-pulse bg-gray-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasActive = data.subscription?.status === 'ACTIVE';
  const currentTierId = data.subscription?.tier_id;
  const recommendedTierId = data.recommendation.tierId;
  const needsUpgrade = hasActive && recommendedTierId && currentTierId !== recommendedTierId;
  const currentTier = hasActive
    ? data.availableTiers?.find((x) => x.id === currentTierId)
    : null;
  const overLimit = Boolean(
    currentTier && currentTier.maxClients < 999_999 && data.managedClientCount > currentTier.maxClients,
  );
  const nearLimit = Boolean(
    currentTier && currentTier.maxClients < 999_999 &&
    !overLimit && data.managedClientCount >= currentTier.maxClients * 0.8,
  );

  // No active subscription
  if (!hasActive) {
    return (
      <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-600">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-purple-900">{t('subscriptionNeeded')}</p>
              <p className="text-xs text-purple-700 mt-1">
                {t('currentClientsPrefix', { count: data.managedClientCount })} <b>{tPlans(`${data.recommendation.tierId || 'STARTER'}.name`)}</b> {t('tierRecommended')}
              </p>
              <p className="text-[10px] text-purple-600 mt-1">{data.recommendation.reason}</p>
              <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700" asChild>
                <Link href={`/${locale}/pricing`}>
                  {t('viewPlans')} <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const borderCls = overLimit
    ? 'border-2 border-red-400'
    : nearLimit
    ? 'border-2 border-amber-400'
    : needsUpgrade
    ? 'border-2 border-purple-300'
    : 'border-0 shadow-sm';

  return (
    <Card className={borderCls}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-medium text-gray-600">{t('currentTier')}</p>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-lg font-bold text-gray-900">
                {data.subscription?.tier_id ? tPlans(`${data.subscription.tier_id}.name`) : ''}
              </p>
              <p className="text-xs text-gray-500">{t('perMonth')} {fmtRp(data.subscription?.price_idr || 0)}</p>
            </div>
            {data.subscription?.valid_until && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {t('nextPayment')}: {new Date(data.subscription.valid_until).toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : locale === 'ja' ? 'ja-JP' : locale === 'zh' ? 'zh-CN' : 'id-ID')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge
                className={
                  overLimit
                    ? 'bg-red-100 text-red-800 text-[10px]'
                    : nearLimit
                    ? 'bg-amber-100 text-amber-800 text-[10px]'
                    : 'bg-purple-100 text-purple-700 text-[10px]'
                }
              >
                {data.managedClientCount} /{' '}
                {currentTier && currentTier.maxClients >= 999_999
                  ? '∞'
                  : currentTier
                  ? currentTier.maxClients
                  : '—'}
              </Badge>
            </div>
          </div>
          {overLimit || needsUpgrade ? (
            <Button size="sm" asChild>
              <Link href={`/${locale}/pricing`}>
                <Sparkles className="h-3 w-3 mr-1" />
                {t('upgrade')}
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/${locale}/pricing`}>{t('changeTier')}</Link>
            </Button>
          )}
        </div>
        {overLimit && (
          <div className="mt-3 p-2 bg-red-50 rounded text-[11px] text-red-800 flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span>{t('overLimitBody')}</span>
          </div>
        )}
        {!overLimit && nearLimit && (
          <div className="mt-3 p-2 bg-amber-50 rounded text-[11px] text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span>{t('nearLimitBody', { max: currentTier!.maxClients })}</span>
          </div>
        )}
        {!overLimit && !nearLimit && needsUpgrade && (
          <div className="mt-3 p-2 bg-purple-50 rounded text-[11px] text-purple-800 flex items-start gap-2">
            <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span>
              {t('suitablePrefix')} <b>{data.recommendation.tierId ? tPlans(`${data.recommendation.tierId}.name`) : ''}</b> {t('suitableSuffix')} {data.recommendation.reason}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
