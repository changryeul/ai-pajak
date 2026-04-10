// AI PAJAK - Type Definitions

import { Locale, TaxType, UserType, SubscriptionPlan, PTKPCategory } from '@/config/constants';

// User types
export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  npwp?: string;
  nik?: string;
  user_type: UserType;
  subscription_plan: SubscriptionPlan;
  company_name?: string;
  company_npwp?: string;
  address?: Address;
  preferred_locale: Locale;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
}

// Tax Document types
export interface TaxDocument {
  id: string;
  user_id: string;
  type: TaxType;
  tax_period: string; // YYYY-MM or YYYY
  status: DocumentStatus;
  data: Record<string, unknown>;
  calculated_tax: number;
  submitted_at?: string;
  djp_reference?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus =
  | 'draft'
  | 'pending_review'
  | 'ready_to_submit'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'needs_revision';

// PPh 21 specific types
export interface PPh21Data {
  employee_name: string;
  employee_npwp: string;
  employee_nik: string;
  ptkp_category: PTKPCategory;
  gross_salary: number;
  jht_employee: number;
  jp_employee: number;
  position_allowance: number;
  other_deductions: number;
  tax_period_start: string;
  tax_period_end: string;
  /** If false/undefined and no NPWP, 20% surcharge applies per Pasal 21(5a) UU PPh */
  has_npwp?: boolean;
  /** Month number (1-12) for TER calculation. 12 = December reconciliation. */
  month?: number;
  /** Cumulative PPh 21 tax paid Jan through previous month (for December reconciliation) */
  cumulative_tax_paid?: number;
}

export interface PPh21Calculation {
  gross_income: number;
  total_deductions: number;
  net_income: number;
  ptkp: number;
  taxable_income: number;
  tax_amount: number;
  tax_breakdown: TaxBracketResult[];
  /** True if 20% NPWP surcharge was applied (Pasal 21(5a)) */
  npwp_surcharge_applied?: boolean;
  /** Tax before surcharge (only set when surcharge applied) */
  tax_before_surcharge?: number;
}

export interface TaxBracketResult {
  bracket_min: number;
  bracket_max: number;
  rate: number;
  taxable_amount: number;
  tax: number;
}

/** PPh 21 TER (Tarif Efektif Rata-rata) monthly calculation result */
export interface PPh21TERCalculation {
  gross_monthly: number;
  ter_category: 'A' | 'B' | 'C';
  ter_rate: number;
  tax_amount: number;
  is_december_reconciliation: boolean;
  /** Only populated for December (month 12) */
  annual_reconciliation?: {
    annual_tax_pasal17: number;
    cumulative_jan_nov_tax: number;
    december_adjustment: number;
  };
  npwp_surcharge_applied: boolean;
}

// PPh 23 specific types
export interface PPh23Data {
  transaction_type: 'dividend' | 'interest' | 'royalty' | 'prize' | 'rent' | 'service';
  gross_amount: number;
  recipient_name: string;
  recipient_npwp: string;
  transaction_date: string;
  description: string;
  /** If false and no NPWP, 100% surcharge applies per Pasal 23(1a) UU PPh */
  has_npwp?: boolean;
  /** e-Bupot service subtype code (PMK 141/2015), required for 'service' type e-Bupot reporting */
  service_subtype?: string;
}

// PPh 22 specific types (Domestic Transaction Withholding Tax)
export interface PPh22Data {
  transaction_type: string; // GOVERNMENT_PROCUREMENT, CEMENT, STEEL, AUTOMOTIVE, etc.
  gross_amount: number;
  payer_name?: string;
  payer_npwp?: string;
  has_npwp?: boolean;
  transaction_date?: string;
  description?: string;
}

export interface PPh22Calculation {
  gross_amount: number;
  base_rate: number;
  applied_rate: number;
  tax_amount: number;
  net_amount: number;
  npwp_surcharge_applied: boolean;
  transaction_label: string;
  legal_basis: string;
  /** Most PPh 22 is creditable against annual tax */
  is_creditable: boolean;
}

// PPh 26 specific types (Non-Resident Withholding Tax)
export interface PPh26Data {
  income_type: 'dividend' | 'interest' | 'royalty' | 'service' | 'salary' | 'pension' | 'insurance' | 'other';
  gross_amount: number;
  recipient_name: string;
  /** Country code (ISO 3166-1 alpha-2) of the recipient */
  recipient_country: string;
  /** If true, treaty rate applies based on recipient_country */
  apply_treaty?: boolean;
  transaction_date: string;
  description?: string;
}

export interface PPh26Calculation {
  gross_amount: number;
  /** Standard domestic rate (20%) */
  standard_rate: number;
  /** Treaty rate if applicable */
  treaty_rate?: number;
  /** Actually applied rate */
  applied_rate: number;
  tax_amount: number;
  net_amount: number;
  /** Treaty country name if treaty applied */
  treaty_country?: string;
  /** P3B (tax treaty) number */
  treaty_reference?: string;
  is_treaty_applied: boolean;
}

// PPh Final specific types
export interface PPhFinalData {
  scheme: 'UMKM' | 'PASAL42';
  gross_amount: number;
  // UMKM params
  business_start_date?: string;
  entity_type?: 'INDIVIDUAL' | 'PT' | 'CV' | 'FIRMA' | 'KOPERASI';
  klu_code?: string;
  // Pasal 4(2) params
  income_type?: 'RENTAL' | 'CONSTRUCTION' | 'CONSTRUCTION_WORK' | 'CONSTRUCTION_CONSULT' | 'CONSTRUCTION_INTEGRATED' | 'SHIP' | 'AIRCRAFT';
  /** SBU grade for construction services (PP 9/2022) */
  sbu_grade?: 'SMALL' | 'MEDIUM_LARGE' | 'HAS_SBU' | 'NONE';
}

// Tax Resolution Engine types
export type ServiceCategory =
  | 'EMPLOYMENT' | 'SERVICE' | 'RENTAL' | 'CONSTRUCTION'
  | 'DIVIDEND' | 'INTEREST' | 'ROYALTY' | 'IMPORT' | 'SHIPPING' | 'OTHER';

export type ConstructionType = 'WORK' | 'CONSULT' | 'INTEGRATED';
export type QualificationGrade = 'SMALL' | 'MEDIUM_LARGE' | 'QUALIFIED' | 'NONE';
export type RecipientType = 'RESIDENT' | 'NON_RESIDENT';
export type ResolvedTaxType = 'PPh21' | 'PPh23' | 'PPh26' | 'PPh4_2' | 'PPh22' | 'PPh15' | 'PPN';

export interface TransactionContext {
  grossAmount: number;
  transactionDate: string;
  description?: string;

  serviceCategory: ServiceCategory;
  kbliCode?: string;

  /** Construction details (when serviceCategory === 'CONSTRUCTION') */
  constructionType?: ConstructionType;
  qualification?: QualificationGrade;

  /** Recipient/vendor info */
  recipientType: RecipientType;
  recipientNpwp?: string;
  recipientCountry?: string;
  hasCertificateOfDomicile?: boolean;

  /** Recipient legal form — true for entity (PT/CV/corporation), false for individual */
  recipientIsEntity?: boolean;

  /** Ownership/relationship */
  isRelatedParty?: boolean;
  /** Building management case: vendor is also the property owner */
  vendorIsPropertyOwner?: boolean;

  /**
   * Phase 3 — dividend-specific
   * shareholdingPct: counterparty's shareholding in the paying company (0~100)
   * isBeneficialOwner: true if not a nominee (required for treaty benefits)
   * receivesReinvestedDividend: true if individual recipient reinvests domestically (PMK 18/2021 exemption)
   * hasDgtForm: true if DGT Form 1/2 was submitted (required for non-resident treaty)
   */
  shareholdingPct?: number;
  isBeneficialOwner?: boolean;
  receivesReinvestedDividend?: boolean;
  hasDgtForm?: boolean;

  /**
   * Phase 3 — rental sub-type
   * BUILDING_LAND → PPh 4(2) Final 10%
   * MACHINE / EQUIPMENT / VEHICLE → PPh 23 2%
   */
  rentalAssetType?: 'BUILDING_LAND' | 'MACHINE' | 'VEHICLE' | 'OTHER';

  /**
   * Phase 3 — interest sub-type
   * BANK_DEPOSIT → PPh Final 20%
   * LOAN / BOND / OTHER → PPh 23 15%
   */
  interestSource?: 'BANK_DEPOSIT' | 'LOAN' | 'BOND' | 'OTHER';
}

export interface TaxResolution {
  taxType: ResolvedTaxType;
  rate: number;
  taxAmount: number;
  netAmount: number;
  isFinal: boolean;
  npwpSurchargeApplied: boolean;
  reason: string;
  legalBasis: string;
  rulePriority: number;
  ruleId: string;
  alternativeRules?: Array<{ ruleId: string; reason: string }>;
}

// PPN specific types
export interface PPNData {
  transaction_type: 'sale' | 'purchase';
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_npwp: string;
  dpp: number; // Dasar Pengenaan Pajak
  ppn_amount: number;
  items: PPNItem[];
}

export interface PPNItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// SPT Tahunan types
export interface SPTTahunanData {
  tax_year: number;
  form_type: '1770' | '1770S' | '1770SS' | '1771';
  income_sources: IncomeSource[];
  deductions: Deduction[];
  prepaid_taxes: PrepaidTax[];
}

export interface IncomeSource {
  type: string;
  source_name: string;
  amount: number;
  tax_withheld: number;
}

export interface Deduction {
  type: string;
  description: string;
  amount: number;
}

export interface PrepaidTax {
  type: string;
  period: string;
  amount: number;
}

// OCR Result types
export interface OCRResult {
  success: boolean;
  document_type: string;
  confidence: number;
  extracted_data: Record<string, unknown>;
  raw_text: string;
  processing_time_ms: number;
}

// Subscription types
export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  current_period_start: string;
  current_period_end: string;
  midtrans_subscription_id?: string;
  created_at: string;
}

// Payment types
export interface Payment {
  id: string;
  user_id: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  midtrans_transaction_id?: string;
  payment_method?: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard stats
export interface DashboardStats {
  total_documents: number;
  pending_submissions: number;
  total_tax_paid: number;
  upcoming_deadlines: Deadline[];
  recent_activity: ActivityLog[];
}

export interface Deadline {
  tax_type: TaxType;
  period: string;
  due_date: string;
  status: 'upcoming' | 'overdue' | 'completed';
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  created_at: string;
}
