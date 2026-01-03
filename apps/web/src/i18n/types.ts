import 'i18next';

// Import resource types for type safety
import type enCommon from './locales/en/common.json';
import type enNavigation from './locales/en/navigation.json';
import type enDashboard from './locales/en/dashboard.json';
import type enErrors from './locales/en/errors.json';

// Declare custom type for i18next resources
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      navigation: typeof enNavigation;
      dashboard: typeof enDashboard;
      errors: typeof enErrors;
    };
  }
}

// Re-export types for external use
export type CommonTranslations = typeof enCommon;
export type NavigationTranslations = typeof enNavigation;
export type DashboardTranslations = typeof enDashboard;
export type ErrorTranslations = typeof enErrors;

export type TranslationResources = {
  common: CommonTranslations;
  navigation: NavigationTranslations;
  dashboard: DashboardTranslations;
  errors: ErrorTranslations;
};
