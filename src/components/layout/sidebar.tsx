'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Calculator,
  Upload,
  BarChart3,
  Settings,
  CreditCard,
  Users,
  Receipt,
  FileSpreadsheet,
  LogOut,
  FileText,
  Shield,
  Activity,
  ClipboardList,
  Lightbulb,
  X,
  Headphones,
  ListChecks,
  Calendar,
  CheckCircle,
  TrendingUp,
  MessageSquareWarning,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { useMobileSidebar } from './mobile-sidebar';

interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  descKey?: string; // Short description
  roles?: UserRole[]; // undefined = all roles
}

interface NavSection {
  section: string;
  labelKey?: string;
  roles?: UserRole[]; // undefined = all roles
  items: NavItem[];
}

const taxRoles = [UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];
const consultantRoles = [UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];
const operatorRoles = [UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR];
const supervisorRoles = [UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR];

const navItems: NavSection[] = [
  {
    section: 'main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', descKey: 'navDesc.dashboard' },
      { href: '/customers', icon: Users, labelKey: 'nav.customers', descKey: 'navDesc.customers', roles: consultantRoles },
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.filings', descKey: 'navDesc.filings', roles: taxRoles },
      { href: '/documents', icon: Upload, labelKey: 'nav.documents', descKey: 'navDesc.documents', roles: taxRoles },
      { href: '/submissions', icon: ListChecks, labelKey: 'nav.submissions', descKey: 'navDesc.submissions', roles: [UserRole.CUSTOMER] },
      { href: '/invoice-capture', icon: Receipt, labelKey: 'nav.invoiceCapture', descKey: 'navDesc.invoiceCapture', roles: [UserRole.CUSTOMER] },
      { href: '/tax/monthly-report', icon: Sparkles, labelKey: 'nav.monthlyReport', descKey: 'navDesc.monthlyReport', roles: [UserRole.CUSTOMER] },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports', descKey: 'navDesc.reports', roles: [UserRole.CUSTOMER] },
      { href: '/tax/payments', icon: Receipt, labelKey: 'nav.paymentStatus', descKey: 'navDesc.paymentStatus', roles: [UserRole.CUSTOMER] },
      { href: '/tax/monthly-payments', icon: CreditCard, labelKey: 'nav.monthlyPayments', descKey: 'navDesc.monthlyPayments', roles: taxRoles },
      { href: '/tax/calendar', icon: ClipboardList, labelKey: 'nav.taxCalendar', descKey: 'navDesc.taxCalendar', roles: taxRoles },
      { href: '/tax/tools', icon: Calculator, labelKey: 'nav.taxTools', descKey: 'navDesc.taxTools', roles: taxRoles },
    ],
  },
  {
    section: 'tax',
    labelKey: 'nav.taxFiling',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'nav.annualReturn', descKey: 'navDesc.annualReturn' },
      { href: '/tax/savings', icon: Lightbulb, labelKey: 'nav.taxSavings', descKey: 'navDesc.taxSavings' },
      { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21', descKey: 'navDesc.pph21' },
      { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.pph23', descKey: 'navDesc.pph23' },
      { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppn', descKey: 'navDesc.ppn' },
      { href: '/tax/efaktur-verify', icon: Shield, labelKey: 'nav.efakturVerify', descKey: 'navDesc.efakturVerify' },
      { href: '/tax/umkm', icon: Receipt, labelKey: 'nav.umkm', descKey: 'navDesc.umkm' },
      { href: '/chat', icon: Sparkles, labelKey: 'nav.aiChat', descKey: 'navDesc.aiChat' },
    ],
  },
  {
    section: 'consultant-tax',
    labelKey: 'nav.taxManagement',
    roles: consultantRoles,
    items: [
      { href: '/tax/monthly-dashboard', icon: BarChart3, labelKey: 'nav.monthlyDashboard', descKey: 'navDesc.monthlyDashboard' },
      { href: '/tax/new', icon: FileText, labelKey: 'nav.newFiling', descKey: 'navDesc.newFiling' },
      { href: '/tax/spt-masa', icon: Receipt, labelKey: 'nav.sptMasa', descKey: 'navDesc.sptMasa' },
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'nav.annualReturn', descKey: 'navDesc.annualReturn' },
      { href: '/tax/annual-simulation', icon: TrendingUp, labelKey: 'nav.annualSimulation', descKey: 'navDesc.annualSimulation' },
      { href: '/tax/pph21-bulk', icon: Calculator, labelKey: 'nav.pph21Bulk', descKey: 'navDesc.pph21Bulk' },
      { href: '/tax/savings', icon: Lightbulb, labelKey: 'nav.taxSavings', descKey: 'navDesc.taxSavings' },
      { href: '/tax/anomaly', icon: Activity, labelKey: 'nav.anomalyDetection', descKey: 'navDesc.anomalyDetection' },
      { href: '/tax/audit-simulation', icon: Shield, labelKey: 'nav.auditSimulation', descKey: 'navDesc.auditSimulation' },
      { href: '/tax/optimizer', icon: Sparkles, labelKey: 'nav.taxOptimizer', descKey: 'navDesc.taxOptimizer' },
      { href: '/tax/transfer-pricing', icon: Receipt, labelKey: 'nav.transferPricing', descKey: 'navDesc.transferPricing' },
      { href: '/tax/multi-entity', icon: Settings, labelKey: 'nav.multiEntity', descKey: 'navDesc.multiEntity' },
      { href: '/tax/report', icon: BarChart3, labelKey: 'nav.clientReport', descKey: 'navDesc.clientReport' },
    ],
  },
  {
    section: 'poa',
    labelKey: 'nav.poaSection',
    roles: taxRoles,
    items: [
      { href: '/poa/create', icon: Shield, labelKey: 'nav.createPoa', roles: [UserRole.CUSTOMER] },
    ],
  },
  {
    section: 'operator',
    labelKey: 'nav.operatorSection',
    roles: operatorRoles,
    items: [
      { href: '/operator/dashboard', icon: Headphones, labelKey: 'nav.operatorDashboard', descKey: 'navDesc.operatorDashboard' },
      { href: '/operator/queue', icon: ListChecks, labelKey: 'nav.submissionQueue', descKey: 'navDesc.submissionQueue' },
      { href: '/operator/approvals', icon: CheckCircle, labelKey: 'nav.approvals', descKey: 'navDesc.approvals', roles: supervisorRoles },
      { href: '/operator/workload', icon: BarChart3, labelKey: 'nav.workloadManagement', descKey: 'navDesc.workloadManagement', roles: supervisorRoles },
      { href: '/operator/statistics', icon: TrendingUp, labelKey: 'nav.operatorStatistics', descKey: 'navDesc.operatorStatistics', roles: supervisorRoles },
      { href: '/operator/complaints', icon: MessageSquareWarning, labelKey: 'nav.complaints', descKey: 'navDesc.complaints', roles: supervisorRoles },
      { href: '/operator/approval-rules', icon: Settings, labelKey: 'nav.approvalRules', descKey: 'navDesc.approvalRules', roles: supervisorRoles },
      { href: '/operator/clients', icon: Users, labelKey: 'nav.assignedClients', descKey: 'navDesc.assignedClients' },
      { href: '/tax/calendar', icon: Calendar, labelKey: 'nav.taxCalendar', descKey: 'navDesc.taxCalendar' },
    ],
  },
  {
    section: 'admin',
    labelKey: 'nav.administration',
    roles: [UserRole.PLATFORM_ADMIN],
    items: [
      { href: '/admin/monitoring', icon: Activity, labelKey: 'nav.monitoring' },
      { href: '/admin/users', icon: Users, labelKey: 'nav.userManagement' },
      { href: '/admin/billing', icon: CreditCard, labelKey: 'nav.billingAdmin' },
      { href: '/admin/consultants', icon: ClipboardList, labelKey: 'nav.consultantAdmin' },
      { href: '/admin/ai-usage', icon: Lightbulb, labelKey: 'nav.aiUsage' },
      { href: '/admin/audit-logs', icon: Shield, labelKey: 'nav.auditLogs' },
      { href: '/admin/tax-rates', icon: Settings, labelKey: 'nav.taxRates' },
      { href: '/admin/override-rules', icon: Shield, labelKey: 'nav.overrideRules' },
      { href: '/admin/rule-test', icon: Activity, labelKey: 'nav.ruleTest' },
    ],
  },
  {
    section: 'account',
    labelKey: 'nav.account',
    items: [
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.CUSTOMER, UserRole.PLATFORM_ADMIN] },
      { href: '/settings/integrations', icon: Activity, labelKey: 'nav.integrations', descKey: 'navDesc.integrations', roles: [...consultantRoles, UserRole.CUSTOMER] },
      { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
      { href: '/help', icon: Lightbulb, labelKey: 'nav.help' },
    ],
  },
];

export function Sidebar() {
  const t = useTranslations();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { session, switchRole } = useSession();
  const { isOpen, close } = useMobileSidebar();
  const locale = params.locale as string;
  const userRole = session?.role;
  const availableRoles = session?.availableRoles;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  // Filter sections and items by role
  const visibleSections = navItems
    .filter((section) => {
      if (!section.roles) return true;
      return userRole && section.roles.includes(userRole);
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles) return true;
        return userRole && item.roles.includes(userRole);
      }),
    }))
    .filter((section) => section.items.length > 0);

  // AI-powered menu items
  const aiMenuPaths = ['/tax/savings', '/tax/report', '/tax/spt-tahunan/1770ss'];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-2.5" onClick={close}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <span className="text-sm font-bold text-white">AI</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">PAJAK</span>
        </Link>
        <button onClick={close} className="lg:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role badge with switcher */}
      {userRole && (
        <div className="px-6 pb-4">
          <div className={cn(
            'inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium',
            userRole === UserRole.CUSTOMER && 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200',
            userRole === UserRole.CONSULTANT_JTC && 'bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 border border-green-200',
            userRole === UserRole.TAX_ADVISOR_JTC && 'bg-gradient-to-r from-purple-50 to-violet-100 text-purple-700 border border-purple-200',
            userRole === UserRole.PLATFORM_ADMIN && 'bg-gradient-to-r from-orange-50 to-amber-100 text-orange-700 border border-orange-200',
            (userRole === UserRole.TAX_OPERATOR || userRole === UserRole.TAX_OPERATOR_LEAD || userRole === UserRole.TAX_OPERATOR_SUPERVISOR) && 'bg-gradient-to-r from-teal-50 to-cyan-100 text-teal-700 border border-teal-200',
          )}>
            {t(`nav.role.${userRole}`)}
          </div>
          {/* Role switcher - shown when user has multiple roles */}
          {availableRoles && availableRoles.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {availableRoles.filter(r => r !== userRole).map(role => (
                <button
                  key={role}
                  onClick={() => { switchRole(role); router.push(`/${locale}/dashboard`); }}
                  className="text-[10px] px-2 py-1 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all"
                >
                  {t(`nav.role.${role}`)}로 전환
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mx-6 border-t border-gray-100 dark:border-gray-800" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.section} className="mb-5">
            {section.labelKey && (
              <h3 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {t(section.labelKey)}
              </h3>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const fullHref = `/${locale}${item.href}`;
                const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
                const Icon = item.icon;
                const isAI = aiMenuPaths.some((p) => item.href.includes(p));

                return (
                  <li key={item.href}>
                    <Link
                      href={fullHref}
                      onClick={close}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900'
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px]', isActive && 'text-white')} />
                      <span className="flex-1">
                        <span>{t(item.labelKey)}</span>
                        {item.descKey && !isActive && (
                          <span className="block text-[10px] font-normal opacity-60 leading-tight mt-0.5">{t(item.descKey)}</span>
                        )}
                      </span>
                      {isAI && !isActive && (
                        <span className="flex h-5 items-center rounded-md bg-gradient-to-r from-amber-100 to-yellow-100 px-1.5 text-[10px] font-bold text-amber-700">
                          AI
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3">
        {session?.fullName && (
          <div className="px-3 pb-2">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-200 truncate">{session.fullName}</p>
            <p className="text-[10px] text-gray-400 truncate">{session.email || ''}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200/80 bg-white dark:bg-gray-900 dark:border-gray-800 hidden lg:block shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={close}
          />
          <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 lg:hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
