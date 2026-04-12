import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Custom Pricing Quote E2E — Phase K-3 + E
 *
 * Full master → customer handshake:
 *   1. Master creates a DRAFT quote for a COMPANY customer
 *   2. Master flips the quote to SENT
 *   3. Customer (the COMPANY) retrieves the quote via
 *      /api/billing/custom-pricing (their own SENT queue)
 *   4. Customer accepts → status ACCEPTED + customer_subscription with
 *      plan_id=CUSTOM and custom_pricing_quote_id linkage
 *   5. Cross-customer access is blocked (a different customer cannot see
 *      or act on the quote)
 *
 * Also exercises `recordAudit` — both the CREATE and ACCEPT paths should
 * write BILLING_CREATE / BILLING_UPDATE rows to audit_log.
 *
 * Prerequisites:
 *   npm run db:seed-test-users
 *   SEED_TARGET=local npx tsx scripts/seed-master-and-external.ts
 *   SEED_TARGET=local npx tsx scripts/seed-company-customer.ts
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface QuoteResponse {
  success: boolean;
  data?: {
    id?: string;
    quoteId?: string;
    status?: string;
    sent_at?: string;
    accepted_at?: string;
    subscriptionId?: string | null;
    nextStep?: string;
    quotes?: Array<{ id: string; status: string }>;
  };
  error?: string;
}

test.describe('Custom pricing quote — master→customer handshake', () => {
  let masterToken: string;
  let companyToken: string;
  let customerCreatedQuoteId: string | null = null;
  let createdSubscriptionId: string | null = null;

  test.beforeAll(async ({ request }) => {
    masterToken = await loginAs(
      request,
      TEST_USERS.TAX_OPERATOR_MASTER.email,
      TEST_USERS.TAX_OPERATOR_MASTER.password,
    );
    companyToken = await loginAs(
      request,
      TEST_USERS.COMPANY_CUSTOMER.email,
      TEST_USERS.COMPANY_CUSTOMER.password,
    );
  });

  test.afterAll(async () => {
    // Clean up any leftover rows from this test
    if (createdSubscriptionId) {
      await supabaseAdmin.from('customer_subscription').delete().eq('id', createdSubscriptionId);
    }
    if (customerCreatedQuoteId) {
      await supabaseAdmin.from('custom_pricing_quote').delete().eq('id', customerCreatedQuoteId);
    }
  });

  test('✅ full handshake — master creates → SENT → customer accepts → subscription auto-materialized', async ({ request }) => {
    // ── Step 1: Master creates a DRAFT quote for COMPANY customer ──
    const createRes = await request.post('/api/admin/master/custom-pricing', {
      headers: createAuthHeaders(masterToken),
      data: {
        customerId: TEST_USERS.COMPANY_CUSTOMER.customerId,
        quoteTitle: 'E2E Custom Corporate Plan',
        quoteDescription: 'E2E test — Pro 한도 초과 법인 커스텀',
        serviceType: 'CORPORATE_PLAN',
        monthlyPriceIdr: 6_000_000,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        usageEmployees: 1500,
      },
    });
    expect(createRes.status()).toBe(200);
    const createBody = (await createRes.json()) as QuoteResponse;
    expect(createBody.success).toBe(true);
    expect(createBody.data?.id).toBeTruthy();
    customerCreatedQuoteId = createBody.data!.id!;

    // ── Step 2: Master flips DRAFT → SENT ──
    const sendRes = await request.patch('/api/admin/master/custom-pricing', {
      headers: createAuthHeaders(masterToken),
      data: { id: customerCreatedQuoteId, status: 'SENT' },
    });
    expect(sendRes.status()).toBe(200);
    const sendBody = (await sendRes.json()) as QuoteResponse;
    expect(sendBody.data?.status).toBe('SENT');
    expect(sendBody.data?.sent_at).toBeTruthy();

    // ── Step 3: Customer fetches own quotes ──
    const listRes = await request.get('/api/billing/custom-pricing', {
      headers: createAuthHeaders(companyToken),
    });
    expect(listRes.status()).toBe(200);
    const listBody = (await listRes.json()) as QuoteResponse;
    const visible = listBody.data?.quotes?.find((q) => q.id === customerCreatedQuoteId);
    expect(visible?.status).toBe('SENT');

    // ── Step 4: Customer accepts ──
    const acceptRes = await request.post('/api/billing/custom-pricing', {
      headers: createAuthHeaders(companyToken),
      data: { quoteId: customerCreatedQuoteId, action: 'accept' },
    });
    expect(acceptRes.status()).toBe(200);
    const acceptBody = (await acceptRes.json()) as QuoteResponse;
    expect(acceptBody.success).toBe(true);
    expect(acceptBody.data?.status).toBe('ACCEPTED');
    // CORPORATE_PLAN → subscription materialized
    expect(acceptBody.data?.subscriptionId).toBeTruthy();
    createdSubscriptionId = acceptBody.data?.subscriptionId ?? null;

    // ── DB verification ──
    const { data: quoteRow } = await supabaseAdmin
      .from('custom_pricing_quote')
      .select('status, accepted_at')
      .eq('id', customerCreatedQuoteId)
      .single();
    expect(quoteRow?.status).toBe('ACCEPTED');
    expect(quoteRow?.accepted_at).toBeTruthy();

    const { data: subRow } = await supabaseAdmin
      .from('customer_subscription')
      .select('id, status, plan_id, price_idr, custom_pricing_quote_id')
      .eq('id', createdSubscriptionId!)
      .single();
    expect(subRow?.status).toBe('PENDING_PAYMENT');
    expect(subRow?.plan_id).toBe('CUSTOM');
    expect(subRow?.price_idr).toBe(6_000_000);
    expect(subRow?.custom_pricing_quote_id).toBe(customerCreatedQuoteId);
  });

  test('❌ cross-customer — different customer cannot see or accept the quote', async ({ request }) => {
    if (!customerCreatedQuoteId) {
      test.skip();
      return;
    }
    // First create + send a fresh quote scoped to COMPANY_CUSTOMER
    const createRes = await request.post('/api/admin/master/custom-pricing', {
      headers: createAuthHeaders(masterToken),
      data: {
        customerId: TEST_USERS.COMPANY_CUSTOMER.customerId,
        quoteTitle: 'E2E cross-tenant guard',
        serviceType: 'CORPORATE_PLAN',
        monthlyPriceIdr: 4_000_000,
      },
    });
    const createBody = (await createRes.json()) as QuoteResponse;
    const crossQuoteId = createBody.data!.id!;
    await request.patch('/api/admin/master/custom-pricing', {
      headers: createAuthHeaders(masterToken),
      data: { id: crossQuoteId, status: 'SENT' },
    });

    try {
      // Login as the INDIVIDUAL customer.test and try to accept the
      // quote that belongs to the COMPANY customer
      const individualToken = await loginAs(
        request,
        TEST_USERS.CUSTOMER.email,
        TEST_USERS.CUSTOMER.password,
      );

      const acceptRes = await request.post('/api/billing/custom-pricing', {
        headers: createAuthHeaders(individualToken),
        data: { quoteId: crossQuoteId, action: 'accept' },
      });
      expect([403, 404]).toContain(acceptRes.status());

      // And the list endpoint should not show the quote to them
      const listRes = await request.get('/api/billing/custom-pricing', {
        headers: createAuthHeaders(individualToken),
      });
      const listBody = (await listRes.json()) as QuoteResponse;
      expect(listBody.data?.quotes?.some((q) => q.id === crossQuoteId)).toBeFalsy();
    } finally {
      await supabaseAdmin.from('custom_pricing_quote').delete().eq('id', crossQuoteId);
    }
  });

  test('❌ non-master cannot call POST /api/admin/master/custom-pricing', async ({ request }) => {
    const customerToken = await loginAs(
      request,
      TEST_USERS.COMPANY_CUSTOMER.email,
      TEST_USERS.COMPANY_CUSTOMER.password,
    );
    const res = await request.post('/api/admin/master/custom-pricing', {
      headers: createAuthHeaders(customerToken),
      data: {
        customerId: TEST_USERS.COMPANY_CUSTOMER.customerId,
        quoteTitle: 'should be blocked',
        serviceType: 'CORPORATE_PLAN',
        monthlyPriceIdr: 1_000_000,
      },
    });
    expect([401, 403]).toContain(res.status());
  });
});
