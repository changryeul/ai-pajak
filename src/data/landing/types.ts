export type SupportedLocale = 'ko' | 'en' | 'id';

export type Persona = {
  label: string;
  icon: string;
  title: string;
  subtitle: string;
  readiness: number;
  missing: string[];
  next: string;
};

export type LandingModule = {
  mark: string;
  title: string;
  short: string;
  detail: string;
  customerPromise: string;
  primaryMetric: string;
  primaryLabel: string;
  statusText: string;
  previewCards: Array<[string, string]>;
  customerView: string[];
  outputs: string[];
  process: Array<[string, string, string]>;
};

export type PlanStorage = {
  /** Storage allowance, e.g. "500MB / 신고연도", "30GB / 월" */
  allowance: string;
  /** Core retention copy describing what's kept inside the allowance. */
  retentionCopy: string;
  /** Raw-file scope copy listing the types of source files retained. */
  rawFileCopy: string;
  /** Overage pricing (Active + Archive). */
  overage: string;
  /** Threshold-alert policy (80% / 100%). */
  alertPolicy: string;
};

export type LandingPlan = {
  id: string;
  group: string;
  badge: string;
  typeLabel: string;
  price: string;
  vat?: string;
  description: string;
  meta: string[];
  items: string[];
  criteria: string[];
  /** 2026-05-22 PDF: storage & evidence-retention panel per plan. */
  storage?: PlanStorage;
  /** Plan-specific 안내 copy (overrides the global pricingInfo when set). */
  info?: string;
};

export type TrustIndicator = {
  title: string;
  desc: string;
};

export type FooterCopy = {
  brand: string;
  tagline: string;
  jtcNote: string;
  companyHeading: string;
  companyName: string;
  companyLocation: string;
  contactHeading: string;
  contactEmail: string;
  contactPricingLabel: string;
  legalHeading: string;
  privacyPolicy: string;
  termsOfService: string;
  copyright: string;
};

export type LandingContent = {
  nav: { product: string; start: string; difference: string; faq: string };
  login: string;
  // 2026-06-28: 가입 진입 CTA — header / hero / start section.
  signupCta: string;
  signupIndividualCta: string;
  signupCompanyCta: string;
  viewPricing: string;
  chips: string;
  heroTop: string;
  heroMain: string;
  heroSub: string;
  heroDesc: string;
  trustBaseTitle: string;
  trustBaseDesc: string;
  trustIndicators: TrustIndicator[];
  footer: FooterCopy;
  readiness: string;
  missing: string;
  next: string;
  personas: { personal: Persona; corporate: Persona };
  cards: Array<[string, string]>;
  trustTitle: string;
  trustDesc: string;
  trustItems: string[];
  coreDiff: string;
  advisoryKicker: string;
  taxTitle: string;
  taxDesc: string;
  taxCards: Array<[string, string]>;
  advisoryTitle: string;
  advisoryDesc: string;
  advisoryCards: Array<[string, string]>;
  serviceFlow: string;
  productTitle: string;
  productDesc: string;
  moduleStep: string;
  coreGuide: string;
  customerView: string;
  outputs: string;
  requiredDocs: string;
  startKicker: string;
  startTitle: string;
  startDesc: string;
  personalBtn: string;
  corporateBtn: string;
  methodTitle: string;
  methods: string[];
  guide: string;
  startNote: string;
  requirements: { personal: Array<[string, string]>; corporate: Array<[string, string]> };
  compKicker: string;
  compTitle: string;
  compDesc: string;
  columns: string[];
  rows: string[][];
  pricingKicker: string;
  pricingTitle: string;
  pricingDesc: string;
  pricingListTitle: string;
  chooseService: string;
  pricingListDesc: string;
  selectedPlan: string;
  included: string;
  criteria: string;
  pricingInfo: string;
  pricingButton: string;
  storageHeading: string;
  storageAllowanceLabel: string;
  storageOverageLabel: string;
  groups: string[];
  faqs: Array<[string, string]>;
  finalTitle: string;
  finalDesc: string;
  finalButton: string;
  footerCompare: string;
  footerPricing: string;
  footerDocs: string;
  modules: LandingModule[];
  pricing: LandingPlan[];
};
