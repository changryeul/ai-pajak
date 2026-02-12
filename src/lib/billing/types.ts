/**
 * Billing & Subscription Types
 */

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'CANCELING' | 'TRIALING';

export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'VIRTUAL_ACCOUNT';

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';

export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface PlanFeatures {
  maxTaxFilings: number;
  maxDocumentsPerMonth: number;
  maxStorageGB: number;
  ocrEnabled: boolean;
  prioritySupport: boolean;
  customReports: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: PlanFeatures;
  popular?: boolean;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
}

export interface UsageMetrics {
  taxFilings: number;
  documentsProcessed: number;
  storageUsedMB: number;
  period: string;
}

/**
 * Pricing plans definition
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'FREE',
    name: 'Free',
    description: 'Get started with basic features',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'IDR',
    features: {
      maxTaxFilings: 3,
      maxDocumentsPerMonth: 10,
      maxStorageGB: 1,
      ocrEnabled: false,
      prioritySupport: false,
      customReports: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: 'BASIC',
    name: 'Basic',
    description: 'Perfect for individual taxpayers',
    monthlyPrice: 199000,
    yearlyPrice: 1990000,
    currency: 'IDR',
    features: {
      maxTaxFilings: 12,
      maxDocumentsPerMonth: 50,
      maxStorageGB: 5,
      ocrEnabled: true,
      prioritySupport: false,
      customReports: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Best for small businesses',
    monthlyPrice: 499000,
    yearlyPrice: 4990000,
    currency: 'IDR',
    features: {
      maxTaxFilings: 50,
      maxDocumentsPerMonth: 200,
      maxStorageGB: 25,
      ocrEnabled: true,
      prioritySupport: true,
      customReports: true,
      apiAccess: false,
      whiteLabel: false,
    },
    popular: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 1999000,
    yearlyPrice: 19990000,
    currency: 'IDR',
    features: {
      maxTaxFilings: -1, // Unlimited
      maxDocumentsPerMonth: -1, // Unlimited
      maxStorageGB: 100,
      ocrEnabled: true,
      prioritySupport: true,
      customReports: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
];

/**
 * Format currency for Indonesian Rupiah
 */
export function formatCurrency(amount: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
