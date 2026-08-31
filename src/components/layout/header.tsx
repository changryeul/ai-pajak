'use client';

import { useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { Bell, Globe, User, ChevronDown, Menu } from 'lucide-react';
import { LOCALE_NAMES, CUSTOMER_LOCALES, STAFF_LOCALES, type Locale } from '@/config/constants';
import { cn } from '@/lib/utils';
import { useMobileSidebar } from './mobile-sidebar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useSession } from '@/hooks/useSession';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = params.locale as Locale;
  const { session } = useSession();
  // 정책: 개인/법인 고객은 5개 언어, 그 외(상담사·어드바이저·마스터·운영팀)는 3개.
  const availableLocales = session?.role === 'CUSTOMER' ? CUSTOMER_LOCALES : STAFF_LOCALES;

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { toggle } = useMobileSidebar();

  const handleLocaleChange = (newLocale: Locale) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
    setIsLangOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 px-4 lg:px-6">
      {/* Mobile hamburger + spacer */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Globe className="h-4 w-4" />
            <span>{LOCALE_NAMES[currentLocale]}</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {isLangOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsLangOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {availableLocales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => handleLocaleChange(locale)}
                    className={cn(
                      'flex w-full items-center px-4 py-2 text-sm',
                      locale === currentLocale
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    {LOCALE_NAMES[locale]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="font-medium text-gray-900">
                {userName || 'User'}
              </p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          {isProfileOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsProfileOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="font-medium text-gray-900">{userName}</p>
                  <p className="text-sm text-gray-500">{userEmail}</p>
                </div>
                <a
                  href={`/${currentLocale}/settings`}
                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
