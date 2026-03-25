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
  X,
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
  roles?: UserRole[]; // undefined = all roles
}

interface NavSection {
  section: string;
  labelKey?: string;
  roles?: UserRole[]; // undefined = all roles
  items: NavItem[];
}

const allRoles = [UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC, UserRole.PLATFORM_ADMIN];
const taxRoles = [UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];
const consultantRoles = [UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC];

const navItems: NavSection[] = [
  {
    section: 'main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: allRoles },
      { href: '/customers', icon: Users, labelKey: 'nav.customers', roles: consultantRoles },
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.filings', roles: taxRoles },
      { href: '/documents', icon: Upload, labelKey: 'nav.documents', roles: taxRoles },
      { href: '/reports', icon: BarChart3, labelKey: 'nav.reports', roles: [UserRole.CUSTOMER] },
    ],
  },
  {
    section: 'tax',
    labelKey: 'nav.taxFiling',
    roles: [UserRole.CUSTOMER],
    items: [
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'nav.annualReturn' },
      { href: '/tax/pph21', icon: FileText, labelKey: 'nav.pph21' },
      { href: '/tax/pph23', icon: Receipt, labelKey: 'nav.pph23' },
      { href: '/tax/ppn', icon: Calculator, labelKey: 'nav.ppn' },
    ],
  },
  {
    section: 'consultant-tax',
    labelKey: 'nav.taxManagement',
    roles: consultantRoles,
    items: [
      { href: '/tax/new', icon: FileText, labelKey: 'nav.newFiling' },
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'nav.annualReturn' },
    ],
  },
  {
    section: 'poa',
    labelKey: 'nav.poaSection',
    roles: taxRoles,
    items: [
      { href: '/poa/create', icon: Shield, labelKey: 'nav.createPoa', roles: [UserRole.CUSTOMER] },
      { href: '/filings', icon: ClipboardList, labelKey: 'nav.poaManage', roles: consultantRoles },
    ],
  },
  {
    section: 'admin',
    labelKey: 'nav.administration',
    roles: [UserRole.PLATFORM_ADMIN],
    items: [
      { href: '/admin/monitoring', icon: Activity, labelKey: 'nav.monitoring' },
    ],
  },
  {
    section: 'account',
    labelKey: 'nav.account',
    items: [
      { href: '/billing', icon: CreditCard, labelKey: 'nav.billing', roles: [UserRole.CUSTOMER, UserRole.PLATFORM_ADMIN] },
      { href: '/settings', icon: Settings, labelKey: 'nav.settings', roles: allRoles },
    ],
  },
];

export function Sidebar() {
  const t = useTranslations();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const { isOpen, close } = useMobileSidebar();
  const locale = params.locale as string;
  const userRole = session?.role;

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

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-2" onClick={close}>
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PAJAK</span>
          </Link>
          <button onClick={close} className="lg:hidden rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role badge */}
        {userRole && (
          <div className="px-6 py-3 border-b border-gray-100">
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              userRole === UserRole.CUSTOMER && 'bg-blue-50 text-blue-700',
              userRole === UserRole.CONSULTANT_JTC && 'bg-green-50 text-green-700',
              userRole === UserRole.TAX_ADVISOR_JTC && 'bg-purple-50 text-purple-700',
              userRole === UserRole.PLATFORM_ADMIN && 'bg-orange-50 text-orange-700',
            )}>
              {t(`nav.role.${userRole}`)}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.section} className="mb-6">
              {section.labelKey && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t(section.labelKey)}
                </h3>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const fullHref = `/${locale}${item.href}`;
                  const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={fullHref}
                        onClick={close}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {t(item.labelKey)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User info + Logout */}
        <div className="border-t border-gray-200 p-3">
          {session?.fullName && (
            <p className="px-3 pb-2 text-xs text-gray-500 truncate">{session.fullName}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {t('auth.logout')}
          </button>
        </div>
      </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 hidden lg:block">
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
