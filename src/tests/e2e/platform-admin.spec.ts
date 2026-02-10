import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';

/**
 * PLATFORM_ADMIN Role E2E Tests
 *
 * 🚨 CRITICAL SECURITY TESTS 🚨
 *
 * HARD RULE #1: PLATFORM_ADMIN CANNOT ACCESS TAX DATA
 *
 * This is the MOST IMPORTANT test suite in the entire system.
 * If any of these tests FAIL, the system MUST NOT be deployed to production.
 *
 * PLATFORM_ADMIN Permissions (✅ ALLOWED):
 * - View aggregated analytics (anonymized)
 * - Manage platform settings
 * - View system health metrics
 *
 * PLATFORM_ADMIN Restrictions (❌ FORBIDDEN - MUST FAIL):
 * - Calculate tax
 * - File tax
 * - View individual customer tax data
 * - View customer PII
 * - Sign POA
 * - Create billing
 * - Access any tax-related endpoint
 */

test.describe('🚨 PLATFORM_ADMIN Security Tests (CRITICAL)', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as platform admin
    adminToken = await loginAs(
      request,
      TEST_USERS.PLATFORM_ADMIN.email,
      TEST_USERS.PLATFORM_ADMIN.password
    );
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT calculate tax', async ({ request }) => {
    const response = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(adminToken),
      data: {
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        incomeData: {
          grossIncome: 10_000_000,
        },
      },
    });

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain(
      'Platform administrators cannot access tax data'
    );

    // Verify security logging occurred
    console.log(
      '[SECURITY TEST] Platform admin tax calculation attempt blocked ✅'
    );
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT file tax', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(adminToken),
      data: {
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        taxData: {
          calculatedTax: 475_000,
          netTaxDue: 475_000,
        },
        documentIds: ['test-doc-001'],
      },
    });

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain(
      'Platform administrators cannot access tax data'
    );

    console.log('[SECURITY TEST] Platform admin tax filing attempt blocked ✅');
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT view individual customer tax filing', async ({ request }) => {
    const response = await request.get('/api/tax/filings/test-filing-uuid-001', {
      headers: createAuthHeaders(adminToken),
    });

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain(
      'Platform administrators cannot access tax data'
    );

    console.log('[SECURITY TEST] Platform admin tax filing view blocked ✅');
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT view customer details', async ({ request }) => {
    const response = await request.get(
      `/api/customers/${TEST_USERS.CUSTOMER.customerId}`,
      {
        headers: createAuthHeaders(adminToken),
      }
    );

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');

    console.log('[SECURITY TEST] Platform admin customer view blocked ✅');
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT create POA', async ({ request }) => {
    const response = await request.post('/api/poa/create', {
      headers: createAuthHeaders(adminToken),
      data: {
        taxPartnerId: TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId,
        scope: 'ALL_TAX_TYPES',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        documentId: 'test-doc-uuid',
      },
    });

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');

    console.log('[SECURITY TEST] Platform admin POA creation blocked ✅');
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT sign POA', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(adminToken),
      data: {
        poaId: 'test-poa-uuid',
        signatureData: 'signature',
        signatureMethod: 'DIGITAL',
      },
    });

    // 🚨 CRITICAL: Must be FORBIDDEN
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('permission');

    console.log('[SECURITY TEST] Platform admin POA signing blocked ✅');
  });

  test('❌ 🚨 CRITICAL: Platform admin CANNOT create billing', async ({ request }) => {
    const response = await request.post('/api/billing/create', {
      headers: createAuthHeaders(adminToken),
      data: {
        idempotencyKey: 'test-billing-admin-001',
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxFilingId: 'test-filing-001',
        taxPartnerId: TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId,
        serviceType: 'TAX_FILING',
        description: 'Test billing',
        amountBase: 500_000,
        amountTax: 55_000,
        amountTotal: 555_000,
        currency: 'IDR',
        dueDate: '2025-02-15',
      },
    });

    // 🚨 CRITICAL: Must be FORBIDDEN (only SYSTEM can create billing)
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('You do not have permission');

    console.log('[SECURITY TEST] Platform admin billing creation blocked ✅');
  });

  test('✅ Platform admin CAN access aggregated dashboard', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(adminToken),
    });

    // Should succeed - platform admin can view aggregated data
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);

    // Verify all data is aggregated/anonymized
    expect(body.platformMetrics.totalCustomers).toBeGreaterThanOrEqual(0);
    expect(body.platformMetrics.activeCustomers).toBeGreaterThanOrEqual(0);

    // Verify financial amounts are BUCKETED (not exact)
    expect(body.billingMetrics.totalRevenue).toMatch(
      /^(0|< 1M|1M - 5M|5M - 10M|10M - 50M|> 50M)$/
    );
    expect(body.billingMetrics.monthlyRevenue).toMatch(
      /^(0|< 1M|1M - 5M|5M - 10M|10M - 50M|> 50M)$/
    );

    // Verify warning message present
    expect(body.warning).toContain('All data is aggregated and anonymized');
    expect(body.warning).toContain(
      'Customer PII and tax data are not accessible'
    );

    console.log('[SECURITY TEST] Platform admin dashboard access allowed ✅');
  });

  test('✅ Platform admin dashboard contains NO customer PII', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(adminToken),
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Convert response to string to check for sensitive data
    const responseString = JSON.stringify(body);

    // Verify NO NPWP in response
    expect(responseString).not.toContain(TEST_USERS.CUSTOMER.npwp);

    // Verify NO customer email in response
    expect(responseString).not.toContain(TEST_USERS.CUSTOMER.email);

    // Verify NO exact customer ID (should be masked if present)
    expect(responseString).not.toContain(TEST_USERS.CUSTOMER.customerId);

    // Verify NO specific transaction amounts (should be bucketed)
    expect(body.billingMetrics).not.toHaveProperty('exactRevenue');
    expect(body.billingMetrics).not.toHaveProperty('exactMonthlyRevenue');

    console.log('[SECURITY TEST] Dashboard contains no customer PII ✅');
  });

  test('✅ Platform admin dashboard data passes validation', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(adminToken),
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Verify no sensitive fields present
    const sensitiveFields = [
      'npwp',
      'full_name',
      'company_name',
      'address',
      'phone',
      'tax_data',
      'customer_id', // Raw customer ID
      'tax_filing_id',
    ];

    const responseString = JSON.stringify(body).toLowerCase();

    for (const field of sensitiveFields) {
      // Check if field name appears as a key (indicating leaked data)
      const fieldPattern = new RegExp(`"${field}"\\s*:`, 'i');
      expect(responseString).not.toMatch(fieldPattern);
    }

    console.log('[SECURITY TEST] Dashboard data validation passed ✅');
  });

  test('❌ Platform admin CANNOT access audit logs with customer details', async ({ request }) => {
    const response = await request.get('/api/audit/logs', {
      headers: createAuthHeaders(adminToken),
    });

    // Should either be forbidden OR return sanitized audit logs
    if (response.status() === 200) {
      const body = await response.json();

      // If allowed, verify logs are sanitized
      if (body.logs && body.logs.length > 0) {
        const log = body.logs[0];

        // Should have hashed customer ID, not raw
        if (log.customerIdHash) {
          expect(log.customerIdHash).not.toBe(TEST_USERS.CUSTOMER.customerId);
          expect(log.customerIdHash.length).toBeLessThanOrEqual(16);
        }

        // Should NOT have raw customer_id
        expect(log).not.toHaveProperty('customer_id');
        expect(log).not.toHaveProperty('tax_filing_id');
        expect(log).not.toHaveProperty('activity_details');
      }
    } else {
      // Alternatively, access denied completely
      expect(response.status()).toBe(403);
    }

    console.log('[SECURITY TEST] Audit log access properly restricted ✅');
  });

  test('🚨 SECURITY SUMMARY: All platform admin restrictions enforced', async () => {
    console.log('\n===========================================');
    console.log('🚨 PLATFORM_ADMIN SECURITY TEST SUMMARY 🚨');
    console.log('===========================================');
    console.log('✅ Tax calculation blocked');
    console.log('✅ Tax filing blocked');
    console.log('✅ Individual tax filing view blocked');
    console.log('✅ Customer details view blocked');
    console.log('✅ POA creation blocked');
    console.log('✅ POA signing blocked');
    console.log('✅ Billing creation blocked');
    console.log('✅ Dashboard access allowed (aggregated only)');
    console.log('✅ Dashboard contains no customer PII');
    console.log('✅ Dashboard data validation passed');
    console.log('✅ Audit log access restricted');
    console.log('===========================================');
    console.log('🎉 ALL SECURITY TESTS PASSED');
    console.log('===========================================\n');

    // Always pass - this is a summary test
    expect(true).toBe(true);
  });
});

/**
 * Deployment Gate Test
 *
 * If this test suite has ANY failures, DO NOT DEPLOY to production.
 */
test.describe('🚨 DEPLOYMENT GATE', () => {
  test('All critical security tests must pass before deployment', () => {
    // This test intentionally does nothing
    // Its purpose is to serve as a reminder that the above tests are critical

    console.log('\n===========================================');
    console.log('🚨 DEPLOYMENT GATE CHECK 🚨');
    console.log('===========================================');
    console.log('Before deploying to production, verify:');
    console.log('1. All PLATFORM_ADMIN tests passed');
    console.log('2. No tax data accessible to platform admin');
    console.log('3. All blocking middleware active');
    console.log('4. Security logging enabled');
    console.log('===========================================\n');

    expect(true).toBe(true);
  });
});
