'use client';

/**
 * Pricing Plans Page
 *
 * Shows available subscription plans with features comparison
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRICING_PLANS, formatCurrency, type BillingCycle, type SubscriptionPlan } from '@/lib/billing/types';
import { cn } from '@/lib/utils';

export default function PlansPage() {
  const t = useTranslations('billing');
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('YEARLY');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (planId: SubscriptionPlan) => {
    setLoading(true);
    setSelectedPlan(planId);

    try {
      const response = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          billingCycle,
        }),
      });

      if (response.ok) {
        router.push('/billing?success=true');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create subscription');
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('Failed to create subscription');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">{t('choosePlan')}</h1>
        <p className="text-gray-600">{t('planSubtitle')}</p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={cn(
              'rounded-full px-6 py-2 text-sm font-medium transition-colors',
              billingCycle === 'MONTHLY'
                ? 'bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={cn(
              'flex items-center gap-2 rounded-full px-6 py-2 text-sm font-medium transition-colors',
              billingCycle === 'YEARLY'
                ? 'bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t('yearly')}
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {t('savePercent', { percent: 17 })}
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg',
              plan.popular ? 'border-blue-500' : 'border-gray-200'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-blue-500 px-4 py-1 text-sm font-medium text-white">
                  {t('mostPopular')}
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold">
                  {formatCurrency(
                    billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice
                  )}
                </span>
                <span className="ml-2 text-gray-500">
                  /{billingCycle === 'MONTHLY' ? t('month') : t('year')}
                </span>
              </div>
              {billingCycle === 'YEARLY' && (
                <p className="mt-1 text-sm text-green-600">
                  {t('saveAmount', {
                    amount: formatCurrency(plan.monthlyPrice * 12 - plan.yearlyPrice),
                  })}
                </p>
              )}
            </div>

            <ul className="mb-8 flex-grow space-y-3">
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-green-500" />
                <span>
                  {plan.features.maxTaxFilings === -1
                    ? t('unlimitedFilings')
                    : t('filingsPerYear', { count: plan.features.maxTaxFilings })}
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-green-500" />
                <span>
                  {plan.features.maxDocumentsPerMonth === -1
                    ? t('unlimitedDocs')
                    : t('docsPerMonth', { count: plan.features.maxDocumentsPerMonth })}
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-green-500" />
                <span>{t('storageGB', { count: plan.features.maxStorageGB })}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                {plan.features.ocrEnabled ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={!plan.features.ocrEnabled ? 'text-gray-400' : ''}>
                  {t('ocrProcessing')}
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                {plan.features.prioritySupport ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={!plan.features.prioritySupport ? 'text-gray-400' : ''}>
                  {t('prioritySupport')}
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                {plan.features.customReports ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={!plan.features.customReports ? 'text-gray-400' : ''}>
                  {t('customReports')}
                </span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                {plan.features.apiAccess ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={!plan.features.apiAccess ? 'text-gray-400' : ''}>
                  {t('apiAccess')}
                </span>
              </li>
            </ul>

            <Button
              className={cn(
                'w-full',
                plan.popular ? '' : 'bg-gray-800 hover:bg-gray-900'
              )}
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading}
            >
              {loading && selectedPlan === plan.id ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('processing')}
                </span>
              ) : (
                t('getStarted')
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-6 text-center text-2xl font-bold">{t('faqTitle')}</h2>
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-2 font-semibold">{t('faq1Question')}</h3>
            <p className="text-gray-600">{t('faq1Answer')}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-2 font-semibold">{t('faq2Question')}</h3>
            <p className="text-gray-600">{t('faq2Answer')}</p>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-2 font-semibold">{t('faq3Question')}</h3>
            <p className="text-gray-600">{t('faq3Answer')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
