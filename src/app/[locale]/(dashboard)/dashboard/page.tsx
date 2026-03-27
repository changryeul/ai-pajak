'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  FileText,
  Clock,
  TrendingUp,
  Plus,
  Upload,
  ArrowRight,
  AlertCircle,
  Users,
  Sparkles,
  Lightbulb,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import {
  POAStatusWidget,
  FilingSummaryWidget,
  DeadlineCalendar,
  GettingStartedGuide,
  ComplianceScoreWidget,
} from '@/components/dashboard';

// Lazy load heavy components
const ClientList = dynamic(() => import('@/components/dashboard/ClientList').then(m => ({ default: m.ClientList })), { ssr: false });
const UrgentActionsPanel = dynamic(() => import('@/components/dashboard/UrgentActionsPanel').then(m => ({ default: m.UrgentActionsPanel })), { ssr: false });
const PlatformStats = dynamic(() => import('@/components/dashboard/PlatformStats').then(m => ({ default: m.PlatformStats })), { ssr: false });
const TaxSummaryChart = dynamic(() => import('@/components/dashboard/TaxSummaryChart').then(m => ({ default: m.TaxSummaryChart })), { ssr: false });
const FilingStatusChart = dynamic(() => import('@/components/dashboard/FilingStatusChart').then(m => ({ default: m.FilingStatusChart })), { ssr: false });

interface ConsultantStats {
  activeClients: number;
  pendingFilings: number;
  submittedThisMonth: number;
  pendingPOAs: number;
}

export default function DashboardPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

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

  if (hasRole(session, UserRole.PLATFORM_ADMIN)) {
    return <PlatformAdminDashboard session={session} locale={locale} />;
  }

  if (hasRole(session, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)) {
    return (
      <ConsultantDashboard
        session={session}
        locale={locale}
        isTaxAdvisor={session.role === UserRole.TAX_ADVISOR_JTC}
      />
    );
  }

  return <CustomerDashboardWithOnboarding session={session} locale={locale} />;
}

// Customer Dashboard with Onboarding
function CustomerDashboardWithOnboarding({
  session,
  locale,
}: {
  session: { customerId?: string; fullName?: string };
  locale: string;
}) {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('ai-pajak-onboarded');
  });

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return <CustomerDashboard session={session} locale={locale} />;
}

// Customer Dashboard
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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">
              {t('dashboard.welcome')} 👋
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              {session.fullName || 'Customer'}
            </h1>
            <p className="text-blue-200 mt-2 text-sm">
              Kelola pajak Anda dengan mudah bersama AI Pajak
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <Link
              href={`/${locale}/documents`}
              className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-all"
            >
              <Upload className="h-4 w-4" />
              Upload Dokumen
            </Link>
            <Link
              href={`/${locale}/tax/spt-tahunan`}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20"
            >
              <Plus className="h-4 w-4" />
              Buat SPT
            </Link>
          </div>
        </div>
      </div>

      {/* AI Features Quick Access */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: '/tax/spt-tahunan/1770ss',
            icon: FileSpreadsheet,
            label: 'SPT Auto-fill',
            desc: 'Upload & otomatis isi SPT',
            gradient: 'from-blue-500 to-cyan-500',
            bg: 'bg-blue-50',
          },
          {
            href: '/tax/savings',
            icon: Lightbulb,
            label: 'Hemat Pajak',
            desc: 'Temukan peluang penghematan',
            gradient: 'from-amber-500 to-orange-500',
            bg: 'bg-amber-50',
          },
          {
            href: '/documents',
            icon: Sparkles,
            label: 'AI Klasifikasi',
            desc: 'Upload & otomatis deteksi',
            gradient: 'from-purple-500 to-pink-500',
            bg: 'bg-purple-50',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Getting Started Guide */}
      <GettingStartedGuide customerId={session.customerId} userName={session.fullName} />

      {/* POA Status */}
      <POAStatusWidget customerId={session.customerId} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FilingSummaryWidget customerId={session.customerId} />
        <DeadlineCalendar customerId={session.customerId} />
      </div>

      {/* Compliance Score */}
      <ComplianceScoreWidget />

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxSummaryChart customerId={session.customerId} />
        <FilingStatusChart customerId={session.customerId} />
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-gray-50 to-white">
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/tax/spt-tahunan', labelKey: 'quickAction.annualReturn', descKey: 'quickAction.annualReturnDesc', icon: TrendingUp, gradient: 'from-blue-500 to-blue-600' },
              { href: '/tax/pph21', labelKey: 'quickAction.salaryTax', descKey: 'quickAction.salaryTaxDesc', icon: Users, gradient: 'from-green-500 to-emerald-600' },
              { href: '/documents', labelKey: 'quickAction.uploadDoc', descKey: 'quickAction.uploadDocDesc', icon: Upload, gradient: 'from-purple-500 to-violet-600' },
              { href: '/poa/create', labelKey: 'quickAction.createPoa', descKey: 'quickAction.createPoaDesc', icon: FileText, gradient: 'from-orange-500 to-red-500' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={`/${locale}${action.href}`}
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-transparent hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.gradient} shadow-sm group-hover:shadow-md transition-shadow`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 text-sm">{t(action.labelKey)}</span>
                    <p className="text-xs text-gray-500 truncate">{t(action.descKey)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Consultant Dashboard
function ConsultantDashboard({
  session,
  locale,
  isTaxAdvisor,
}: {
  session: { consultantId?: string; fullName?: string };
  locale: string;
  isTaxAdvisor: boolean;
}) {
  const t = useTranslations();
  const [stats, setStats] = useState<ConsultantStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats');
        const result = await response.json();
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    { label: t('dashboard.activeClients'), value: stats?.activeClients ?? 0, icon: Users, gradient: 'from-blue-500 to-blue-600', change: '+2 bulan ini' },
    { label: t('dashboard.pendingFilings'), value: stats?.pendingFilings ?? 0, icon: Clock, gradient: 'from-amber-500 to-orange-500', change: 'perlu tindakan' },
    { label: t('dashboard.submittedThisMonth'), value: stats?.submittedThisMonth ?? 0, icon: TrendingUp, gradient: 'from-green-500 to-emerald-600', change: 'bulan ini' },
    { label: t('dashboard.poasPending'), value: stats?.pendingPOAs ?? 0, icon: FileText, gradient: 'from-purple-500 to-violet-600', change: 'menunggu' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-96 h-32 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full translate-y-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">
              {isTaxAdvisor ? t('dashboard.advisorDashboard') : t('dashboard.consultantDashboard')}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              {t('dashboard.welcomeBack', { name: session.fullName || 'Consultant' })}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Kelola klien dan laporan pajak Anda
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <Link
              href={`/${locale}/customers`}
              className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-all"
            >
              {t('dashboard.viewAllClients')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {isTaxAdvisor && (
              <Link
                href={`/${locale}/tax/new`}
                className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="h-4 w-4" />
                {t('dashboard.bulkFiling')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="group border-0 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {isLoadingStats ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse" />
                      ) : stat.value}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Tools Quick Access */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/tax/spt-tahunan', icon: FileSpreadsheet, label: 'SPT Auto-fill', desc: 'Upload & otomatis isi', gradient: 'from-blue-500 to-cyan-500' },
          { href: '/tax/savings', icon: Lightbulb, label: 'Analisis Penghematan', desc: 'Temukan peluang klien', gradient: 'from-amber-500 to-orange-500' },
          { href: '/tax/report', icon: BarChart3, label: 'Laporan AI', desc: 'Generate laporan klien', gradient: 'from-purple-500 to-pink-500' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    {item.label}
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                  </p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Urgent Actions */}
      <UrgentActionsPanel consultantId={session.consultantId} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientList consultantId={session.consultantId} limit={8} />
        <DeadlineCalendar consultantId={session.consultantId} showAll />
      </div>
    </div>
  );
}

// Platform Admin Dashboard
function PlatformAdminDashboard({
  session,
  locale,
}: {
  session: { fullName?: string };
  locale: string;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-orange-200 text-sm font-medium">{t('dashboard.adminDashboard')}</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              {t('dashboard.welcomeBack', { name: session.fullName || 'Admin' })}
            </h1>
            <p className="text-orange-200 mt-2 text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Platform Administration Mode
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <Link
              href={`/${locale}/admin/monitoring`}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50 transition-all shadow-lg"
            >
              {t('dashboard.viewAnalytics')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <PlatformStats />
    </div>
  );
}
