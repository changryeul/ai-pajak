'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  Plus,
  Upload,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export default function DashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  // Mock data - replace with real data from API
  const stats = [
    {
      title: t('dashboard.totalDocuments'),
      value: '24',
      icon: FileText,
      change: '+3',
      changeType: 'positive' as const,
    },
    {
      title: t('dashboard.pendingSubmissions'),
      value: '5',
      icon: Clock,
      change: '2 urgent',
      changeType: 'warning' as const,
    },
    {
      title: t('dashboard.totalTaxPaid'),
      value: 'Rp 45.2M',
      icon: TrendingUp,
      change: '+12%',
      changeType: 'positive' as const,
    },
  ];

  const upcomingDeadlines = [
    { type: 'PPh 21', period: 'Desember 2024', dueDate: '10 Jan 2025', status: 'upcoming' },
    { type: 'PPN', period: 'Desember 2024', dueDate: '31 Jan 2025', status: 'upcoming' },
    { type: 'PPh 23', period: 'Desember 2024', dueDate: '10 Jan 2025', status: 'urgent' },
  ];

  const recentActivity = [
    { action: 'PPh 21 submitted', time: '2 hours ago' },
    { action: 'Document uploaded: Faktur_001.pdf', time: '5 hours ago' },
    { action: 'PPN calculation completed', time: '1 day ago' },
    { action: 'Profile updated', time: '2 days ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-500">
            {t('dashboard.welcome')}! Here&apos;s your tax overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/documents`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            {t('dashboard.uploadDocument')}
          </Link>
          <Link
            href={`/${locale}/tax/pph21`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.createNewDocument')}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        stat.changeType === 'positive'
                          ? 'text-green-600'
                          : stat.changeType === 'warning'
                          ? 'text-yellow-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {stat.change}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {t('dashboard.upcomingDeadlines')}
            </CardTitle>
            <Link
              href={`/${locale}/reports`}
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingDeadlines.map((deadline, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-4"
                >
                  <div className="flex items-center gap-4">
                    {deadline.status === 'urgent' ? (
                      <div className="rounded-full bg-red-100 p-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    ) : (
                      <div className="rounded-full bg-blue-100 p-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{deadline.type}</p>
                      <p className="text-sm text-gray-500">{deadline.period}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        deadline.status === 'urgent'
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {deadline.dueDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {t('dashboard.recentActivity')}
            </CardTitle>
            <Link
              href={`/${locale}/settings`}
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { href: '/tax/pph21', label: 'PPh 21', icon: '💰' },
              { href: '/tax/pph23', label: 'PPh 23', icon: '📋' },
              { href: '/tax/ppn', label: 'PPN', icon: '🧾' },
              { href: '/tax/spt-tahunan', label: 'SPT Tahunan', icon: '📊' },
            ].map((action) => (
              <Link
                key={action.href}
                href={`/${locale}${action.href}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{action.icon}</span>
                  <span className="font-medium text-gray-900">{action.label}</span>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
