import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Billing Phases E2E — Phase B-3 / K-2 / D
 *
 * Covers the three per-surface billing endpoints that were added between
 * Phase K and Phase D, and the graceful-degrade pattern they share when no
 * payment gateway is configured:
 *
 *   1. /api/billing/corporate-plan   (COMPANY only)   → customer_subscription
 *   2. /api/billing/consultant-plan  (EXTERNAL only)  → tax_partner_subscription
 *   3. /api/billing/individual-spt   (INDIVIDUAL)     → billing_transaction
 *
 * Each flow asserts:
 *   - HTTP 200 even without Midtrans credentials
 *   - A PENDING row is created in the expected table
 *   - `snapToken` is either a string (PG configured) OR null with
 *     `snapError` populated (graceful degrade)
 *
 * Prerequisites: seed scripts have been run so the test users exist:
 *   npm run db:seed-test-users
 *   SEED_TARGET=local npx tsx scripts/seed-master-and-external.ts
 *   SEED_TARGET=local npx tsx scripts/seed-company-customer.ts
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface BillingResponse {
  success: boolean;
  data?: {
    subscriptionId?: string;
    transactionId?: string;
    orderId?: string;
    invoiceNumber?: string;
    snapToken?: string | null;
    redirectUrl?: string | null;
    snapError?: string | null;
    amountTotal?: number;
  };
  error?: string;
}

test.describe('Billing — Corporate plan (COMPANY)', () => {
  let companyToken: string;
  const createdSubscriptionIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    companyToken = await loginAs(
      request,
      TEST_USERS.COMPANY_CUSTOMER.email,
      TEST_USERS.COMPANY_CUSTOMER.password,
    );
  });

  test.afterAll(async () => {
    if (createdSubscriptionIds.length > 0) {
      await supabaseAdmin
        .from('customer_subscription')
        .delete()
        .in('id', createdSubscriptionIds);
    }
  });

  test('✅ POST /api/billing/corporate-plan creates PENDING_PAYMENT row + graceful degrades on no PG', async ({ request }) => {
    const res = await request.post('/api/billing/corporate-plan', {
      headers: createAuthHeaders(companyToken),
      data: { planId: 'BASIC', billingCycle: 'MONTHLY' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as BillingResponse;
    expect(body.success).toBe(true);
    expect(body.data?.subscriptionId).toBeTruthy();
    expect(body.data?.orderId).toMatch(/^CORP-BASIC-/);

    // snapToken may be a real token (PG configured) or null (graceful degrade)
    if (body.data?.snapToken === null) {
      expect(body.data.snapError).toBeTruthy();
    } else {
      expect(body.data?.snapToken).toBeTruthy();
    }

    // DB verification: row must be PENDING_PAYMENT and not silently canceled
    const { data: row } = await supabaseAdmin
      .from('customer_subscription')
      .select('id, status, plan_id, midtrans_order_id')
      .eq('id', body.data!.subscriptionId!)
      .single();

    expect(row?.status).toBe('PENDING_PAYMENT');
    expect(row?.plan_id).toBe('BASIC');
    expect(row?.midtrans_order_id).toBe(body.data?.orderId);

    createdSubscriptionIds.push(body.data!.subscriptionId!);
  });

  test('❌ POST /api/billing/corporate-plan rejects INDIVIDUAL customer', async ({ request }) => {
    const individualToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password,
    );

    const res = await request.post('/api/billing/corporate-plan', {
      headers: createAuthHeaders(individualToken),
      data: { planId: 'BASIC', billingCycle: 'MONTHLY' },
    });

    expect([403, 404]).toContain(res.status());
  });
});

test.describe('Billing — Consultant tier (EXTERNAL)', () => {
  let externalToken: string;
  const createdSubscriptionIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    externalToken = await loginAs(
      request,
      TEST_USERS.EXTERNAL_CONSULTANT.email,
      TEST_USERS.EXTERNAL_CONSULTANT.password,
    );
  });

  test.afterAll(async () => {
    if (createdSubscriptionIds.length > 0) {
      await supabaseAdmin
        .from('tax_partner_subscription')
        .delete()
        .in('id', createdSubscriptionIds);
    }
  });

  test('✅ POST /api/billing/consultant-plan creates PENDING_PAYMENT row for external partner', async ({ request }) => {
    const res = await request.post('/api/billing/consultant-plan', {
      headers: createAuthHeaders(externalToken),
      data: { tierId: 'GROWTH', billingCycle: 'MONTHLY' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as BillingResponse;
    expect(body.success).toBe(true);
    expect(body.data?.subscriptionId).toBeTruthy();
    expect(body.data?.orderId).toMatch(/^CONS-GROWTH-/);

    if (body.data?.snapToken === null) {
      expect(body.data.snapError).toBeTruthy();
    }

    const { data: row } = await supabaseAdmin
      .from('tax_partner_subscription')
      .select('id, status, tier_id, tax_partner_id')
      .eq('id', body.data!.subscriptionId!)
      .single();

    expect(row?.status).toBe('PENDING_PAYMENT');
    expect(row?.tier_id).toBe('GROWTH');
    expect(row?.tax_partner_id).toBe(TEST_USERS.EXTERNAL_CONSULTANT.partnerId);

    createdSubscriptionIds.push(body.data!.subscriptionId!);
  });

  test('❌ POST /api/billing/consultant-plan rejects JTC consultant (internal)', async ({ request }) => {
    const jtcToken = await loginAs(
      request,
      TEST_USERS.CONSULTANT.email,
      TEST_USERS.CONSULTANT.password,
    );

    const res = await request.post('/api/billing/consultant-plan', {
      headers: createAuthHeaders(jtcToken),
      data: { tierId: 'GROWTH', billingCycle: 'MONTHLY' },
    });

    // JTC internal consultants are blocked from the EXTERNAL-only endpoint
    expect([403, 404]).toContain(res.status());
  });
});

test.describe('Billing — Individual SPT (INDIVIDUAL)', () => {
  let individualToken: string;
  const createdTransactionIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    individualToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password,
    );
  });

  test.afterAll(async () => {
    if (createdTransactionIds.length > 0) {
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .in('id', createdTransactionIds);
    }
  });

  test('✅ POST /api/billing/individual-spt creates PENDING billing_transaction with VAT-inclusive total', async ({ request }) => {
    const res = await request.post('/api/billing/individual-spt', {
      headers: createAuthHeaders(individualToken),
      data: { sptType: 'SPT_1770S' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as BillingResponse;
    expect(body.success).toBe(true);
    expect(body.data?.transactionId).toBeTruthy();
    expect(body.data?.invoiceNumber).toMatch(/^INV-IND-/);
    // Rp200k base + 11% VAT = Rp222k
    expect(body.data?.amountTotal).toBe(222_000);

    if (body.data?.snapToken === null) {
      expect(body.data.snapError).toBeTruthy();
    }

    const { data: row } = await supabaseAdmin
      .from('billing_transaction')
      .select('id, payment_status, service_type, amount_total, metadata')
      .eq('id', body.data!.transactionId!)
      .single();

    expect(row?.payment_status).toBe('PENDING');
    expect(row?.service_type).toBe('TAX_FILING');
    expect(row?.amount_total).toBe(222_000);
    expect((row?.metadata as { sptType?: string })?.sptType).toBe('SPT_1770S');

    createdTransactionIds.push(body.data!.transactionId!);
  });

  test('✅ Returns catalog of 3 plans on GET', async ({ request }) => {
    const res = await request.get('/api/billing/individual-spt', {
      headers: createAuthHeaders(individualToken),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.plans).toHaveLength(3);
    expect(body.data.plans.map((p: { id: string }) => p.id)).toEqual([
      'SPT_1770SS',
      'SPT_1770S',
      'SPT_1770',
    ]);
  });

  test('❌ Rejects unknown sptType with 400', async ({ request }) => {
    const res = await request.post('/api/billing/individual-spt', {
      headers: createAuthHeaders(individualToken),
      data: { sptType: 'SPT_INVALID' },
    });

    expect(res.status()).toBe(400);
  });
});
