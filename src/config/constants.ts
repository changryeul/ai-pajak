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

// PPh 4(2) Construction Rates by SBU Grade (PP 9/2022)
export const PPH42_CONSTRUCTION_RATES = {
  CONSTRUCTION_WORK: {
    SMALL: 0.0175,        // 1.75% - SBU Kecil (Grade 1-4) / SKK
    MEDIUM_LARGE: 0.0265, // 2.65% - SBU Menengah/Besar (Grade 5+)
    NONE: 0.04,           // 4% - Tanpa SBU/SKK
  },
  CONSTRUCTION_CONSULT: {
    HAS_SBU: 0.035,       // 3.5% - Dengan SBU/SKK
    NONE: 0.06,           // 6% - Tanpa SBU/SKK
  },
  CONSTRUCTION_INTEGRATED: {
    HAS_SBU: 0.0265,      // 2.65% - Dengan SBU
    NONE: 0.04,           // 4% - Tanpa SBU
  },
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
  SG: { country: 'Singapore', dividend: 0.10, interest: 0.10, royalty: 0.08, service: 0.10, reference: 'P3B Indonesia-Singapore (2022, revised)' },
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
  // Additional treaty partners
  FR: { country: 'France', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-France (1979)' },
  IT: { country: 'Italy', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Italy (1990)' },
  ES: { country: 'Spain', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Spain (1995)' },
  CA: { country: 'Canada', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Canada (1979)' },
  NZ: { country: 'New Zealand', dividend: 0.15, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-New Zealand (1988)' },
  SE: { country: 'Sweden', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Sweden (1989)' },
  NO: { country: 'Norway', dividend: 0.15, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Norway (1988)' },
  DK: { country: 'Denmark', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Denmark (1985)' },
  FI: { country: 'Finland', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Finland (1987)' },
  BE: { country: 'Belgium', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Belgium (1997)' },
  AT: { country: 'Austria', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Austria (1986)' },
  CH: { country: 'Switzerland', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Switzerland (1988)' },
  LU: { country: 'Luxembourg', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Luxembourg (1993)' },
  PK: { country: 'Pakistan', dividend: 0.10, interest: 0.15, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Pakistan (1990)' },
  BD: { country: 'Bangladesh', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Bangladesh (2003)' },
  LK: { country: 'Sri Lanka', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.15, reference: 'P3B Indonesia-Sri Lanka (1993)' },
  TW: { country: 'Taiwan', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Taiwan (1995)' },
  SA: { country: 'Saudi Arabia', dividend: 0.10, interest: 0.05, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Saudi Arabia (1991)' },
  QA: { country: 'Qatar', dividend: 0.10, interest: 0.10, royalty: 0.05, service: 0.10, reference: 'P3B Indonesia-Qatar (2006)' },
  KW: { country: 'Kuwait', dividend: 0.10, interest: 0.05, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Kuwait (1997)' },
  EG: { country: 'Egypt', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.15, reference: 'P3B Indonesia-Egypt (1998)' },
  ZA: { country: 'South Africa', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-South Africa (1997)' },
  TR: { country: 'Turkey', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Turkey (1997)' },
  RU: { country: 'Russia', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Russia (1999)' },
  PL: { country: 'Poland', dividend: 0.10, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Poland (1992)' },
  CZ: { country: 'Czech Republic', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Czech Republic (1994)' },
  HU: { country: 'Hungary', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Hungary (1992)' },
  RO: { country: 'Romania', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Romania (1996)' },
  BG: { country: 'Bulgaria', dividend: 0.15, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Bulgaria (1991)' },
  HR: { country: 'Croatia', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Croatia (2002)' },
  UA: { country: 'Ukraine', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Ukraine (1996)' },
  SK: { country: 'Slovakia', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Slovakia (2000)' },
  RS: { country: 'Serbia', dividend: 0.15, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Yugoslavia/Serbia (1987)' },
  MX: { country: 'Mexico', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Mexico (2002)' },
  BR: { country: 'Brazil', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Brazil (unrealized, pending)' },
  PT: { country: 'Portugal', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Portugal (2003)' },
  JO: { country: 'Jordan', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Jordan (1996)' },
  SY: { country: 'Syria', dividend: 0.10, interest: 0.10, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Syria (1997)' },
  TN: { country: 'Tunisia', dividend: 0.10, interest: 0.12, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Tunisia (1992)' },
  MA: { country: 'Morocco', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Morocco (2008)' },
  KH: { country: 'Cambodia', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Cambodia (2024)' },
  LA: { country: 'Laos', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Laos (2014)' },
  MM: { country: 'Myanmar', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Myanmar (2003)' },
  BN: { country: 'Brunei', dividend: 0.15, interest: 0.15, royalty: 0.15, service: 0.10, reference: 'P3B Indonesia-Brunei (2000)' },
  MN: { country: 'Mongolia', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Mongolia (2001)' },
  UZ: { country: 'Uzbekistan', dividend: 0.10, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Uzbekistan (1996)' },
  IR: { country: 'Iran', dividend: 0.07, interest: 0.10, royalty: 0.10, service: 0.10, reference: 'P3B Indonesia-Iran (2004)' },
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
//
// IS_PRODUCTION must be opted into explicitly via MIDTRANS_IS_PRODUCTION=true.
// Defaulting to sandbox prevents accidental real-money transactions when the
// app is deployed to Vercel before a production payment gateway is wired up
// (NODE_ENV is always 'production' on Vercel deployments — too dangerous to
// use as the sole signal).
//
// CLIENT_KEY / SERVER_KEY are intentionally empty strings when unset so the
// billing endpoints' graceful-degrade path can detect "no PG configured" and
// keep PENDING_PAYMENT rows alive instead of crashing.
const isMidtransProduction =
  process.env.MIDTRANS_IS_PRODUCTION === 'true' ||
  process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';

export const MIDTRANS_CONFIG = {
  IS_PRODUCTION: isMidtransProduction,
  CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
  SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  IS_CONFIGURED:
    !!process.env.MIDTRANS_SERVER_KEY && !!process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
};
