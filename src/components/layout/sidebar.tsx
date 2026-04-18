'use client';

import { useState } from 'react';
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
  BookOpen,
  Building2,
  Camera,
  Store,
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
  ChevronDown,
  User,
  Bell,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { useMobileSidebar } from './mobile-sidebar';

type CustomerType = 'INDIVIDUAL' | 'COMPANY';

interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  descKey?: string;
  roles?: UserRole[];
  customerTypes?: CustomerType[]; // Filter by customer type (INDIVIDUAL/COMPANY)
  children?: NavItem[];
}

interface NavSection {
  section: string;
  labelKey?: string;
  roles?: UserRole[];
  items: NavItem[];
}

const taxRoles = [UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];
const consultantRoles = [UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];
// 3-tier operator hierarchy (Phase K-1):
//   TAX_OPERATOR             - 상담원
//   TAX_OPERATOR_SUPERVISOR  - 수퍼바이저 (approvals, queue distribution)
//   TAX_OPERATOR_MASTER      - 마스터 (platform-wide stats, custom pricing)
// TAX_OPERATOR_LEAD kept in operatorRoles for legacy users but should not be assigned to new users.
const operatorRoles = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];
const supervisorRoles = [
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];
const masterRoles = [UserRole.TAX_OPERATOR_MASTER];

const navItems: NavSection[] = [
  {
    section: 'main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    ],
  },
  // ── COMPANY 고객: 월신고 섹션 ──
  {
    section: 'company-monthly',
    labelKey: 'nav.monthlyFiling',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/filing-status', icon: BarChart3, labelKey: 'nav.filingStatus', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21Label', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.withholdingTaxLabel', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/umkm', icon: Shield, labelKey: 'nav.prepaidCorporateTax', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppnLabel', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/billing', icon: CreditCard, labelKey: 'nav.idBillingIssue', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
    ],
  },
  // ── COMPANY 고객: 연신고 섹션 ──
  {
    section: 'company-annual',
    labelKey: 'nav.annualFiling',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/annual', icon: FileSpreadsheet, labelKey: 'nav.closingWork', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/annual/journals', icon: BookOpen, labelKey: 'nav.journals', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/annual/financial-statements', icon: BookOpen, labelKey: 'nav.financialStatements', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/ebupot', icon: FileText, labelKey: 'nav.ebupotIssue', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
    ],
  },
  // ── COMPANY 고객: 신고관리 섹션 ──
  {
    section: 'company-management',
    labelKey: 'nav.filingManagement',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.taxHistory', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.taxReport', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/counterparties', icon: Users, labelKey: 'nav.counterpartyInput', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
    ],
  },
  // ── COMPANY 고객: 세금도구 섹션 ──
  {
    section: 'company-tools',
    labelKey: 'nav.taxTools',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/calendar', icon: Calendar, labelKey: 'nav.taxCalendar', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/news', icon: Newspaper, labelKey: 'nav.taxNews', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/tools', icon: Calculator, labelKey: 'nav.taxCalculator', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/anomaly', icon: Activity, labelKey: 'nav.anomalyDetection', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/tax/transfer-pricing', icon: Receipt, labelKey: 'nav.transferPricing', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
    ],
  },
  // ── 개인 고객: 최소 네비게이션 (2026-04-18 hybrid 재배치) ──
  // 대시보드(상단)에 3년 이력/자산/부채/PTKP/해외자산 모두 표시하므로
  // 사이드바는 실제로 따로 화면 전환이 필요한 항목만 남김.
  //   - 연신고    : SPT 1770/1770S/1770SS 작성 진입점
  //   - 빌링      : 건당 결제 / 결제 대기 / 이력
  //   - 자료 업로드: 1721-A1 / KK OCR 업로드
  //   - 보고서    : 5년 신고·납부 리포트
  {
    section: 'individual-main',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '#', icon: FileSpreadsheet, labelKey: 'nav.annualFiling', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'], children: [
        { href: '/tax/spt-tahunan', icon: FileText, labelKey: 'nav.sptPribadi' },
      ]},
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/documents/upload', icon: Upload, labelKey: 'nav.docUpload', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
    ],
  },
  // ── 세무 컨설턴트: 월신고 (기존 구조 유지) ──
  {
    section: 'consultant-main',
    roles: consultantRoles,
    items: [
      { href: '/news', icon: ClipboardList, labelKey: 'nav.taxNews' },
      { href: '#', icon: Receipt, labelKey: 'nav.monthlyFiling', children: [
        { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21Label' },
        { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.withholdingTaxLabel' },
        { href: '/tax/umkm', icon: Shield, labelKey: 'nav.prepaidCorporateTax' },
        { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppnLabel' },
        { href: '/tax/billing', icon: CreditCard, labelKey: 'nav.taxBilling' },
      ]},
      { href: '#', icon: FileSpreadsheet, labelKey: 'nav.annualFiling', children: [
        { href: '/tax/annual', icon: FileSpreadsheet, labelKey: 'nav.annualSettlement' },
        { href: '/tax/annual/journals', icon: BookOpen, labelKey: 'nav.journals' },
        { href: '/tax/annual/financial-statements', icon: BookOpen, labelKey: 'nav.financialStatements' },
        { href: '/tax/spt-tahunan', icon: FileText, labelKey: 'nav.sptPribadi' },
      ]},
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.filings' },
      { href: '/invoice-capture', icon: Camera, labelKey: 'nav.invoiceCapture' },
      { href: '/documents/upload', icon: Upload, labelKey: 'nav.docUpload' },
      { href: '/documents', icon: Upload, labelKey: 'nav.documents' },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
      { href: '/tax/calendar', icon: Calendar, labelKey: 'nav.taxCalendar' },
      { href: '/tax/tools', icon: Calculator, labelKey: 'nav.taxTools' },
    ],
  },
  {
    section: 'consultant-tax',
    labelKey: 'nav.taxManagement',
    roles: consultantRoles,
    items: [
      { href: '/customers', icon: Users, labelKey: 'nav.customers' },
      { href: '/tax/monthly-dashboard', icon: BarChart3, labelKey: 'nav.monthlyDashboard' },
      { href: '/tax/spt-masa', icon: Receipt, labelKey: 'nav.sptMasa' },
      { href: '/tax/pph21-bulk', icon: Calculator, labelKey: 'nav.pph21Bulk' },
      { href: '/tax/anomaly', icon: Activity, labelKey: 'nav.anomalyDetection' },
      { href: '/tax/transfer-pricing', icon: Receipt, labelKey: 'nav.transferPricing' },
      { href: '/tax/multi-entity', icon: Settings, labelKey: 'nav.multiEntity' },
      { href: '/tax/report', icon: BarChart3, labelKey: 'nav.clientReport' },
    ],
  },
  {
    section: 'operator',
    labelKey: 'nav.operatorSection',
    roles: operatorRoles,
    items: [
      { href: '/operator/dashboard', icon: Headphones, labelKey: 'nav.operatorDashboard', descKey: 'navDesc.operatorDashboard' },
      { href: '/operator/queue', icon: ListChecks, labelKey: 'nav.submissionQueue', descKey: 'navDesc.submissionQueue' },
      { href: '/operator/review', icon: FileText, labelKey: 'nav.documentReview' },
      { href: '/operator/approvals', icon: CheckCircle, labelKey: 'nav.approvals', descKey: 'navDesc.approvals', roles: supervisorRoles },
      { href: '/operator/workload', icon: BarChart3, labelKey: 'nav.workloadManagement', descKey: 'navDesc.workloadManagement', roles: supervisorRoles },
      { href: '/operator/statistics', icon: TrendingUp, labelKey: 'nav.operatorStatistics', descKey: 'navDesc.operatorStatistics', roles: supervisorRoles },
      { href: '/operator/complaints', icon: MessageSquareWarning, labelKey: 'nav.complaints', descKey: 'navDesc.complaints', roles: supervisorRoles },
      { href: '/operator/approval-rules', icon: Settings, labelKey: 'nav.approvalRules', descKey: 'navDesc.approvalRules', roles: supervisorRoles },
      { href: '/operator/clients', icon: Users, labelKey: 'nav.assignedClients', descKey: 'navDesc.assignedClients' },
      { href: '/tax/calendar', icon: Calendar, labelKey: 'nav.taxCalendar', descKey: 'navDesc.taxCalendar' },
      // Master-only: platform-wide stats, custom pricing, special-service quotes
      { href: '/admin/master', icon: TrendingUp, labelKey: 'nav.masterStats', roles: masterRoles },
      { href: '/admin/master/custom-pricing', icon: Settings, labelKey: 'nav.masterCustomPricing', roles: masterRoles },
    ],
  },
  {
    section: 'admin',
    labelKey: 'nav.administration',
    roles: [UserRole.PLATFORM_ADMIN],
    items: [
      { href: '/admin/monitoring', icon: Activity, labelKey: 'nav.monitoring' },
      { href: '/admin/cron', icon: Calendar, labelKey: 'nav.cronManagement' },
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
  // ── COMPANY 고객: 계정 섹션 (프로토타입: 프로필/보안/알림/연동/도움말) ──
  {
    section: 'company-account',
    labelKey: 'nav.account',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/company-profile', icon: Building2, labelKey: 'nav.companyProfile', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/notifications', icon: Bell, labelKey: 'nav.notifications', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/settings/integrations', icon: Activity, labelKey: 'nav.integrations', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/settings', icon: Settings, labelKey: 'nav.security', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
      { href: '/help', icon: Lightbulb, labelKey: 'nav.help', roles: [UserRole.CUSTOMER], customerTypes: ['COMPANY'] },
    ],
  },
  // ── 기타 역할: 계정 섹션 (기존 구조 유지) ──
  {
    section: 'account',
    labelKey: 'nav.account',
    items: [
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.PLATFORM_ADMIN] },
      { href: '/company-profile', icon: Building2, labelKey: 'nav.companyProfile', roles: consultantRoles },
      { href: '/my-profile', icon: User, labelKey: 'nav.myProfile', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      // Counterparties + accounting-SW integrations are COMPANY/CONSULTANT concepts
      // (거래처 ledger, Xero/Accurate sync). INDIVIDUAL customers don't have these,
      // so they are excluded from the INDIVIDUAL sidebar to keep it minimal.
      { href: '/counterparties', icon: Users, labelKey: 'nav.counterparties', roles: consultantRoles },
      { href: '/settings/integrations', icon: Activity, labelKey: 'nav.integrations', descKey: 'navDesc.integrations', roles: consultantRoles },
      { href: '/admin/team', icon: Users, labelKey: 'nav.teamManagement', roles: [UserRole.TAX_ADVISOR_JTC, UserRole.TAX_OPERATOR_SUPERVISOR] },
      { href: '/settings', icon: Settings, labelKey: 'nav.settings', roles: [...consultantRoles, ...operatorRoles, UserRole.PLATFORM_ADMIN, UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/help', icon: Lightbulb, labelKey: 'nav.help', roles: [...consultantRoles, ...operatorRoles, UserRole.PLATFORM_ADMIN, UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
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
  const customerType = session?.customerType;
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (key: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const availableRoles = session?.availableRoles;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  // Filter by role + customerType (INDIVIDUAL vs COMPANY)
  const isItemVisible = (item: NavItem): boolean => {
    if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
    if (item.customerTypes && (!customerType || !item.customerTypes.includes(customerType))) return false;
    return true;
  };

  const visibleSections = navItems
    .filter((section) => {
      if (!section.roles) return true;
      return userRole && section.roles.includes(userRole);
    })
    .map((section) => ({
      ...section,
      items: section.items.filter(isItemVisible),
    }))
    .filter((section) => section.items.length > 0);

  // AI-powered menu items
  const aiMenuPaths = ['/tax/savings', '/tax/report', '/tax/spt-tahunan/1770ss'];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-2" onClick={close}>
          <img src="/logo.png" alt="AI Pajak" className="h-9" />
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
                  {t('nav.switchRole', { role: t(`nav.role.${role}`) })}
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
                // Longer-sibling guard: if another item in the same section
                // has a more specific path that matches the current URL,
                // do not light up this item via the prefix match. Without
                // this, e.g. `/admin/master` and `/admin/master/custom-pricing`
                // would both highlight when visiting the latter.
                const longerSiblingMatches = section.items.some((s) =>
                  s !== item &&
                  s.href !== '#' &&
                  s.href.startsWith(`${item.href}/`) &&
                  (pathname === `/${locale}${s.href}` || pathname.startsWith(`/${locale}${s.href}/`))
                );
                const isActive =
                  item.href !== '#' &&
                  (
                    pathname === fullHref ||
                    (item.href !== '/settings' && !longerSiblingMatches && pathname.startsWith(`${fullHref}/`))
                  );
                const hasChildren = item.children && item.children.length > 0;
                const isChildActive = hasChildren && item.children!.some(c => pathname === `/${locale}${c.href}` || pathname.startsWith(`/${locale}${c.href}/`));
                const isExpanded = expandedMenus.has(item.labelKey) || isChildActive;
                const Icon = item.icon;
                const isAI = aiMenuPaths.some((p) => item.href.includes(p));

                if (hasChildren) {
                  return (
                    <li key={item.labelKey}>
                      <button
                        onClick={() => toggleSubmenu(item.labelKey)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isChildActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        <span className="flex-1 text-left">{t(item.labelKey)}</span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                      {isExpanded && (
                        <ul className="ml-7 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                          {item.children!.filter(c => !c.roles || (userRole && c.roles.includes(userRole))).map(child => {
                            const childHref = `/${locale}${child.href}`;
                            // Exact match or startsWith, but not if a longer sibling path also matches
                            const longerSiblingMatches = item.children!.some(s =>
                              s.href !== child.href &&
                              s.href.startsWith(child.href) &&
                              (pathname === `/${locale}${s.href}` || pathname.startsWith(`/${locale}${s.href}/`))
                            );
                            const childActive = !longerSiblingMatches && (pathname === childHref || pathname.startsWith(`${childHref}/`));
                            const ChildIcon = child.icon;
                            return (
                              <li key={child.href}>
                                <Link
                                  href={childHref}
                                  onClick={close}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all',
                                    childActive
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                                  )}
                                >
                                  <ChildIcon className={cn('h-3.5 w-3.5', childActive && 'text-white')} />
                                  {t(child.labelKey)}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

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
                      <span className="flex-1">{t(item.labelKey)}</span>
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
