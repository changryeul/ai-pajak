'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Clock,
  TrendingUp,
  Plus,
  Upload,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import {
  POAStatusWidget,
  FilingSummaryWidget,
  DeadlineCalendar,
  ClientList,
  UrgentActionsPanel,
  PlatformStats,
} from '@/components/dashboard';

/**
 * Role-Based Dashboard Page
 *
 * Renders different dashboard views based on user role:
 * - CUSTOMER: POA status, filing summary, deadlines, quick actions
 * - CONSULTANT_JTC: Client list, urgent actions, deadlines
 * - TAX_ADVISOR_JTC: Client list, urgent actions, filing capabilities
 * - PLATFORM_ADMIN: Platform stats (NO tax data access)
 */

export default function DashboardPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { session, isLoading } = useSession();

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Session Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access your dashboard.</p>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Log In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Platform Admin Dashboard
  if (hasRole(session, UserRole.PLATFORM_ADMIN)) {
    return <PlatformAdminDashboard session={session} locale={locale} />;
  }

  // Consultant/Tax Advisor Dashboard
  if (hasRole(session, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)) {
    return (
      <ConsultantDashboard
        session={session}
        locale={locale}
        isTaxAdvisor={session.role === UserRole.TAX_ADVISOR_JTC}
      />
    );
  }

  // Customer Dashboard (default)
  return <CustomerDashboard session={session} locale={locale} />;
}

// Customer Dashboard Component
function CustomerDashboard({
  session,
  locale,
}: {
  session: { customerId?: string; fullName?: string };
  locale: string;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-500">
            {t('dashboard.welcome')}, {session.fullName || 'Customer'}!
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
            href={`/${locale}/tax/new`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.createNewDocument')}
          </Link>
        </div>
      </div>

      {/* POA Status (Critical for customers) */}
      <POAStatusWidget customerId={session.customerId} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Filing Summary */}
        <FilingSummaryWidget customerId={session.customerId} />

        {/* Deadlines */}
        <DeadlineCalendar customerId={session.customerId} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { href: '/tax/pph21', label: 'PPh 21', icon: FileText, desc: 'Employee tax' },
              { href: '/tax/pph23', label: 'PPh 23', icon: FileText, desc: 'Service tax' },
              { href: '/tax/ppn', label: 'PPN', icon: FileText, desc: 'VAT' },
              { href: '/tax/spt-tahunan', label: 'SPT Tahunan', icon: TrendingUp, desc: 'Annual return' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={`/${locale}${action.href}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{action.label}</span>
                      <p className="text-xs text-gray-500">{action.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Consultant/Tax Advisor Dashboard Component
function ConsultantDashboard({
  session,
  locale,
  isTaxAdvisor,
}: {
  session: { consultantId?: string; fullName?: string };
  locale: string;
  isTaxAdvisor: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isTaxAdvisor ? 'Tax Advisor Dashboard' : 'Consultant Dashboard'}
          </h1>
          <p className="text-gray-500">
            Welcome back, {session.fullName || 'Consultant'}!
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/consultant/clients`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View All Clients
            <ArrowRight className="h-4 w-4" />
          </Link>
          {isTaxAdvisor && (
            <Link
              href={`/${locale}/consultant/bulk-actions`}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Bulk Filing
            </Link>
          )}
        </div>
      </div>

      {/* Urgent Actions (Priority) */}
      <UrgentActionsPanel consultantId={session.consultantId} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Client List */}
        <ClientList consultantId={session.consultantId} limit={8} />

        {/* Deadlines */}
        <DeadlineCalendar consultantId={session.consultantId} showAll />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Clients</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Filings</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Submitted This Month</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">POAs Pending</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Platform Admin Dashboard Component
function PlatformAdminDashboard({
  session,
  locale,
}: {
  session: { fullName?: string };
  locale: string;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Administration
          </h1>
          <p className="text-gray-500">
            Welcome, {session.fullName || 'Admin'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/admin/users`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Manage Users
          </Link>
          <Link
            href={`/${locale}/admin/analytics`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Analytics
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Platform Stats (Anonymized) */}
      <PlatformStats />
    </div>
  );
}
