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
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  MessageSquareWarning,
  Sparkles,
  ChevronDown,
  User,
  UserPlus,
  Bell,
  Newspaper,
  ShieldCheck,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { useMobileSidebar } from './mobile-sidebar';
import { OpsSidebarHeader } from './OpsSidebarHeader';
import { OpsSidebarFooter } from './OpsSidebarFooter';

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

const taxRoles = [UserRole.CUSTOMER, UserRole.CONSULTANT, UserRole.TAX_ADVISOR];
const consultantRoles = [UserRole.CONSULTANT, UserRole.TAX_ADVISOR];
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
// P6: 마스터 2원화 — 사업운영 메뉴는 PLATFORM_MASTER 도, 신고운영 메뉴는
// TAX_OPERATOR_MASTER 만 (항목별 roles 로 분리).
const masterRoles = [UserRole.TAX_OPERATOR_MASTER, UserRole.PLATFORM_MASTER];
const filingMasterOnly = [UserRole.TAX_OPERATOR_MASTER];

const navItems: NavSection[] = [
  {
    section: 'main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    ],
  },
  // ── COMPANY 고객: 5개 큰 메뉴 (월 신고 / 연 신고 / 신고관리 / 계정) ──
  // 대시보드는 위쪽 main 섹션에서 독립 링크로 노출.
  // 각 큰 메뉴는 헤더 클릭으로 펼침/접힘 토글; 현재 페이지가 속한 메뉴는 자동 펼침.
  {
    section: 'company-main',
    roles: [UserRole.CUSTOMER],
    items: [
      // 월 신고 (직원 인사 기록 + 세금 도구도 같이 묶음)
      {
        href: '#', icon: Receipt, labelKey: 'nav.monthlyFiling',
        customerTypes: ['COMPANY'],
        children: [
          { href: '/tax/filing-status', icon: BarChart3, labelKey: 'nav.filingStatus' },
          { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21Label' },
          { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.withholdingTaxLabel' },
          // PPh 4(2) 는 원천세 페이지에 [PPh4(2)] 접두사로 같이 표시되고, WHT
          // 일괄 업로드 결과 panel 의 quick-jump 으로 접근 가능 → 사이드바
          // 별도 항목은 제거 (2026-06-20). 페이지/API/SPT Masa filing 분리는
          // 그대로 유지.
          { href: '/tax/umkm', icon: Shield, labelKey: 'nav.prepaidCorporateTax' },
          { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppnLabel' },
          { href: '/tax/billing', icon: CreditCard, labelKey: 'nav.idBillingIssue' },
          { href: '/tax/payroll/employees', icon: Users, labelKey: 'nav.employeeHrRecord' },
          // 2026-06-24: '세금예측/계산기' (/tax/tools) 사이드바 항목 제거.
          // 페이지 자체는 보존 — 필요 시 deep-link 로 접근.
          { href: '/tax/anomaly', icon: Activity, labelKey: 'nav.anomalyDetection' },
        ],
      },
      // 연 신고
      {
        href: '#', icon: FileSpreadsheet, labelKey: 'nav.annualFiling',
        customerTypes: ['COMPANY'],
        children: [
          { href: '/tax/annual', icon: FileSpreadsheet, labelKey: 'nav.closingWork' },
          { href: '/tax/ebupot', icon: FileText, labelKey: 'nav.ebupotIssue' },
          { href: '/tax/spt-1771', icon: FileSpreadsheet, labelKey: 'nav.sptGeneration' },
        ],
      },
      // 신고관리 (사용자 명시 3개만)
      {
        href: '#', icon: ClipboardList, labelKey: 'nav.filingManagement',
        customerTypes: ['COMPANY'],
        children: [
          { href: '/filings', icon: ClipboardList, labelKey: 'nav.taxHistory' },
          { href: '/reports', icon: BarChart3, labelKey: 'nav.taxReport' },
          { href: '/counterparties', icon: Users, labelKey: 'nav.counterpartyInput' },
        ],
      },
      // 계정
      {
        href: '#', icon: User, labelKey: 'nav.account',
        customerTypes: ['COMPANY'],
        children: [
          { href: '/company-profile', icon: Building2, labelKey: 'nav.companyProfile' },
          { href: '/settings/integrations', icon: Activity, labelKey: 'nav.integrations' },
          { href: '/settings', icon: Settings, labelKey: 'nav.securityPassword' },
          { href: '/billing', icon: CreditCard, labelKey: 'nav.billing' },
          { href: '/notifications', icon: Bell, labelKey: 'nav.notifications' },
          { href: '/help', icon: Lightbulb, labelKey: 'nav.help' },
        ],
      },
    ],
  },
  // ── 개인 고객: 간결 7-메뉴 (2026-04-23 keynote Pribadi 스펙) ──
  // 상단 main 섹션의 대시보드 + 여기 6개 = 총 7개.
  // 대시보드 / 연신고 / ID billing 발행 / 세금 보고서 / 내정보 / 결제 / 도움말
  {
    section: 'individual-main',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'nav.annualFiling', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/tax/billing', icon: Receipt, labelKey: 'nav.idBillingIssue', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/my-profile', icon: User, labelKey: 'nav.myProfile', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
      { href: '/help', icon: Lightbulb, labelKey: 'nav.help', roles: [UserRole.CUSTOMER], customerTypes: ['INDIVIDUAL'] },
    ],
  },
  // ── 세무 컨설턴트 ERP (직원용, 5-step workflow) ──
  {
    section: 'consultant-erp',
    labelKey: 'nav.consultantErp',
    roles: [...consultantRoles, UserRole.TAX_OPERATOR_SUPERVISOR],
    items: [
      { href: '/consultant-erp/dashboard', icon: LayoutDashboard, labelKey: 'nav.consultantErpDashboard' },
      { href: '/consultant-erp/work', icon: ClipboardList, labelKey: 'nav.consultantErpWork' },
      { href: '/consultant-erp/billing', icon: CreditCard, labelKey: 'nav.consultantErpIdBilling' },
      { href: '/consultant-erp/legality', icon: Shield, labelKey: 'nav.consultantErpLegality' },
      { href: '/consultant-erp/counterparty', icon: Users, labelKey: 'nav.consultantErpCounterparty' },
    ],
  },
  // ── Firm Admin (세무컨설팅 법인 관리자, P6.2 신설) ──
  {
    section: 'firm-admin',
    labelKey: 'nav.firmAdmin',
    roles: [UserRole.FIRM_ADMIN],
    items: [
      { href: '/consultant-erp/firm-admin/staff',    icon: Users,      labelKey: 'nav.firmAdminStaff' },
      { href: '/consultant-erp/firm-admin/clients',  icon: Building2,  labelKey: 'nav.firmAdminClients' },
      { href: '/consultant-erp/firm-admin/billing',  icon: CreditCard, labelKey: 'nav.firmAdminBilling' },
    ],
  },
  // ── Supervisor ERP (팀장용, supervisor-only) ──
  {
    section: 'supervisor-erp',
    labelKey: 'nav.supervisorErp',
    roles: [UserRole.TAX_OPERATOR_SUPERVISOR],
    items: [
      { href: '/consultant-erp/supervisor/approval', icon: ClipboardList, labelKey: 'nav.supervisorApproval' },
      { href: '/consultant-erp/supervisor/team', icon: Users, labelKey: 'nav.supervisorTeam' },
      { href: '/consultant-erp/supervisor/affiliation', icon: ArrowRightLeft, labelKey: 'nav.supervisorAffiliation' },
      { href: '/consultant-erp/supervisor/customers', icon: Users, labelKey: 'nav.supervisorCustomers' },
      { href: '/consultant-erp/supervisor/revisions', icon: ClipboardList, labelKey: 'nav.supervisorRevisions' },
      { href: '/consultant-erp/supervisor/calendar', icon: BarChart3, labelKey: 'nav.supervisorCalendar' },
      { href: '/consultant-erp/supervisor/legality', icon: Shield, labelKey: 'nav.supervisorLegality' },
      { href: '/consultant-erp/supervisor/coretax', icon: Receipt, labelKey: 'nav.supervisorCoretax' },
      { href: '/consultant-erp/supervisor/billing-handover', icon: CreditCard, labelKey: 'nav.supervisorBillingHandover' },
      { href: '/consultant-erp/supervisor/quality', icon: ShieldCheck, labelKey: 'nav.supervisorQuality' },
      { href: '/consultant-erp/supervisor/settings', icon: Shield, labelKey: 'nav.supervisorSettings' },
    ],
  },
  // ── 세무 컨설턴트: 월신고 (기존 구조 유지) ──
  {
    section: 'consultant-main',
    roles: consultantRoles,
    items: [
      { href: '#', icon: Receipt, labelKey: 'nav.monthlyFiling', children: [
        { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21Label' },
        { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.withholdingTaxLabel' },
        { href: '/tax/umkm', icon: Shield, labelKey: 'nav.prepaidCorporateTax' },
        { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppnLabel' },
        { href: '/tax/billing', icon: CreditCard, labelKey: 'nav.taxBilling' },
      ]},
      { href: '#', icon: FileSpreadsheet, labelKey: 'nav.annualFiling', children: [
        { href: '/tax/annual', icon: FileSpreadsheet, labelKey: 'nav.annualSettlement' },
        { href: '/tax/annual/financial-statements', icon: BookOpen, labelKey: 'nav.financialStatements' },
        { href: '/tax/spt-tahunan', icon: FileText, labelKey: 'nav.sptPribadi' },
      ]},
      { href: '/tax/payroll/employees', icon: Users, labelKey: 'nav.employeeHrRecord' },
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.filings' },
      { href: '/invoice-capture', icon: Camera, labelKey: 'nav.invoiceCapture' },
      { href: '/documents/upload', icon: Upload, labelKey: 'nav.docUpload' },
      { href: '/documents', icon: Upload, labelKey: 'nav.documents' },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
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
      { href: '/tax/anomaly', icon: Activity, labelKey: 'nav.anomalyDetection' },
      { href: '/tax/multi-entity', icon: Settings, labelKey: 'nav.multiEntity' },
      { href: '/tax/report', icon: BarChart3, labelKey: 'nav.clientReport' },
    ],
  },
  // ── 상담원(TAX_OPERATOR) 전용: 5단계 평면 메뉴 ──
  // PDF 「AI Pajak 백오피스_상담원」: 복잡한 내부 메뉴 대신 고객 한 명을 골라
  // "내 업무 → 검토 → 승인요청 → Coretax → 이력" 순으로 처리.
  // Supervisor 이상은 별도 섹션('operator')에서 4-dropdown 콘솔을 사용한다.
  {
    section: 'operator-staff',
    roles: [UserRole.TAX_OPERATOR],
    items: [
      { href: '/operator/my-work',          icon: ListChecks,    labelKey: 'nav.opMyWork' },
      { href: '/operator/review-case',      icon: FileText,      labelKey: 'nav.opReview' },
      { href: '/operator/approval-request', icon: CheckCircle,   labelKey: 'nav.opApproval' },
      { href: '/operator/coretax',          icon: Receipt,       labelKey: 'nav.opCoretax' },
      { href: '/operator/billing-issuance', icon: CreditCard,    labelKey: 'nav.opIdBilling' },
      { href: '/operator/messenger',        icon: MessageSquare, labelKey: 'nav.opMessenger' },
      { href: '/operator/customer-inbox',   icon: MessageCircle, labelKey: 'nav.customerInbox' },
      { href: '/operator/history',          icon: ClipboardList, labelKey: 'nav.opHistory' },
    ],
  },
  // ── Supervisor: 평면 9-메뉴 (PDF "AI Pajak 수퍼바이저 화면_20260525") ──
  // 이전 드롭다운 3-그룹 구조에서 평면으로 단순화. 미명시 페이지
  // (queue/review/complaints/clients/calendar/approval-rules) 는 그대로
  // 존속하되 사이드바에서는 빼고 각 페이지(e.g. workload, approvals)
  // 안에서 cross-link 또는 직접 URL 로 접근.
  {
    section: 'operator',
    roles: supervisorRoles,
    items: [
      { href: '/operator/dashboard',  icon: Headphones,    labelKey: 'nav.operatorDashboard' },
      { href: '/operator/unassigned-customers', icon: UserPlus, labelKey: 'nav.unassignedCustomers' },
      { href: '/operator/workload',   icon: ListChecks,    labelKey: 'nav.workloadManagement' },
      { href: '/operator/approvals',  icon: CheckCircle,   labelKey: 'nav.approvals' },
      { href: '/operator/billing-issuance', icon: CreditCard, labelKey: 'nav.opIdBilling' },
      { href: '/operator/team',       icon: Users,         labelKey: 'nav.operatorTeam' },
      { href: '/operator/statistics', icon: TrendingUp,    labelKey: 'nav.operatorStatistics' },
      { href: '/operator/cases',      icon: ClipboardList, labelKey: 'nav.allCases' },
      { href: '/operator/messenger',  icon: MessageSquare, labelKey: 'nav.opMessenger' },
      { href: '/operator/customer-inbox', icon: MessageCircle, labelKey: 'nav.customerInbox' },
      { href: '/operator/audit',      icon: Shield,        labelKey: 'nav.auditLog' },
      {
        href: '/operator/settings',
        icon: Settings,
        labelKey: 'nav.opsSettings',
        // Track A: narrow visibility to MASTER + SUPERVISOR (PDF "Admin/Tax Engine"
        // governance scope). LEAD 는 상위 supervisorRoles 에 포함이지만 settings
        // 페이지는 OPERATOR/LEAD 진입 시 silent redirect 라 sidebar 도 일관성 위해
        // 좁힘.
        roles: [UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER],
      },
    ],
  },
  // ── Master-only: 별도 섹션 (supervisor 평면 9-메뉴 와 시각적 분리) ──
  {
    section: 'master',
    labelKey: 'nav.masterArea',
    roles: masterRoles,
    items: [
      // 사업운영 (MonoFlip) — 두 마스터 모두
      { href: '/admin/master',                       icon: TrendingUp, labelKey: 'nav.masterStats' },
      { href: '/admin/master/tenants',               icon: Building2,  labelKey: 'nav.masterTenants' },
      { href: '/admin/master/custom-pricing',        icon: Settings,   labelKey: 'nav.masterCustomPricing' },
      // 신고운영 (JTC) — TAX_OPERATOR_MASTER 전용
      { href: '/admin/master/luxury-classifications', icon: Sparkles,  labelKey: 'nav.masterLuxuryClassifications', roles: filingMasterOnly },
      { href: '/admin/master/customer-ai-templates',  icon: MessageSquareText, labelKey: 'nav.masterCustomerAiTemplates', roles: filingMasterOnly },
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
  // ── 기타 역할: 계정 섹션 ──
  //
  // PDF 「수퍼바이저 화면 20260525」 의 supervisor 사이드바에는 평면 9-메뉴 +
  // (master 면) 마스터 영역만 있고 별도 "계정" 섹션이 없다 (세무 기준 설정 ·
  // 도움말은 평면 9-메뉴 안에 포함되거나 페이지 내부에서 진입). 그래서
  // operator-tier (TAX_OPERATOR / LEAD / SUPERVISOR / MASTER) 의 사이드바
  // 에는 이 섹션을 노출하지 않는다. operator-tier 의 "/settings" 와 "/help"
  // 경로 자체는 살아있지만 진입은 다른 곳에서. consultant/platform_admin
  // 은 기존 그대로.
  {
    section: 'account',
    labelKey: 'nav.account',
    items: [
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.PLATFORM_ADMIN] },
      { href: '/company-profile', icon: Building2, labelKey: 'nav.companyProfile', roles: consultantRoles },
      { href: '/counterparties', icon: Users, labelKey: 'nav.counterparties', roles: consultantRoles },
      { href: '/settings/integrations', icon: Activity, labelKey: 'nav.integrations', descKey: 'navDesc.integrations', roles: consultantRoles },
      { href: '/admin/team', icon: Users, labelKey: 'nav.teamManagement', roles: [UserRole.TAX_ADVISOR] },
      { href: '/settings', icon: Settings, labelKey: 'nav.settings', roles: [...consultantRoles, UserRole.PLATFORM_ADMIN] },
      { href: '/help', icon: Lightbulb, labelKey: 'nav.help', roles: [...consultantRoles, UserRole.PLATFORM_ADMIN] },
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

  // Supervisor / Master / Operator 사이드바는 PDF 「수퍼바이저 화면 20260525」
  // spec 의 다크 상단 패널 (타이틀 + 사용자 + 언어 + 작업자 전환 + 검색) 을 사용.
  // 그 외 role (customer/consultant/admin) 은 기존 로고 + role badge 유지.
  const opsRoles = new Set<UserRole>([
    UserRole.TAX_OPERATOR,
    UserRole.TAX_OPERATOR_LEAD,
    UserRole.TAX_OPERATOR_SUPERVISOR,
    UserRole.TAX_OPERATOR_MASTER,
  ]);
  const isOpsRole = !!userRole && opsRoles.has(userRole);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950">
      {isOpsRole && session ? (
        <>
          {/* Mobile close button overlay (matches the ops-style dark header) */}
          <button
            onClick={close}
            className="absolute top-3 right-3 lg:hidden rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <OpsSidebarHeader session={session} />
        </>
      ) : (
        <>
          {/* Logo (non-ops roles) */}
          <div className="flex h-16 items-center justify-between px-6">
            <Link href={`/${locale}/dashboard`} className="flex items-center gap-2" onClick={close}>
              <img src="/logo.png" alt="AI Pajak" className="h-9" />
            </Link>
            <button onClick={close} className="lg:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Role badge with switcher (non-ops roles) */}
          {userRole && (
            <div className="px-6 pb-4">
              <div className={cn(
                'inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium',
                userRole === UserRole.CUSTOMER && 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200',
                userRole === UserRole.CONSULTANT && 'bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 border border-green-200',
                userRole === UserRole.TAX_ADVISOR && 'bg-gradient-to-r from-purple-50 to-violet-100 text-purple-700 border border-purple-200',
                userRole === UserRole.PLATFORM_ADMIN && 'bg-gradient-to-r from-orange-50 to-amber-100 text-orange-700 border border-orange-200',
              )}>
                {t(`nav.role.${userRole}`)}
              </div>
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
        </>
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
        {isOpsRole ? (
          /* PDF spec: 좌측 하단 "전체·승인·배정" KPI 줄 */
          <div className="pb-2">
            <OpsSidebarFooter />
          </div>
        ) : (
          session?.fullName && (
            <div className="px-3 pb-2">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-200 truncate">{session.fullName}</p>
              <p className="text-[10px] text-gray-400 truncate">{session.email || ''}</p>
            </div>
          )
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
