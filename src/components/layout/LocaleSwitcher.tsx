'use client';

/**
 * Standalone locale switcher — used in both the dashboard header AND on
 * unauthenticated pages (login / register / forgot-password) so users
 * can pick their language BEFORE signing in.
 *
 * The underlying URL swap was already inlined in header.tsx; this
 * component is a self-contained extract so auth pages can drop it in
 * without depending on the full header layout.
 */

import { useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import { LOCALE_NAMES, LOCALES, type Locale } from '@/config/constants';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  /** Optional class on the trigger button — callers can re-skin per page. */
  className?: string;
  /** 'compact' hides the locale label, showing only the globe icon. */
  variant?: 'default' | 'compact';
  /** When true, the popover opens to the LEFT of the trigger (useful in the top-right corner of auth pages). */
  alignLeft?: boolean;
}

export function LocaleSwitcher({
  className,
  variant = 'default',
  alignLeft = false,
}: LocaleSwitcherProps) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = (params?.locale as Locale) ?? 'id';

  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (next: Locale) => {
    const nextPath = pathname.replace(`/${currentLocale}`, `/${next}`);
    router.push(nextPath);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-white/60 transition',
          className,
        )}
      >
        <Globe className="h-4 w-4 text-gray-600" />
        {variant !== 'compact' && (
          <span className="text-gray-700">{LOCALE_NAMES[currentLocale]}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cn(
              'absolute z-20 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg',
              alignLeft ? 'right-0' : 'left-0',
            )}
          >
            {LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => handleChange(locale)}
                className={cn(
                  'flex w-full items-center px-4 py-2 text-sm',
                  locale === currentLocale
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {LOCALE_NAMES[locale]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
