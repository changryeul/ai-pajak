'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  FileText,
  DollarSign,
  Activity,
  BarChart3,
} from 'lucide-react';

/**
 * IMPORTANT: Platform Admin Stats Widget
 *
 * HARD RULE #1: PLATFORM_ADMIN cannot access raw customer tax data
 *
 * This widget shows ONLY:
 * - Aggregated counts (total customers, total filings)
 * - Bucketed financial data (revenue ranges, not exact amounts)
 * - Activity metrics (not individual user actions)
 * - System health indicators
 *
 * NO customer PII, NO tax amounts, NO NPWP, NO names
 */

interface PlatformMetrics {
  customers: {
    total: number;
    newThisMonth: number;
    activeThisMonth: number;
    byType: {
      individual: number;
      company: number;
    };
  };
  filings: {
    total: number;
    thisMonth: number;
    byStatus: {
      draft: number;
      submitted: number;
      accepted: number;
    };
  };
  revenue: {
    bucket: string; // e.g., '10M - 50M' - NOT exact amount
    trend: 'up' | 'down' | 'stable';
    transactionCount: number;
  };
  consultants: {
    total: number;
    active: number;
  };
  system: {
    uptime: number;
    apiCalls24h: number;
    errorRate: number;
  };
}

export function PlatformStats() {
  const t = useTranslations('platformStats');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch platform metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-8 w-16 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const statCards = [
    {
      title: t('totalCustomers'),
      value: metrics.customers.total.toLocaleString(),
      change: `+${metrics.customers.newThisMonth} this month`,
      icon: Users,
      color: 'blue',
    },
    {
      title: t('totalFilings'),
      value: metrics.filings.total.toLocaleString(),
      change: `${metrics.filings.thisMonth} this month`,
      icon: FileText,
      color: 'green',
    },
    {
      title: t('revenueRange'),
      value: metrics.revenue.bucket,
      change: `${metrics.revenue.trend === 'up' ? '+' : metrics.revenue.trend === 'down' ? '-' : ''}${metrics.revenue.transactionCount} transactions`,
      icon: DollarSign,
      color: 'purple',
    },
    {
      title: t('activeConsultants'),
      value: `${metrics.consultants.active}/${metrics.consultants.total}`,
      change: 'Currently active',
      icon: Building2,
      color: 'orange',
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600' },
  };

  return (
    <div className="space-y-6">
      {/* Important Notice for Platform Admin */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">{t('dashboardTitle')}</p>
              <p className="text-sm text-blue-700">
                Showing aggregated platform metrics. Customer tax data and PII are not accessible from this view.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color];
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{stat.change}</p>
                  </div>
                  <div className={`rounded-lg ${colors.bg} p-3`}>
                    <Icon className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Distribution Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              Customer Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Individual</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(metrics.customers.byType.individual / metrics.customers.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium w-12 text-right">
                    {metrics.customers.byType.individual}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Company</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(metrics.customers.byType.company / metrics.customers.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium w-12 text-right">
                    {metrics.customers.byType.company}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filing Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Filing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Draft</Badge>
                </div>
                <span className="font-medium">{metrics.filings.byStatus.draft}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>
                </div>
                <span className="font-medium">{metrics.filings.byStatus.submitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Accepted</Badge>
                </div>
                <span className="font-medium">{metrics.filings.byStatus.accepted}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-500" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">
                {metrics.system.uptime.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Uptime (30d)</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">
                {metrics.system.apiCalls24h.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">API Calls (24h)</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${
              metrics.system.errorRate < 1 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className={`text-3xl font-bold ${
                metrics.system.errorRate < 1 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metrics.system.errorRate.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Error Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
