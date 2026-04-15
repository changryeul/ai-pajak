'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fmtRp } from '@/lib/utils';
import { useEffect, useState } from 'react';
import {
  FileText,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
  AlertCircle,
  Users,
  Sparkles,
  Lightbulb,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import {
  POAStatusWidget,
  FilingSummaryWidget,
  DeadlineCalendar,
  GettingStartedGuide,
  ComplianceScoreWidget,
} from '@/components/dashboard';
import { CurrentPlanWidget } from '@/components/dashboard/CurrentPlanWidget';
import { CustomPricingWidget } from '@/components/dashboard/CustomPricingWidget';

const NextStepsWizard = dynamic(() => import('@/components/dashboard/NextStepsWizard').then(m => ({ default: m.NextStepsWizard })), { ssr: false });
const SimpleMode = dynamic(() => import('@/components/dashboard/SimpleMode').then(m => ({ default: m.SimpleMode })), { ssr: false });

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
  const t = useTranslations();
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
            <h2 className="text-xl font-semibold mb-2">{t('dashboardHero.sessionRequired')}</h2>
            <p className="text-gray-600 mb-4">{t('dashboardHero.pleaseLogin')}</p>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('dashboardHero.logIn')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasRole(session, UserRole.PLATFORM_ADMIN)) {
    return <PlatformAdminDashboard session={session} locale={locale} />;
  }

  if (hasRole(
    session,
    UserRole.TAX_OPERATOR,
    UserRole.TAX_OPERATOR_LEAD,
    UserRole.TAX_OPERATOR_SUPERVISOR,
    UserRole.TAX_OPERATOR_MASTER,
  )) {
    // Redirect to the appropriate operator landing page.
    // Master goes straight to the master KPI dashboard; the other operator
    // tiers go to the per-operator queue dashboard.
    if (typeof window !== 'undefined') {
      const target =
        session.role === UserRole.TAX_OPERATOR_MASTER
          ? `/${locale}/admin/master`
          : `/${locale}/operator/dashboard`;
      window.location.href = target;
    }
    return <DashboardSkeleton />;
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

// LinkedIn-style Profile Completeness Banner
function ProfileCompletenessBanner({
  completeness,
  locale,
  companyInfo,
}: {
  completeness: number;
  locale: string;
  companyInfo: {
    npwp?: string; business_category?: string;
    annual_revenue?: number;
  };
}) {
  const tc = useTranslations('dashboardCompany');
  const isReady = completeness >= 80;

  // Next items to fill (LinkedIn-style recommendations)
  const nextItems: Array<{ label: string; boost: string }> = [];
  if (!companyInfo.npwp) nextItems.push({ label: tc('enterNpwp'), boost: '+14%' });
  if (!companyInfo.business_category) nextItems.push({ label: tc('selectBusinessType'), boost: '+14%' });
  if (!companyInfo.annual_revenue || companyInfo.annual_revenue <= 0) nextItems.push({ label: tc('enterRevenue'), boost: '+7%' });

  const gradient = isReady
    ? 'from-emerald-50 via-teal-50 to-cyan-50 border-emerald-200'
    : completeness >= 50
    ? 'from-amber-50 via-orange-50 to-yellow-50 border-amber-200'
    : 'from-red-50 via-rose-50 to-pink-50 border-red-200';
  const progressColor = isReady ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const ringColor = isReady ? '#10b981' : completeness >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`p-5 rounded-2xl border-2 bg-gradient-to-br ${gradient}`}>
      <div className="flex items-start gap-4">
        {/* Circular progress */}
        <div className="relative h-14 w-14 flex-shrink-0 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
            <circle cx="28" cy="28" r="24" fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeDasharray={`${(completeness / 100) * 150.8} 150.8`}
              strokeLinecap="round"
              className="transition-all duration-700" />
          </svg>
          <span className="text-sm font-bold text-gray-800">{completeness}%</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-sm text-gray-900">
                {isReady ? tc('profileAlmostDone') : tc('completeProfile')}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {isReady
                  ? tc('profileReadyHint')
                  : tc('profileNotReadyHint')}
              </p>
            </div>
            <Link
              href={`/${locale}/company-profile`}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors ${
                isReady ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {tc('completeProfileBtn')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/70 rounded-full overflow-hidden mt-3">
            <div className={`h-full ${progressColor} transition-all duration-700 ease-out`} style={{ width: `${completeness}%` }} />
          </div>

          {/* Next items — LinkedIn-style */}
          {nextItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextItems.map((item, i) => (
                <Link
                  key={i}
                  href={`/${locale}/company-profile`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 hover:bg-white border border-gray-200 rounded-full text-[11px] font-medium text-gray-700 hover:border-gray-300 transition-all"
                >
                  <span className="text-indigo-700 font-bold">{item.boost}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Customer Dashboard with Onboarding
function CustomerDashboardWithOnboarding({
  session,
  locale,
}: {
  session: { customerId?: string; customerType?: 'INDIVIDUAL' | 'COMPANY'; fullName?: string };
  locale: string;
}) {
  // OnboardingWizard intentionally removed — customers go straight to dashboard.
  // Signup collects basic info, and the GettingStartedGuide card on the dashboard
  // serves as a dismissible guided-tour replacement.
  // The `ai-pajak-onboarded` localStorage flag is auto-set for backward compatibility.
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ai-pajak-onboarded')) {
      localStorage.setItem('ai-pajak-onboarded', 'true');
    }
  }, []);

  // Ensure customer record + role exists (fallback for email-verified users)
  useEffect(() => {
    if (!session.customerId) {
      fetch('/api/auth/setup-account', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  }, [session.customerId]);

  // Branch by customer type — corporate customers focus on monthly filing
  if (session.customerType === 'COMPANY') {
    return <CorporateCustomerDashboard session={session} locale={locale} />;
  }
  return <CustomerDashboard session={session} locale={locale} />;
}

// Corporate Customer Dashboard — monthly filing focus
function CorporateCustomerDashboard({
  session,
  locale,
}: {
  session: { customerId?: string; fullName?: string };
  locale: string;
}) {
  const t = useTranslations();
  const [companyInfo, setCompanyInfo] = useState<{
    npwp?: string; business_category?: string; is_pkp?: boolean; is_umkm?: boolean;
    tax_regime?: string; profile_completeness?: number; annual_revenue?: number;
    has_employees?: boolean; pays_service_fees?: boolean; has_import_export?: boolean;
    has_rental_business?: boolean;
  } | null>(null);

  // Counterparty summary
  const [cpSummary, setCpSummary] = useState<{
    total: number; vendors: number; clients: number; foreign: number;
    expiringLicenses: number;
  }>({ total: 0, vendors: 0, clients: 0, foreign: 0, expiringLicenses: 0 });

  useEffect(() => {
    if (!session.customerId) return;
    fetch(`/api/company-profile?customerId=${session.customerId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setCompanyInfo(d.data); })
      .catch(() => {});

    // Load counterparty summary
    fetch('/api/counterparties')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const list = d.data || [];
          const now = Date.now();
          const sixtyDays = 60 * 24 * 60 * 60 * 1000;
          let expiring = 0;
          list.forEach((cp: { licenses?: Array<{ expires_at?: string }> }) => {
            if (Array.isArray(cp.licenses)) {
              cp.licenses.forEach(lic => {
                if (lic.expires_at) {
                  const exp = new Date(lic.expires_at).getTime();
                  if (exp > now && exp - now < sixtyDays) expiring++;
                }
              });
            }
          });
          setCpSummary({
            total: list.length,
            vendors: list.filter((c: { type?: string }) => c.type === 'VENDOR').length,
            clients: list.filter((c: { type?: string }) => c.type === 'CLIENT').length,
            foreign: list.filter((c: { is_foreign?: boolean }) => c.is_foreign).length,
            expiringLicenses: expiring,
          });
        }
      })
      .catch(() => {});

    // Load unpaid billings
    fetch('/api/customer/queue')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const all = d.data || [];
          setUnpaidBillings(all.filter((i: { status: string; ebilling_code?: string }) =>
            ['EBILLING_GENERATED', 'PAYMENT_PENDING'].includes(i.status) && i.ebilling_code
          ));
        }
      })
      .catch(() => {});
  }, [session.customerId]);

  const [unpaidBillings, setUnpaidBillings] = useState<Array<{
    id: string; tax_type: string; tax_period_month: number; tax_period_year: number;
    amount: number; ebilling_code: string; status: string;
  }>>([]);

  // Determine applicable taxes for display
  const applicableTaxes: string[] = [];
  if (companyInfo) {
    if (companyInfo.has_employees) applicableTaxes.push('PPh 21');
    if (companyInfo.is_pkp) applicableTaxes.push('PPN');
    if (companyInfo.pays_service_fees) applicableTaxes.push('PPh 23');
    if (companyInfo.has_import_export) applicableTaxes.push('PPh 22');
    if (companyInfo.has_rental_business) applicableTaxes.push('PPh 4(2)');
    if (companyInfo.is_umkm) applicableTaxes.push('PPh Final 0.5%');
    else applicableTaxes.push('PPh 25');
  }

  const profileReady = (companyInfo?.profile_completeness || 0) >= 80;

  return (
    <div className="space-y-6">
      {/* Current subscription plan widget */}
      <CurrentPlanWidget />

      {/* Custom pricing quote (only renders when there is something to act on) */}
      <CustomPricingWidget />

      {/* LinkedIn-style Profile Completeness Banner */}
      {companyInfo && (companyInfo.profile_completeness || 0) < 100 && (
        <ProfileCompletenessBanner
          completeness={companyInfo.profile_completeness || 0}
          locale={locale}
          companyInfo={companyInfo}
        />
      )}

      {/* Unpaid billing alert */}
      {unpaidBillings.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm text-red-900">
                {t('dashboardCompany.unpaidTaxAlert', { count: unpaidBillings.length })}
              </p>
              <div className="mt-2 space-y-1">
                {unpaidBillings.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs bg-white rounded p-2 border border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{b.tax_type}</span>
                      <span className="text-gray-500">{b.tax_period_year}-{String(b.tax_period_month).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-red-700">{fmtRp(b.amount)}</span>
                      <span className="font-mono text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{b.ebilling_code}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/${locale}/tax/billing`}
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-red-700 hover:underline">
                {t('dashboardCompany.goToBilling')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header — corporate theme (emerald/green) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <p className="text-emerald-200 text-sm font-medium flex items-center gap-2">
            🏢 {t('dashboard.companyDashboard')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{session.fullName || 'Company'}</h1>
          <p className="text-emerald-200 mt-2 text-sm">{t('dashboardHero.corporateSubtitle')}</p>

          {/* Company info summary in header */}
          {companyInfo && (
            <div className="mt-4 flex flex-wrap gap-2">
              {companyInfo.npwp && (
                <span className="bg-white/15 px-2 py-1 rounded text-[11px] font-mono">NPWP: {companyInfo.npwp}</span>
              )}
              {companyInfo.business_category && (
                <span className="bg-white/15 px-2 py-1 rounded text-[11px]">{companyInfo.business_category}</span>
              )}
              {applicableTaxes.map(tax => (
                <span key={tax} className="bg-white/20 px-2 py-1 rounded text-[11px] font-medium">{tax}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filing action cards — monthly vs annual */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${locale}/tax/monthly-dashboard`}
          className="group relative overflow-hidden rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 hover:shadow-lg hover:border-blue-400 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{t('dashboardCompany.monthlyFiling')}</p>
              <p className="text-xs text-gray-500 mt-0.5">PPh 21 · PPh 23 · PPN · PPh 4(2)</p>
            </div>
          </div>
          <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </Link>
        <Link
          href={`/${locale}/tax/spt-tahunan/1771`}
          className="group relative overflow-hidden rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 hover:shadow-lg hover:border-purple-400 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-sm">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{t('dashboardCompany.annualFiling')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('dashboardCompany.annualFilingDesc')}</p>
            </div>
          </div>
          <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Counterparty summary widget */}
      {cpSummary.total > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  {t('dashboardCompany.counterparties', { count: cpSummary.total })}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{t('dashboardCompany.vendors', { count: cpSummary.vendors })}</span>
                  <span>·</span>
                  <span>{t('dashboardCompany.clients', { count: cpSummary.clients })}</span>
                  {cpSummary.foreign > 0 && <><span>·</span><span>{t('dashboardCompany.foreign', { count: cpSummary.foreign })}</span></>}
                </div>
                {cpSummary.expiringLicenses > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {t('dashboardCompany.expiringLicenses', { count: cpSummary.expiringLicenses })}
                  </p>
                )}
              </div>
              <Link href={`/${locale}/counterparties`}
                className="px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50">
                {t('dashboardCompany.details')}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick access */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/tax/monthly-dashboard', icon: BarChart3, label: t('dashboardCompany.quickMonthly'), desc: t('dashboardCompany.quickMonthlyDesc'), gradient: 'from-blue-500 to-cyan-500' },
          { href: '/tax/pph21', icon: Users, label: t('dashboardCompany.quickPph21'), desc: t('dashboardCompany.quickPph21Desc'), gradient: 'from-amber-500 to-orange-500' },
          { href: '/tax/spt-tahunan/1771', icon: FileSpreadsheet, label: t('dashboardCompany.quickAnnual'), desc: t('dashboardCompany.quickAnnualDesc'), gradient: 'from-purple-500 to-pink-500' },
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

      {/* Filing Summary + Deadlines */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FilingSummaryWidget customerId={session.customerId} />
        <DeadlineCalendar customerId={session.customerId} />
      </div>

      {/* Compliance + Charts */}
      <ComplianceScoreWidget />
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxSummaryChart customerId={session.customerId} />
        <FilingStatusChart customerId={session.customerId} />
      </div>
    </div>
  );
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
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-medium">
            {t('dashboard.welcome')} 👋
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            {session.fullName || 'Customer'}
          </h1>
          <p className="text-blue-200 mt-2 text-sm">
            {t('dashboardHero.customerSubtitle')}
          </p>
        </div>
      </div>

      {/* Filing Summary — moved to top */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FilingSummaryWidget customerId={session.customerId} />
        <DeadlineCalendar customerId={session.customerId} />
      </div>

      {/* Custom pricing quote (only renders when there is something to act on) */}
      <CustomPricingWidget />

      {/* Getting Started Guide */}
      <GettingStartedGuide customerId={session.customerId} userName={session.fullName} />

      {/* Compliance Score */}
      <ComplianceScoreWidget />

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxSummaryChart customerId={session.customerId} />
        <FilingStatusChart customerId={session.customerId} />
      </div>
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
    { label: t('dashboard.activeClients'), value: stats?.activeClients ?? 0, icon: Users, gradient: 'from-blue-500 to-blue-600', change: t('dashboardHero.thisMonth') },
    { label: t('dashboard.pendingFilings'), value: stats?.pendingFilings ?? 0, icon: Clock, gradient: 'from-amber-500 to-orange-500', change: t('dashboardHero.needAction') },
    { label: t('dashboard.submittedThisMonth'), value: stats?.submittedThisMonth ?? 0, icon: TrendingUp, gradient: 'from-green-500 to-emerald-600', change: t('dashboardHero.thisMonth') },
    { label: t('dashboard.poasPending'), value: stats?.pendingPOAs ?? 0, icon: FileText, gradient: 'from-purple-500 to-violet-600', change: t('dashboardHero.waiting') },
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
              {t('dashboardHero.consultantSubtitle')}
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
          { href: '/tax/spt-tahunan', icon: FileSpreadsheet, label: t('dashboardHero.sptAutofill'), desc: t('dashboardHero.sptAutofillDesc'), gradient: 'from-blue-500 to-cyan-500' },
          { href: '/tax/savings', icon: Lightbulb, label: t('dashboardHero.taxSavings'), desc: t('dashboardHero.analysisDesc'), gradient: 'from-amber-500 to-orange-500' },
          { href: '/tax/report', icon: BarChart3, label: t('dashboardHero.aiReport'), desc: t('dashboardHero.aiReportDesc'), gradient: 'from-purple-500 to-pink-500' },
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
              {t('dashboardHero.adminMode')}
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
