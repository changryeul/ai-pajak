import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation resources directly (bundled approach for reliability)
import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enDashboard from './locales/en/dashboard.json';
import enErrors from './locales/en/errors.json';

import koCommon from './locales/ko/common.json';
import koNavigation from './locales/ko/navigation.json';
import koDashboard from './locales/ko/dashboard.json';
import koErrors from './locales/ko/errors.json';

import idCommon from './locales/id/common.json';
import idNavigation from './locales/id/navigation.json';
import idDashboard from './locales/id/dashboard.json';
import idErrors from './locales/id/errors.json';

// Define supported languages
export const SUPPORTED_LANGUAGES = ['en', 'ko', 'id'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: '한국어',
  id: 'Bahasa Indonesia',
};

// Bundle all resources
const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    dashboard: enDashboard,
    errors: enErrors,
  },
  ko: {
    common: koCommon,
    navigation: koNavigation,
    dashboard: koDashboard,
    errors: koErrors,
  },
  id: {
    common: idCommon,
    navigation: idNavigation,
    dashboard: idDashboard,
    errors: idErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'navigation', 'dashboard', 'errors'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },
  });

export default i18n;
