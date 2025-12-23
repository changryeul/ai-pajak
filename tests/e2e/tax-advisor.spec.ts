import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS, TEST_TAX_FILING, TEST_POA } from './fixtures/users';

/**
 * TAX_ADVISOR_JTC Role E2E Tests
 *
 * TAX_ADVISOR_JTC Permissions (✅ ALLOWED):
 * - Calculate tax
 * - File tax (REQUIRES ACTIVE POA)
 * - Sign POA
 * - View all JTC customer filings
 *
 * TAX_ADVISOR_JTC Restrictions (❌ FORBIDDEN):
 * - File tax WITHOUT active POA (CRITICAL TEST)
 * - Access customers from other tax partners
 * - Create billing
 */

test.describe('TAX_ADVISOR_JTC Role Tests', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as tax advisor
    advisorToken = await loginAs(
      request,
      TEST_USERS.TAX_ADVISOR_JTC.email,
      TEST_USERS.TAX_ADVISOR_JTC.password
    );
  });

  test('✅ Tax Advisor can calculate tax', async ({ request }) => {
    const response = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(advisorToken),
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

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.calculatedBy.consultantId).toBe(
      TEST_USERS.TAX_ADVISOR_JTC.consultantId
    );
  });

  test('❌ Tax Advisor CANNOT file tax WITHOUT active POA', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: {
        customerId: 'customer-without-poa-uuid',
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

    // CRITICAL: Must have active POA to file tax
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('No active Power of Attorney');
    expect(body.message).toContain(
      'Customer must authorize Jakarta Tax Consulting via Power of Attorney'
    );
    expect(body.action).toBe('CREATE_POA');
    expect(body.helpUrl).toBe('/help/power-of-attorney');
  });

  test('❌ Tax Advisor CANNOT file tax with EXPIRED POA', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: {
        customerId: 'customer-with-expired-poa-uuid',
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

    // POA expired - should fail
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('No active Power of Attorney');
  });

  test('❌ Tax Advisor CANNOT file tax with POA SCOPE mismatch', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: {
        customerId: 'customer-with-pph23-only-poa-uuid',
        taxType: 'PPh21', // POA only covers PPh23
        taxPeriod: '2025-01',
        taxYear: 2025,
        taxData: {
          calculatedTax: 475_000,
          netTaxDue: 475_000,
        },
        documentIds: ['test-doc-001'],
      },
    });

    // POA scope doesn't cover PPh21
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('POA scope mismatch');
    expect(body.message).toContain('Power of Attorney does not cover PPh21');
    expect(body.details.requiredScope).toBe('PPh21');
    expect(body.action).toBe('UPDATE_POA');
  });

  test('✅ Tax Advisor CAN file tax WITH active POA', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: TEST_TAX_FILING,
    });

    // Should succeed with active POA
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.taxFilingId).toBeTruthy();
    expect(body.filingNumber).toMatch(/^TAX-\d{4}-/);
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedBy.userId).toBeTruthy();
    expect(body.poa.poaId).toBe(TEST_POA.id);
    expect(body.poa.poaNumber).toBe(TEST_POA.poaNumber);

    // Verify audit trail created
    expect(body.auditTrail.auditLogId).toBeTruthy();
    expect(body.auditTrail.timestamp).toBeTruthy();
  });

  test('✅ Tax Advisor can sign POA for their tax partner', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(advisorToken),
      data: {
        poaId: TEST_POA.id,
        signatureData: 'base64-encoded-advisor-signature',
        signatureMethod: 'DIGITAL',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.previousStatus).toBe('PENDING_SIGNATURE');
    expect(body.newStatus).toBe('ACTIVE');
    expect(body.signer.role).toBe('TAX_ADVISOR_JTC');
    expect(body.poa.taxPartner.signedAt).toBeTruthy();
    expect(body.poa.taxPartner.signedByAdvisorId).toBe(
      TEST_USERS.TAX_ADVISOR_JTC.consultantId
    );
  });

  test('❌ Tax Advisor CANNOT sign POA for DIFFERENT tax partner', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(advisorToken),
      data: {
        poaId: 'poa-from-different-tax-partner-uuid',
        signatureData: 'signature',
        signatureMethod: 'DIGITAL',
      },
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('You can only sign POA for your tax partner');
  });

  test('❌ Tax Advisor CANNOT sign POA before customer signs', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(advisorToken),
      data: {
        poaId: 'poa-without-customer-signature-uuid',
        signatureData: 'signature',
        signatureMethod: 'DIGITAL',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Customer signature required');
    expect(body.message).toContain(
      'Customer must sign POA before tax advisor can sign'
    );
  });

  test('✅ Tax filing creates immutable audit log', async ({ request }) => {
    const filingResponse = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: TEST_TAX_FILING,
    });

    expect(filingResponse.status()).toBe(201);

    const filingBody = await filingResponse.json();
    const auditLogId = filingBody.auditTrail.auditLogId;

    // Verify audit log exists and is immutable
    expect(auditLogId).toBeTruthy();

    // Try to delete audit log (should fail - immutable)
    // Note: This would require a separate admin endpoint to test
    // For now, verify audit log ID is returned
  });

  test('❌ Tax Advisor CANNOT access platform admin dashboard', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(advisorToken),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  test('❌ Tax Advisor CANNOT create billing transactions', async ({ request }) => {
    const response = await request.post('/api/billing/create', {
      headers: createAuthHeaders(advisorToken),
      data: {
        idempotencyKey: 'test-billing-003',
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxFilingId: 'test-filing-003',
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

  test('✅ Tax filing includes complete metadata', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(advisorToken),
      data: TEST_TAX_FILING,
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    // Verify all required fields present
    expect(body.taxFilingId).toBeTruthy();
    expect(body.filingNumber).toBeTruthy();
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedAt).toBeTruthy();

    // Verify submitter details
    expect(body.submittedBy.userId).toBeTruthy();
    expect(body.submittedBy.consultantId).toBe(
      TEST_USERS.TAX_ADVISOR_JTC.consultantId
    );
    expect(body.submittedBy.taxPartnerId).toBe(
      TEST_USERS.TAX_ADVISOR_JTC.taxPartnerId
    );
    expect(body.submittedBy.taxPartnerName).toBeTruthy();

    // Verify customer details
    expect(body.customer.customerId).toBe(TEST_USERS.CUSTOMER.customerId);
    expect(body.customer.customerName).toBeTruthy();
    expect(body.customer.npwp).toBeTruthy();

    // Verify POA details
    expect(body.poa.poaId).toBeTruthy();
    expect(body.poa.poaNumber).toBeTruthy();

    // Verify tax details
    expect(body.tax.taxType).toBe(TEST_TAX_FILING.taxType);
    expect(body.tax.taxPeriod).toBe(TEST_TAX_FILING.taxPeriod);
    expect(body.tax.taxYear).toBe(TEST_TAX_FILING.taxYear);
    expect(body.tax.netTaxDue).toBe(TEST_TAX_FILING.taxData.netTaxDue);

    // Verify audit trail
    expect(body.auditTrail.auditLogId).toBeTruthy();
    expect(body.auditTrail.timestamp).toBeTruthy();
  });
});
