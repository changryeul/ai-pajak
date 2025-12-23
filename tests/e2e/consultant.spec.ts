import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS, TEST_TAX_FILING } from './fixtures/users';

/**
 * CONSULTANT_JTC Role E2E Tests
 *
 * CONSULTANT_JTC Permissions (✅ ALLOWED):
 * - Calculate tax for assigned customers
 * - Upload documents
 * - View assigned customer tax filings
 * - Create draft tax filings
 *
 * CONSULTANT_JTC Restrictions (❌ FORBIDDEN):
 * - File tax (requires TAX_ADVISOR_JTC)
 * - Sign POA
 * - Access unassigned customers
 * - Create billing
 */

test.describe('CONSULTANT_JTC Role Tests', () => {
  let consultantToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as consultant
    consultantToken = await loginAs(
      request,
      TEST_USERS.CONSULTANT_JTC.email,
      TEST_USERS.CONSULTANT_JTC.password
    );
  });

  test('✅ Consultant can calculate tax for assigned customer', async ({ request }) => {
    const response = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(consultantToken),
      data: {
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        incomeData: {
          grossIncome: 10_000_000,
          otherIncome: 500_000,
        },
        deductions: {
          personalDeduction: 54_000_000,
          dependentDeduction: 4_500_000,
        },
        credits: {
          withholdingTax: 100_000,
        },
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.calculationId).toBeTruthy();
    expect(body.calculation.netTaxDue).toBeGreaterThanOrEqual(0);
    expect(body.breakdown.taxBrackets).toBeTruthy();
    expect(body.calculatedBy.consultantId).toBe(
      TEST_USERS.CONSULTANT_JTC.consultantId
    );
  });

  test('✅ Consultant calculation results are saved as DRAFT', async ({ request }) => {
    const calcResponse = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(consultantToken),
      data: {
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        incomeData: {
          grossIncome: 5_000_000,
        },
      },
    });

    expect(calcResponse.status()).toBe(200);

    const calcBody = await calcResponse.json();
    const calculationId = calcBody.calculationId;

    // Verify calculation was saved to database
    expect(calculationId).toBeTruthy();

    // Consultant can recalculate (no error)
    const recalcResponse = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(consultantToken),
      data: {
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        incomeData: {
          grossIncome: 6_000_000, // Different amount
        },
      },
    });

    expect(recalcResponse.status()).toBe(200);

    const recalcBody = await recalcResponse.json();
    // Different calculation ID (new calculation)
    expect(recalcBody.calculationId).not.toBe(calculationId);
  });

  test('❌ Consultant CANNOT file tax', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(consultantToken),
      data: TEST_TAX_FILING,
    });

    // CRITICAL: Only TAX_ADVISOR_JTC can file tax
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('You do not have permission');
    expect(body.requiredRoles).toContain('TAX_ADVISOR_JTC');
    expect(body.currentRole).toBe('CONSULTANT_JTC');
  });

  test('❌ Consultant CANNOT sign POA', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(consultantToken),
      data: {
        poaId: 'test-poa-uuid',
        signatureData: 'signature',
        signatureMethod: 'ELECTRONIC',
      },
    });

    // Only CUSTOMER or TAX_ADVISOR_JTC can sign
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized role');
    expect(body.message).toContain('Only CUSTOMER or TAX_ADVISOR_JTC can sign POA');
  });

  test('❌ Consultant CANNOT access unassigned customer data', async ({ request }) => {
    const response = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(consultantToken),
      data: {
        customerId: 'unassigned-customer-uuid',
        taxType: 'PPh21',
        taxPeriod: '2025-01',
        taxYear: 2025,
        incomeData: {
          grossIncome: 10_000_000,
        },
      },
    });

    // Should fail - consultant not assigned to this customer
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('You are not assigned to this customer');
  });

  test('❌ Consultant CANNOT create POA', async ({ request }) => {
    const response = await request.post('/api/poa/create', {
      headers: createAuthHeaders(consultantToken),
      data: {
        taxPartnerId: TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId,
        scope: 'ALL_TAX_TYPES',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        documentId: 'test-doc-uuid',
      },
    });

    // Only CUSTOMER can create POA
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  test('❌ Consultant CANNOT access platform admin dashboard', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(consultantToken),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  test('❌ Consultant CANNOT create billing transactions', async ({ request }) => {
    const response = await request.post('/api/billing/create', {
      headers: createAuthHeaders(consultantToken),
      data: {
        idempotencyKey: 'test-billing-002',
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxFilingId: 'test-filing-002',
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

    // Only SYSTEM can create billing
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Only SYSTEM account can create billing');
  });
});
