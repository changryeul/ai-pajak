/**
 * Billing Service
 *
 * Handles subscription management, invoicing, and payment processing
 */

import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { loggers } from '@/lib/logger';
import {
  Subscription,
  Invoice,
  PaymentRecord,
  UsageMetrics,
  SubscriptionPlan,
  BillingCycle,
  PRICING_PLANS,
} from './types';

// Lazy-loaded admin client for subscription management (bypasses RLS)

let _adminClient: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

/**
 * Get customer subscription
 */
export async function getSubscription(customerId: string): Promise<Subscription | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('subscription')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return mapSubscriptionFromDb(data);
}

/**
 * Create or update subscription
 */
export async function createSubscription(params: {
  customerId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
}): Promise<Subscription | null> {
  const now = new Date();
  const periodEnd = new Date();
  if (params.billingCycle === 'MONTHLY') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  // Get price based on plan
  const plan = PRICING_PLANS.find((p) => p.id === params.plan);
  const price = plan
    ? params.billingCycle === 'MONTHLY'
      ? plan.monthlyPrice
      : plan.yearlyPrice
    : 0;

  // Deactivate any existing active subscription first
  await getSupabaseAdmin()
    .from('subscription')
    .update({ is_active: false, updated_at: now.toISOString() })
    .eq('customer_id', params.customerId)
    .eq('is_active', true);

  // Use admin client to bypass RLS for subscription management
  const { data, error } = await getSupabaseAdmin()
    .from('subscription')
    .insert({
      customer_id: params.customerId,
      plan_type: params.plan,
      billing_cycle: params.billingCycle,
      price,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    loggers.billing.error({ err: error }, 'Failed to create subscription');
    return null;
  }

  return mapSubscriptionFromDb(data);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<boolean> {
  const now = new Date().toISOString();

  if (immediately) {
    const { error } = await getSupabaseAdmin()
      .from('subscription')
      .update({
        is_active: false,
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', subscriptionId);

    return !error;
  } else {
    // Set cancelled_at to period end date
    const { data: sub } = await getSupabaseAdmin()
      .from('subscription')
      .select('current_period_end')
      .eq('id', subscriptionId)
      .single();

    const { error } = await getSupabaseAdmin()
      .from('subscription')
      .update({
        cancelled_at: sub?.current_period_end || now,
        updated_at: now,
      })
      .eq('id', subscriptionId);

    return !error;
  }
}

/**
 * Get customer invoices
 */
export async function getInvoices(
  customerId: string,
  options?: { limit?: number; offset?: number }
): Promise<Invoice[]> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  let query = supabase
    .from('invoice')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    loggers.billing.error({ err: error }, 'Failed to fetch invoices');
    return [];
  }

  return data.map(mapInvoice);
}

/**
 * Get single invoice
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('invoice')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapInvoice(data);
}

/**
 * Create invoice for subscription
 */
export async function createInvoice(params: {
  customerId: string;
  subscriptionId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
}): Promise<Invoice | null> {
  const plan = PRICING_PLANS.find((p) => p.id === params.plan);
  if (!plan) {
    return null;
  }

  const amount = params.billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
  const tax = Math.round(amount * 0.11); // 11% PPN (Indonesian VAT)
  const total = amount + tax;

  // Generate invoice number
  const date = new Date();
  const invoiceNumber = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // 7 days to pay

  const items = [
    {
      description: `${plan.name} Plan - ${params.billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly'} Subscription`,
      quantity: 1,
      unitPrice: amount,
      amount: amount,
    },
  ];

  const { data, error } = await getSupabaseAdmin()
    .from('invoice')
    .insert({
      customer_id: params.customerId,
      subscription_id: params.subscriptionId,
      invoice_number: invoiceNumber,
      status: 'PENDING',
      amount,
      tax,
      total,
      currency: 'IDR',
      due_date: dueDate.toISOString(),
      items,
    })
    .select()
    .single();

  if (error) {
    loggers.billing.error({ err: error }, 'Failed to create invoice');
    return null;
  }

  return mapInvoice(data);
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: string,
  transactionId?: string
): Promise<boolean> {
  const { error } = await getSupabaseAdmin()
    .from('invoice')
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  if (error) {
    return false;
  }

  // Record payment
  const invoice = await getInvoice(invoiceId);
  if (invoice) {
    await getSupabaseAdmin().from('payment').insert({
      invoice_id: invoiceId,
      amount: invoice.total,
      currency: invoice.currency,
      method: 'BANK_TRANSFER',
      status: 'COMPLETED',
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
    });
  }

  return true;
}

/**
 * Get payment history
 */
export async function getPaymentHistory(
  customerId: string
): Promise<PaymentRecord[]> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('payment')
    .select('*, invoice!inner(customer_id)')
    .eq('invoice.customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    loggers.billing.error({ err: error }, 'Failed to fetch payments');
    return [];
  }

  return data.map((record) => ({
    id: record.id,
    invoiceId: record.invoice_id,
    amount: record.amount,
    currency: record.currency,
    method: record.method,
    status: record.status,
    transactionId: record.transaction_id,
    paidAt: record.paid_at,
    createdAt: record.created_at,
  }));
}

/**
 * Get usage metrics for current period
 */
export async function getUsageMetrics(customerId: string): Promise<UsageMetrics> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Count tax filings
  const { count: filingCount } = await supabase
    .from('tax_filing')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  // Count documents processed
  const { count: docCount } = await supabase
    .from('document')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  // Sum storage used (in bytes, convert to MB)
  const { data: storageData } = await supabase
    .from('document')
    .select('file_size')
    .eq('customer_id', customerId);

  const totalStorageBytes = storageData?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;
  const storageUsedMB = Math.round(totalStorageBytes / (1024 * 1024));

  return {
    taxFilings: filingCount || 0,
    documentsProcessed: docCount || 0,
    storageUsedMB,
    period: `${periodStart.toLocaleDateString('id-ID')} - ${periodEnd.toLocaleDateString('id-ID')}`,
  };
}

/**
 * Map database subscription to type
 */
function mapSubscriptionFromDb(data: {
  id: string;
  customer_id: string;
  plan_type: string;
  billing_cycle: string | null;
  price: number;
  current_period_start: string | null;
  current_period_end: string | null;
  is_active: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}): Subscription {
  // Determine status based on is_active and cancelled_at
  let status: Subscription['status'] = 'ACTIVE';
  if (!data.is_active) {
    status = 'CANCELED';
  } else if (data.cancelled_at) {
    status = 'CANCELING';
  }

  return {
    id: data.id,
    customerId: data.customer_id,
    plan: data.plan_type as SubscriptionPlan,
    status,
    billingCycle: (data.billing_cycle || 'MONTHLY') as BillingCycle,
    currentPeriodStart: data.current_period_start || data.created_at,
    currentPeriodEnd: data.current_period_end || data.created_at,
    cancelAtPeriodEnd: !!data.cancelled_at && data.is_active,
    trialEnd: undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Map database invoice to type
 */
function mapInvoice(data: {
  id: string;
  customer_id: string;
  subscription_id?: string;
  invoice_number: string;
  status: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  due_date: string;
  paid_at?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  created_at: string;
}): Invoice {
  return {
    id: data.id,
    customerId: data.customer_id,
    subscriptionId: data.subscription_id,
    invoiceNumber: data.invoice_number,
    status: data.status as Invoice['status'],
    amount: data.amount,
    tax: data.tax,
    total: data.total,
    currency: data.currency,
    dueDate: data.due_date,
    paidAt: data.paid_at,
    items: data.items,
    createdAt: data.created_at,
  };
}
