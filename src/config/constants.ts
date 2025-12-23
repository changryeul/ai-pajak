// AI PAJAK - Configuration Constants

export const APP_NAME = 'AI PAJAK';
export const APP_DESCRIPTION = 'AI-Powered Tax Filing System for Indonesia';

// Supported locales
export const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
};

export const DEFAULT_LOCALE: Locale = 'id';

// Tax types
export const TAX_TYPES = {
  PPH21: 'pph21',
  PPH23: 'pph23',
  PPN: 'ppn',
  SPT_TAHUNAN: 'spt-tahunan',
} as const;

export type TaxType = (typeof TAX_TYPES)[keyof typeof TAX_TYPES];

// User types
export const USER_TYPES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  TAX_CONSULTANT: 'tax_consultant',
} as const;

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

// Subscription plans
export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

// PPh 21 Tax brackets (2024)
export const PPH21_BRACKETS = [
  { min: 0, max: 60_000_000, rate: 0.05 },
  { min: 60_000_000, max: 250_000_000, rate: 0.15 },
  { min: 250_000_000, max: 500_000_000, rate: 0.25 },
  { min: 500_000_000, max: 5_000_000_000, rate: 0.30 },
  { min: 5_000_000_000, max: Infinity, rate: 0.35 },
] as const;

// PTKP (Penghasilan Tidak Kena Pajak) - 2024
export const PTKP = {
  TK0: 54_000_000, // Tidak Kawin, tanpa tanggungan
  TK1: 58_500_000, // Tidak Kawin, 1 tanggungan
  TK2: 63_000_000, // Tidak Kawin, 2 tanggungan
  TK3: 67_500_000, // Tidak Kawin, 3 tanggungan
  K0: 58_500_000,  // Kawin, tanpa tanggungan
  K1: 63_000_000,  // Kawin, 1 tanggungan
  K2: 67_500_000,  // Kawin, 2 tanggungan
  K3: 72_000_000,  // Kawin, 3 tanggungan
  KI0: 112_500_000, // Kawin, istri bekerja, tanpa tanggungan
  KI1: 117_000_000, // Kawin, istri bekerja, 1 tanggungan
  KI2: 121_500_000, // Kawin, istri bekerja, 2 tanggungan
  KI3: 126_000_000, // Kawin, istri bekerja, 3 tanggungan
} as const;

export type PTKPCategory = keyof typeof PTKP;

// PPN Rate
export const PPN_RATE = 0.11; // 11%

// PPh 23 Rates
export const PPH23_RATES = {
  DIVIDEND: 0.15,
  INTEREST: 0.15,
  ROYALTY: 0.15,
  PRIZE: 0.15,
  RENT: 0.02,
  SERVICE: 0.02,
} as const;

// DJP API endpoints (placeholder)
export const DJP_API = {
  BASE_URL: process.env.DJP_API_URL || 'https://api.pajak.go.id',
  EFILING: '/efiling',
  EBILLING: '/ebilling',
  NPWP_VALIDATION: '/npwp/validate',
};

// Midtrans configuration
export const MIDTRANS_CONFIG = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
  SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
};
