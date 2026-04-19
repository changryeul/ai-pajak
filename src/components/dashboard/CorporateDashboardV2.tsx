'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Wallet, AlertTriangle, CalendarClock, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
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
  locale: localeProp,
}: {
  session: { customerId?: string; fullName?: string };
  locale: string;
}) {
  const t = useTranslations('corpDashboardV2');
  const tCta = useTranslations('personalDashV3');
  const params = useParams();
  const locale = localeProp || (params?.locale as string) || 'id';
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

  const safeQueueItems = Array.isArray(queueItems) ? queueItems : [];
  const currentYear = new Date().getFullYear();
  const thisYearItems = safeQueueItems.filter((i) => i.tax_period_year === currentYear);
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
    const monthItems = safeQueueItems.filter(
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

  const companyName = companyInfo?.company_name || session.fullName || '—';

  return (
    <div className="space-y-6">
      {/* Hero Header — emerald/teal for corporate (mirrors the register/company colorway) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-green-800 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-200 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            {t('title')}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{companyName}</h1>
          <p className="text-emerald-200 mt-2 text-sm">{t('subtitle')}</p>
          {companyInfo?.npwp && (
            <div className="mt-4 inline-flex items-center gap-2 text-xs bg-white/10 backdrop-blur border border-white/20 rounded-lg px-3 py-1.5">
              <span className="text-emerald-200">NPWP</span>
              <span className="font-mono">{companyInfo.npwp}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards — colored icon badges, gradient hints, rounded-2xl */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('kpiTotalTax')}</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 tracking-tight">{fmtRp(totalTax)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Wallet className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl border-0 shadow-sm overflow-hidden ${unpaidTax > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 ring-1 ring-red-200' : ''}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${unpaidTax > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  {t('kpiUnpaid')}
                </p>
                <p className={`text-2xl font-bold mt-2 tracking-tight ${unpaidTax > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  {fmtRp(unpaidTax)}
                </p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br ${unpaidTax > 0 ? 'from-red-500 to-rose-600' : 'from-slate-400 to-gray-500'}`}>
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('kpiUpcoming')}</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 tracking-tight">
                  {t('countFilings', { count: upcomingCount })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <CalendarClock className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-indigo-100 via-blue-50 to-sky-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{t('trendTitle')}</div>
              <div className="text-xs text-gray-500">{t('trendSubtitle')}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-sm font-semibold text-gray-800">PPh 21</p>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="pph21" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm font-semibold text-gray-800">{t('withholding')}</p>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="withholding" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-sm font-semibold text-gray-800">{t('ppnSalesVsPurchase')}</p>
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />{t('ppnOutput')}
                </span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />{t('ppnInput')}
                </span>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)} />
                    <Tooltip formatter={(value) => fmtRp(Number(value))} />
                    <Line type="monotone" dataKey="output" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="input" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info — compact grid */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-100 via-gray-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-600 to-gray-700 flex items-center justify-center shadow-sm">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{t('companyInfo')}</div>
              <div className="text-xs text-gray-500">{t('companyInfoSubtitle')}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">{t('companyName')}</dt>
              <dd className="font-medium text-gray-900 mt-1 truncate">{companyName}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">NPWP</dt>
              <dd className="font-mono text-gray-900 mt-1 truncate">{companyInfo?.npwp || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">KBLI</dt>
              <dd className="font-mono text-gray-900 mt-1 truncate">{companyInfo?.kbli_code || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">{t('industry')}</dt>
              <dd className="text-gray-900 mt-1 truncate">{companyInfo?.business_category || '—'}</dd>
            </div>
            {companyInfo?.annual_revenue ? (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">{t('annualRevenue')}</dt>
                <dd className="font-mono text-gray-900 mt-1">{fmtRp(companyInfo.annual_revenue)}</dd>
              </div>
            ) : null}
            {companyInfo?.is_pkp !== undefined ? (
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">PKP</dt>
                <dd className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${companyInfo.is_pkp ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {companyInfo.is_pkp ? t('pkpYes') : t('pkpNo')}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {/* AI analysis comment — mirrors PersonalDashboardV3 structure for tone */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CardContent className="p-5 space-y-2">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            {tCta('aiCommentTitle')}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>
              {t('aiTotalThisYear')}: <span className="font-semibold">{fmtRp(totalTax)}</span>
            </li>
            {unpaidTax > 0 && (
              <li className="text-red-600 font-medium">
                {t('aiUnpaidWarning', { amount: fmtRp(unpaidTax) })}
              </li>
            )}
            {upcomingCount > 0 && (
              <li>{t('aiUpcomingCount', { count: upcomingCount })}</li>
            )}
            {unpaidTax === 0 && upcomingCount === 0 && (
              <li className="text-emerald-700">{t('aiAllClear')}</li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* CTAs — mirror to personal dashboard */}
      <div className="flex gap-3">
        <Button asChild className="bg-gray-800 hover:bg-gray-900 text-white">
          <Link href={`/${locale}/tax/monthly-dashboard`}>{t('ctaMonthlyFiling')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/filings`}>{tCta('viewProgressCta')}</Link>
        </Button>
      </div>
    </div>
  );
}
