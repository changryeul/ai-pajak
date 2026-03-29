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
  income_type?: 'RENTAL' | 'CONSTRUCTION' | 'SHIP' | 'AIRCRAFT';
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
