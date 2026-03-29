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

// PPh 26 Rate (Non-Resident Withholding - Pasal 26 UU PPh)
export const PPH26_STANDARD_RATE = 0.20; // 20%

// Tax Treaty (P3B) rates by country - major treaty partners
// Source: DJP P3B list (simplified for common income types)
export const TAX_TREATY_RATES: Record<string, {
  country: string;
  dividend: number;   // Typically 10-15%
  interest: number;   // Typically 10%
  royalty: number;    // Typically 10-15%
  service: number;    // Branch profit / technical service
  reference: string;  // Treaty reference
}> = {
  JP: { country: 'Japan', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Japan (1982)' },
  KR: { country: 'South Korea', dividend: 0.10, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Korea (1988)' },
  SG: { country: 'Singapore', dividend: 0.10, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Singapore (1990)' },
  MY: { country: 'Malaysia', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Malaysia (1991)' },
  CN: { country: 'China', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-China (2001)' },
  US: { country: 'United States', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-USA (1988)' },
  GB: { country: 'United Kingdom', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-UK (1993)' },
  AU: { country: 'Australia', dividend: 0.15, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Australia (1992)' },
  NL: { country: 'Netherlands', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Netherlands (2002)' },
  DE: { country: 'Germany', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.075, reference: 'P3B Indonesia-Germany (1990)' },
  TH: { country: 'Thailand', dividend: 0.10, interest: 0.15, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Thailand (2001)' },
  IN: { country: 'India', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-India (2012)' },
  HK: { country: 'Hong Kong', dividend: 0.05, interest: 0.10, royalty: 0.05, service: 0.10, reference: 'P3B Indonesia-Hong Kong (2010)' },
  AE: { country: 'UAE', dividend: 0.10, interest: 0.05, royalty: 0.05, service: 0.10, reference: 'P3B Indonesia-UAE (1996)' },
  PH: { country: 'Philippines', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.15, reference: 'P3B Indonesia-Philippines (1981)' },
  VN: { country: 'Vietnam', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.15, reference: 'P3B Indonesia-Vietnam (1997)' },
};

// DJP (Direktorat Jenderal Pajak) API Configuration
export const DJP_API = {
  // Enable/disable DJP integration
  ENABLED: process.env.DJP_ENABLED !== 'false', // Enabled by default

  // Base URLs
  BASE_URL: process.env.DJP_API_URL || 'https://api.pajak.go.id',
  SANDBOX_URL: process.env.DJP_SANDBOX_URL || 'https://api-sandbox.pajak.go.id',

  // Use sandbox in development
  USE_SANDBOX: process.env.DJP_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production',

  // API Endpoints
  ENDPOINTS: {
    AUTH: '/oauth/token',
    E_FILING: {
      SUBMIT: '/efiling/v1/submit',
      STATUS: '/efiling/v1/status',
      BPE: '/efiling/v1/bpe',
    },
    E_BILLING: {
      CREATE: '/ebilling/v1/create',
      STATUS: '/ebilling/v1/status',
    },
    NPWP: {
      VALIDATE: '/npwp/v1/validate',
    },
  },

  // Configuration
  CONFIG: {
    TIMEOUT_MS: 30000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 5000,
  },
};

// DJP Tax Codes for e-Billing
export const DJP_TAX_CODES = {
  PPH21: {
    JENIS_PAJAK: '411121',
    JENIS_SETORAN: {
      MONTHLY: '100',
      ANNUAL: '200',
    },
  },
  PPH23: {
    JENIS_PAJAK: '411124',
    JENIS_SETORAN: {
      MONTHLY: '100',
    },
  },
  PPH4_2: {
    JENIS_PAJAK: '411128',
    JENIS_SETORAN: {
      FINAL: '420',
    },
  },
  PPH26: {
    JENIS_PAJAK: '411127',
    JENIS_SETORAN: {
      MONTHLY: '100',
    },
  },
  PPN: {
    JENIS_PAJAK: '411211',
    JENIS_SETORAN: {
      MONTHLY: '100',
      QUARTERLY: '300',
    },
  },
} as const;

// Midtrans configuration
export const MIDTRANS_CONFIG = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
  SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
};
