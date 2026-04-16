'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, CheckCircle, AlertTriangle, CreditCard } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface SubscriptionData {
  subscription: {
    id: string;
    plan_id: string;
    plan_name: string;
    price_idr: number;
    status: string;
    valid_until: string;
  } | null;
  usage: {
    employees: number;
    withholdingPerMonth: number;
    ppnPerMonth: number;
  };
  recommendation: {
    planId: string | null;
    planName: string | null;
    reason: string;
    exceedsAllPlans: boolean;
  };
}

export function CurrentPlanWidget() {
  const t = useTranslations('currentPlan');
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/corporate-plan')
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

  const hasActivePlan = data.subscription?.status === 'ACTIVE';
  const currentPlanId = data.subscription?.plan_id;
  const recommendedPlanId = data.recommendation.planId;
  const needsUpgrade = hasActivePlan && recommendedPlanId && currentPlanId !== recommendedPlanId;
  const needsCustomQuote = data.recommendation.exceedsAllPlans;

  // No active subscription — prompt to pick a plan
  if (!hasActivePlan) {
    return (
      <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-blue-900">{t('noSubscription')}</p>
              <p className="text-xs text-blue-700 mt-1">
                {t('subscriptionNeeded')} <b>{data.recommendation.planName || 'UMKM'}</b> {t('planRecommended')}
              </p>
              <p className="text-[10px] text-blue-600 mt-1">{data.recommendation.reason}</p>
              <Button size="sm" className="mt-3" asChild>
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

  // Custom quote needed (over-Pro usage)
  if (needsCustomQuote) {
    return (
      <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-600">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-sm text-amber-900">{t('proLimitExceeded')}</p>
                <Badge className="bg-amber-600 text-white text-[9px]">{data.subscription?.plan_name}</Badge>
              </div>
              <p className="text-xs text-amber-800 mt-1">{data.recommendation.reason}</p>
              <p className="text-[10px] text-amber-700 mt-2">
                {t('customQuotePrompt')}
              </p>
              <Button size="sm" variant="outline" className="mt-3 border-amber-400 text-amber-900" asChild>
                <Link href={`/${locale}/contact`}>{t('requestCustomQuote')}</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active plan with possible upgrade suggestion
  return (
    <Card className={needsUpgrade ? 'border-2 border-blue-300' : 'border-0 shadow-sm'}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs font-medium text-gray-600">{t('currentPlan')}</p>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-lg font-bold text-gray-900">{data.subscription?.plan_name}</p>
              <p className="text-xs text-gray-500">{t('perMonth')} {fmtRp(data.subscription?.price_idr || 0)}</p>
            </div>
            {data.subscription?.valid_until && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {t('nextPayment')}: {new Date(data.subscription.valid_until).toLocaleDateString('ko-KR')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
              <Badge className="bg-gray-100 text-gray-700">{t('employees')} {data.usage.employees}</Badge>
              <Badge className="bg-gray-100 text-gray-700">{t('withholdingPerMonth')} {data.usage.withholdingPerMonth}</Badge>
              <Badge className="bg-gray-100 text-gray-700">{t('ppnPerMonth')} {data.usage.ppnPerMonth}</Badge>
            </div>
          </div>
          {needsUpgrade ? (
            <Button size="sm" asChild>
              <Link href={`/${locale}/pricing`}>
                <Sparkles className="h-3 w-3 mr-1" />
                {t('upgrade')}
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/${locale}/pricing`}>{t('changePlan')}</Link>
            </Button>
          )}
        </div>
        {needsUpgrade && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-[11px] text-blue-800 flex items-start gap-2">
            <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span>
              {t('usageSuitablePrefix')} <b>{data.recommendation.planName}</b> {t('usageSuitableSuffix')} {data.recommendation.reason}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
