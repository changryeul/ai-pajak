'use client';

/**
 * Billing Dashboard Page
 *
 * Shows subscription status, usage, and quick actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CreditCard, FileText, TrendingUp, Calendar, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, type Subscription, type Invoice, type UsageMetrics, PRICING_PLANS } from '@/lib/billing/types';
import { PageTitle } from '@/components/layout/PageTitle';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { IndividualBillingView } from '@/components/billing/IndividualBillingView';
import { ConsultantBillingView } from '@/components/billing/ConsultantBillingView';

export default function BillingPage() {
  const t = useTranslations('billing');
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBillingData = useCallback(async () => {
    try {
      const [subRes, invRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/invoices?limit=5'),
        fetch('/api/billing/usage'),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.data);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.data || []);
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData.data);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const plan = subscription ? PRICING_PLANS.find((p) => p.id === subscription.plan) : null;

  // INDIVIDUAL customers get a completely different view — per-SPT billing,
  // not monthly subscriptions. Route them to IndividualBillingView.
  if (!sessionLoading && session?.customerType === 'INDIVIDUAL') {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Tagihan" />
        <IndividualBillingView />
      </div>
    );
  }

  // Consultants (including external tax-firm reps) see their own tier
  // subscription, not a corporate SaaS plan. JTC internal consultants hit
  // a 403 from /api/billing/consultant-plan and the view shows an info banner.
  if (!sessionLoading && session && hasRole(session, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Tagihan" />
        <ConsultantBillingView />
      </div>
    );
  }

  if (loading || sessionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Tagihan" />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => router.push('/billing/plans')}>
          {subscription ? t('changePlan') : t('subscribe')}
        </Button>
      </div>

      {/* Subscription Overview */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        {/* Current Plan */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('currentPlan')}</p>
              <p className="font-semibold">{plan?.name || t('noActivePlan')}</p>
            </div>
          </div>
          {subscription && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('status')}</span>
                <span
                  className={
                    subscription.status === 'ACTIVE'
                      ? 'text-green-600'
                      : subscription.status === 'PAST_DUE'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }
                >
                  {subscription.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('billingCycle')}</span>
                <span>{subscription.billingCycle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('renewsOn')}</span>
                <span>
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('id-ID')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Next Invoice */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('nextInvoice')}</p>
              <p className="font-semibold">
                {subscription && plan
                  ? formatCurrency(
                      subscription.billingCycle === 'MONTHLY'
                        ? plan.monthlyPrice
                        : plan.yearlyPrice
                    )
                  : '-'}
              </p>
            </div>
          </div>
          {subscription && (
            <p className="text-sm text-gray-500">
              {t('dueOn', { date: new Date(subscription.currentPeriodEnd).toLocaleDateString('id-ID') })}
            </p>
          )}
        </div>

        {/* Usage */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('usageThisMonth')}</p>
              <p className="font-semibold">
                {usage?.taxFilings || 0} {t('filings')}
              </p>
            </div>
          </div>
          {usage && plan && (
            <div className="space-y-2">
              <div className="text-sm">
                <div className="mb-1 flex justify-between text-gray-500">
                  <span>{t('filings')}</span>
                  <span>
                    {usage.taxFilings}/{plan.features.maxTaxFilings === -1 ? '∞' : plan.features.maxTaxFilings}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${
                        plan.features.maxTaxFilings === -1
                          ? 10
                          : Math.min(100, (usage.taxFilings / plan.features.maxTaxFilings) * 100)
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-sm">
                <div className="mb-1 flex justify-between text-gray-500">
                  <span>{t('storage')}</span>
                  <span>
                    {(usage.storageUsedMB / 1024).toFixed(2)} GB / {plan.features.maxStorageGB} GB
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (usage.storageUsedMB / 1024 / plan.features.maxStorageGB) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">{t('recentInvoices')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/billing/invoices')}
          >
            {t('viewAll')}
          </Button>
        </div>
        <div className="divide-y">
          {invoices.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {t('noInvoices')}
            </div>
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      invoice.status === 'PAID'
                        ? 'bg-green-100 text-green-600'
                        : invoice.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-600'
                        : invoice.status === 'OVERDUE'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {invoice.status === 'PAID' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : invoice.status === 'OVERDUE' ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(invoice.total)}</p>
                  <p
                    className={`text-sm ${
                      invoice.status === 'PAID'
                        ? 'text-green-600'
                        : invoice.status === 'OVERDUE'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {invoice.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
