import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/config/constants';

export const locales = LOCALES;
export const defaultLocale = DEFAULT_LOCALE;

export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/');
  const locale = segments[1];

  if (locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return defaultLocale;
}

export function removeLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/');
  const locale = segments[1];

  if (locales.includes(locale as Locale)) {
    return '/' + segments.slice(2).join('/');
  }

  return pathname;
}
