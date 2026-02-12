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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  {
    section: 'main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard.title' },
      { href: '/documents', icon: Upload, labelKey: 'documents.title' },
      { href: '/reports', icon: BarChart3, labelKey: 'dashboard.viewReports' },
    ],
  },
  {
    section: 'tax',
    label: 'Tax Filing',
    items: [
      { href: '/tax/pph21', icon: Users, labelKey: 'tax.pph21.title' },
      { href: '/tax/pph23', icon: Receipt, labelKey: 'tax.pph23.title' },
      { href: '/tax/ppn', icon: Calculator, labelKey: 'tax.ppn.title' },
      { href: '/tax/spt-tahunan', icon: FileSpreadsheet, labelKey: 'tax.sptTahunan.title' },
    ],
  },
  {
    section: 'account',
    label: 'Account',
    items: [
      { href: '/billing', icon: CreditCard, labelKey: 'subscription.title' },
      { href: '/settings', icon: Settings, labelKey: 'settings.title' },
    ],
  },
];

export function Sidebar() {
  const t = useTranslations();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params.locale as string;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PAJAK</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((section) => (
            <div key={section.section} className="mb-6">
              {section.label && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {section.label}
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

        {/* Logout */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </aside>
  );
}
