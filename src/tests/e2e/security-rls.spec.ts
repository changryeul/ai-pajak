import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

/**
 * RLS Security Tests — Verify data isolation between roles
 *
 * Hard Rule #1: PLATFORM_ADMIN cannot access customer tax data
 * Hard Rule #2: Consultant must belong to JTC
 * Hard Rule #5: Audit trail required
 */

test.describe('RLS Security - Tax Data Access', () => {
  let adminToken: string;
  let consultantToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginAs(request, TEST_USERS.PLATFORM_ADMIN.email, TEST_USERS.PLATFORM_ADMIN.password);
    consultantToken = await loginAs(request, TEST_USERS.CONSULTANT.email, TEST_USERS.CONSULTANT.password);
  });

  test('❌ PLATFORM_ADMIN blocked from PPh23 transactions', async ({ request }) => {
    const res = await request.get(
      `/api/tax/pph23-transactions?customerId=${TEST_USERS.CUSTOMER.customerId}`,
      { headers: createAuthHeaders(adminToken) }
    );
    expect(res.status()).toBe(403);
  });

  test('❌ PLATFORM_ADMIN blocked from PPh26 transactions', async ({ request }) => {
    const res = await request.get(
      `/api/tax/pph26-transactions?customerId=${TEST_USERS.CUSTOMER.customerId}`,
      { headers: createAuthHeaders(adminToken) }
    );
    expect(res.status()).toBe(403);
  });

  test('❌ PLATFORM_ADMIN blocked from PPN faktur', async ({ request }) => {
    const res = await request.get(
      `/api/tax/ppn-faktur-monthly?customerId=${TEST_USERS.CUSTOMER.customerId}&period=2025-01`,
      { headers: createAuthHeaders(adminToken) }
    );
    expect(res.status()).toBe(403);
  });

  test('❌ PLATFORM_ADMIN blocked from e-Bupot generation', async ({ request }) => {
    const res = await request.post('/api/tax/ebupot-pph23', {
      headers: createAuthHeaders(adminToken),
      data: { customerId: TEST_USERS.CUSTOMER.customerId, period: '2025-01' },
    });
    expect(res.status()).toBe(403);
  });

  test('❌ PLATFORM_ADMIN blocked from CSV bulk import', async ({ request }) => {
    const res = await request.post('/api/tax/bulk-import', {
      headers: createAuthHeaders(adminToken),
      data: { type: 'PPh23', csvContent: 'a,b\n1,2', customerId: 'test', taxPeriod: '2025-01' },
    });
    expect(res.status()).toBe(403);
  });

  test('✅ PLATFORM_ADMIN CAN access resolve API (read-only calculation)', async ({ request }) => {
    const res = await request.post('/api/tax/resolve', {
      headers: createAuthHeaders(adminToken),
      data: {
        grossAmount: 100_000_000,
        serviceCategory: 'SERVICE',
        recipientType: 'RESIDENT',
      },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('✅ PLATFORM_ADMIN CAN access tax rates admin', async ({ request }) => {
    const res = await request.get('/api/admin/tax-rates', {
      headers: createAuthHeaders(adminToken),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('✅ PLATFORM_ADMIN CAN access override rules', async ({ request }) => {
    const res = await request.get('/api/admin/override-rules', {
      headers: createAuthHeaders(adminToken),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('✅ CONSULTANT can access assigned customer transactions', async ({ request }) => {
    const res = await request.get(
      `/api/tax/pph23-transactions?customerId=${TEST_USERS.CUSTOMER.customerId}`,
      { headers: createAuthHeaders(consultantToken) }
    );
    expect(res.ok()).toBeTruthy();
  });
});
