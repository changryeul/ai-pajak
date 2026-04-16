'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { fmtRp } from '@/lib/utils';

interface QueueItem {
  id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  created_at: string;
}

interface CompanyInfo {
  company_name?: string;
  npwp?: string;
  kbli_code?: string;
  business_category?: string;
  annual_revenue?: number;
  is_pkp?: boolean;
}

const UNPAID_STATUSES = ['EBILLING_GENERATED', 'PAYMENT_PENDING'];
const UPCOMING_STATUSES = [
  'PENDING',
  'DATA_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'EBILLING_GENERATED',
  'PAYMENT_PENDING',
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function CorporateDashboardV2({
  session,
}: {
  session: { customerId?: string; fullName?: string };
  locale: string;
}) {
  const t = useTranslations('corpDashboardV2');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!session.customerId) return;
    fetch(`/api/company-profile?customerId=${session.customerId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setCompanyInfo(d.data); })
      .catch(() => {});

    fetch('/api/customer/queue')
      .then((r) => r.json())
      .then((d) => {
        const items = d?.data?.items;
        if (d?.success && Array.isArray(items)) setQueueItems(items);
      })
      .catch(() => {});
  }, [session.customerId]);

  // KPIs
  const currentYear = new Date().getFullYear();
  const thisYearItems = queueItems.filter((i) => i.tax_period_year === currentYear);
  const totalTax = thisYearItems.reduce((sum, i) => sum + (i.amount || 0), 0);
  const unpaidTax = thisYearItems
    .filter((i) => UNPAID_STATUSES.includes(i.status))
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  const upcomingCount = thisYearItems.filter((i) => UPCOMING_STATUSES.includes(i.status)).length;

  // Monthly trend — last 6 months
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: MONTH_LABELS[d.getMonth()] };
  });

  const chartData = last6Months.map(({ year, month, label }) => {
    const monthItems = queueItems.filter(
      (i) => i.tax_period_year === year && i.tax_period_month === month,
    );
    const pph21 = monthItems
      .filter((i) => i.tax_type?.startsWith('PPh21') || i.tax_type === 'PPh21')
      .reduce((s, i) => s + (i.amount || 0), 0);
    const withholding = monthItems
      .filter((i) =>
        ['PPh23', 'PPh26', 'PPh22', 'PPh15', 'PPh_FINAL', 'PPh4_2'].some((t) => i.tax_type?.includes(t)),
      )
      .reduce((s, i) => s + (i.amount || 0), 0);
    const ppnOutput = monthItems
      .filter((i) => i.tax_type?.includes('PPN'))
      .reduce((s, i) => s + (i.amount || 0), 0);
    const ppnInput = ppnOutput * 0.7; // approximation — backend aggregation TBD
    return { month: label, pph21, withholding, output: ppnOutput, input: ppnInput };
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 py-8 px-4">
      <div>
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">{t('kpiTotalTax')}</p>
            <p className="text-xl font-semibold">{fmtRp(totalTax)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5">
            <p className="text-xs text-red-600">{t('kpiUnpaid')}</p>
            <p className="text-xl font-semibold text-red-700">{fmtRp(unpaidTax)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">{t('kpiUpcoming')}</p>
            <p className="text-xl font-semibold">{t('countFilings', { count: upcomingCount })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <p className="font-semibold">{t('trendTitle')}</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">PPh 21</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="pph21" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{t('withholding')}</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="withholding" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{t('ppnSalesVsPurchase')}</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="output" stroke="#f59e0b" strokeWidth={2} />
                    <Line type="monotone" dataKey="input" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold mb-4">{t('companyInfo')}</p>
          <div className="text-sm space-y-1">
            <p>{t('companyName')}: {companyInfo?.company_name || session.fullName || '—'}</p>
            <p>NPWP: {companyInfo?.npwp || '—'}</p>
            <p>KBLI: {companyInfo?.kbli_code || '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
