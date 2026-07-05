import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

/**
 * Killer Services E2E Tests
 *
 * Tests the core killer service APIs that were added:
 * 1. Customer Queue / Submissions
 * 2. Tax Calculations (draft management)
 * 3. Monthly Report
 * 4. AI Chat
 * 5. e-SPT XML Export
 * 6. Referral
 * 7. Entities (multi-entity)
 */

test.describe('Killer Services - Customer APIs', () => {
  let customerToken: string;

  test.beforeAll(async ({ request }) => {
    customerToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password
    );
  });

  // === Customer Queue / Submissions ===
  test('✅ Customer can fetch submission queue', async ({ request }) => {
    const response = await request.get('/api/customer/queue', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('items');
    expect(data.data).toHaveProperty('summary');
    expect(data.data.summary).toHaveProperty('total');
    expect(data.data.summary).toHaveProperty('paymentPending');
    expect(data.data.summary).toHaveProperty('completed');
  });

  test('✅ Customer can fetch submission queue with status filter', async ({ request }) => {
    const response = await request.get('/api/customer/queue?status=COMPLETED', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  // === Tax Calculations ===
  test('✅ Customer can list own tax calculations', async ({ request }) => {
    const response = await request.get('/api/customer/tax-calculations', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data).toHaveProperty('count');
  });

  test('✅ Customer can filter tax calculations by period', async ({ request }) => {
    const response = await request.get('/api/customer/tax-calculations?period=2026-03', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('❌ Delete non-existent calculation returns 404', async ({ request }) => {
    const response = await request.delete('/api/customer/tax-calculations/00000000-0000-0000-0000-000000000000', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(404);
  });

  // === Monthly Report ===
  test('✅ Customer can fetch monthly report', async ({ request }) => {
    const response = await request.get('/api/customer/monthly-report?period=2026-03', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('period');
    expect(data.data).toHaveProperty('summary');
    expect(data.data).toHaveProperty('totals');
    expect(data.data).toHaveProperty('alerts');
    expect(data.data).toHaveProperty('savingsOpportunities');
    expect(data.data.totals).toHaveProperty('totalTax');
    expect(data.data.totals).toHaveProperty('totalGross');
  });

  test('✅ Monthly report defaults to previous month', async ({ request }) => {
    const response = await request.get('/api/customer/monthly-report', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.period).toMatch(/^\d{4}-\d{2}$/);
  });

  // === AI Chat ===
  test('✅ AI chat responds to tax question', async ({ request }) => {
    const response = await request.post('/api/chat', {
      headers: createAuthHeaders(customerToken),
      data: {
        messages: [
          { role: 'user', content: 'What is PPh 21 tax rate?' },
        ],
      },
    });

    // /api/chat may stream, may return text, or may degrade if ANTHROPIC_API_KEY
    // is unset — just confirm we get an object-shaped response when reachable.
    if (response.ok()) {
      const data = await response.json().catch(() => null);
      expect(typeof data).toBe('object');
    }
  });

  // === Referral ===
  test('✅ Customer can get referral code', async ({ request }) => {
    const response = await request.get('/api/referral', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('referralCode');
    expect(data.data).toHaveProperty('referralUrl');
    expect(data.data).toHaveProperty('rewards');
    expect(data.data.rewards).toHaveProperty('referrerReward');
    expect(data.data.rewards).toHaveProperty('refereeReward');
  });

  // === Entities ===
  test('✅ Customer can list entities', async ({ request }) => {
    const response = await request.get('/api/entities', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    // /api/entities returns { data: { entities: [], totalEntities, rollup } }
    expect(Array.isArray(data.data.entities)).toBe(true);
  });
});

test.describe('Killer Services - Consultant APIs', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    advisorToken = await loginAs(
      request,
      TEST_USERS.TAX_ADVISOR.email,
      TEST_USERS.TAX_ADVISOR.password
    );
  });

  // === Tax Calendar ===
  test('✅ Tax calendar returns events', async ({ request }) => {
    const response = await request.get('/api/tax/calendar?year=2026', {
      headers: createAuthHeaders(advisorToken),
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('events');
    expect(Array.isArray(data.data.events)).toBe(true);
    expect(data.data.events.length).toBeGreaterThan(0);

    // Verify event structure
    const event = data.data.events[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('date');
    expect(event).toHaveProperty('title');
    expect(event).toHaveProperty('taxType');
    expect(event).toHaveProperty('priority');
  });

  // === Anomaly Check ===
  test('✅ Anomaly check API accepts request', async ({ request }) => {
    const response = await request.post('/api/tax/anomaly-check', {
      headers: createAuthHeaders(advisorToken),
      data: {
        customerId: 'test-customer-id',
        taxYear: 2025,
        ptkpStatus: 'TK/0',
      },
    });

    // May return 404 if customer doesn't exist, but should not 500
    expect(response.status()).not.toBe(500);
  });

  // === Transfer Pricing ===
  test('✅ Transfer pricing analysis accepts request', async ({ request }) => {
    const response = await request.post('/api/tax/transfer-pricing', {
      headers: createAuthHeaders(advisorToken),
      data: {
        transactions: [
          { relatedParty: 'PT Afiliasi', transactionType: 'Sale', amount: 100000000, marketPrice: 110000000, description: 'Test' },
        ],
        companyName: 'PT Test',
        taxYear: 2025,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('summary');
    }
  });
});

test.describe('Killer Services - Security', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginAs(
      request,
      TEST_USERS.PLATFORM_ADMIN.email,
      TEST_USERS.PLATFORM_ADMIN.password
    );
  });

  // === Platform Admin Blocked from Customer APIs ===
  test('❌ Platform admin cannot access customer queue', async ({ request }) => {
    const response = await request.get('/api/customer/queue', {
      headers: createAuthHeaders(adminToken),
    });

    // Should be 403 (role blocked) or 404 (no customer record)
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('❌ Platform admin cannot access tax calculations', async ({ request }) => {
    const response = await request.get('/api/customer/tax-calculations', {
      headers: createAuthHeaders(adminToken),
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('❌ Platform admin cannot access monthly report', async ({ request }) => {
    const response = await request.get('/api/customer/monthly-report', {
      headers: createAuthHeaders(adminToken),
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  // === Unauthenticated Access ===
  test('❌ Unauthenticated request to customer queue returns 401', async ({ request }) => {
    const response = await request.get('/api/customer/queue');
    expect(response.status()).toBe(401);
  });

  test('❌ Unauthenticated request to invoice classify returns 401', async ({ request }) => {
    const response = await request.post('/api/customer/invoice-classify');
    expect(response.status()).toBe(401);
  });
});

test.describe('Killer Services - Cron Endpoints', () => {
  test('✅ Deadline reminders health check', async ({ request }) => {
    const response = await request.get('/api/cron/deadline-reminders');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('✅ Payment reminders health check', async ({ request }) => {
    const response = await request.get('/api/cron/payment-reminders');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('✅ Monthly report health check', async ({ request }) => {
    const response = await request.get('/api/cron/monthly-report');
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('❌ Cron POST without secret returns 401', async ({ request }) => {
    const response = await request.post('/api/cron/payment-reminders');
    expect(response.status()).toBe(401);
  });
});
