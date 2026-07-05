import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS, TEST_POA_DRAFT, TEST_SCOPE_MISMATCH_CUSTOMER } from './fixtures/users';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * CUSTOMER Role E2E Tests
 *
 * CUSTOMER Permissions (✅ ALLOWED):
 * - Create POA
 * - Sign POA
 * - Upload documents
 * - View own tax filings
 *
 * CUSTOMER Restrictions (❌ FORBIDDEN):
 * - Calculate tax
 * - File tax
 * - Access other customers' data
 */

// Create admin client for resetting test data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test.describe('CUSTOMER Role Tests', () => {
  let customerToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as customer
    customerToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password
    );

    // Reset DRAFT POA to DRAFT status before tests
    await supabaseAdmin
      .from('power_of_attorney')
      .update({
        status: 'DRAFT',
        customer_signed_at: null,
        customer_signature_url: null,
        tax_partner_signed_at: null,
        tax_partner_signature_url: null,
        tax_partner_signed_by_user_id: null,
      })
      .eq('id', TEST_POA_DRAFT.id);
  });

  test('✅ Customer can create POA request', async ({ request }) => {
    const response = await request.post('/api/poa/create', {
      headers: createAuthHeaders(customerToken),
      data: {
        taxPartnerId: TEST_USERS.TAX_ADVISOR.taxPartnerId,
        scope: 'ALL_TAX_TYPES',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        documentUrl: 'https://storage.supabase.co/v1/object/public/poa-documents/test-poa-001.pdf',
        notes: 'E2E test POA creation',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('DRAFT');
    expect(body.poaNumber).toMatch(/^POA-\d{4}-/);
    expect(body.customer.customerId).toBe(TEST_USERS.CUSTOMER.customerId);
    expect(body.nextSteps).toHaveLength(3);
    expect(body.nextSteps[0].action).toBe('CUSTOMER_SIGN');
  });

  test('✅ Customer can sign their own POA', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(customerToken),
      data: {
        poaId: TEST_POA_DRAFT.id,
        signatureData: 'base64-encoded-signature-data',
        signatureMethod: 'ELECTRONIC',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.previousStatus).toBe('DRAFT');
    expect(body.newStatus).toBe('PENDING_SIGNATURE');
    expect(body.signer.role).toBe('CUSTOMER');
    expect(body.poa.customer.signedAt).toBeTruthy();
  });

  test('❌ Customer CANNOT calculate tax', async ({ request }) => {
    const response = await request.post('/api/tax/calculate', {
      headers: createAuthHeaders(customerToken),
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

    // CRITICAL: Customer should be FORBIDDEN from calculating tax
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('You do not have permission');
  });

  test('❌ Customer CANNOT file tax', async ({ request }) => {
    const response = await request.post('/api/tax/file', {
      headers: createAuthHeaders(customerToken),
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

    // CRITICAL: Customer should be FORBIDDEN from filing tax
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.requiredRoles).toContain('TAX_ADVISOR');
    expect(body.currentRole).toBe('CUSTOMER');
  });

  test('❌ Customer CANNOT sign another customer\'s POA', async ({ request }) => {
    const response = await request.post('/api/poa/sign', {
      headers: createAuthHeaders(customerToken),
      data: {
        poaId: TEST_SCOPE_MISMATCH_CUSTOMER.poaId, // Another customer's POA
        signatureData: 'signature',
        signatureMethod: 'ELECTRONIC',
      },
    });

    // SECURITY: RLS blocks access to other customer's POA, so 404 "POA not found" is returned
    // This is correct security behavior - don't reveal that the POA exists
    // Could also be 403 (Unauthorized) if RLS allows read but handler checks ownership
    expect([403, 404]).toContain(response.status());

    const body = await response.json();
    // Either "POA not found" (RLS blocked) or "Unauthorized" (ownership check)
    expect(['POA not found', 'Unauthorized']).toContain(body.error);
  });

  test('❌ Customer CANNOT access platform admin dashboard', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard', {
      headers: createAuthHeaders(customerToken),
    });

    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  test('❌ Customer CANNOT create billing transactions', async ({ request }) => {
    const response = await request.post('/api/billing/create', {
      headers: createAuthHeaders(customerToken),
      data: {
        idempotencyKey: 'test-billing-001',
        customerId: TEST_USERS.CUSTOMER.customerId,
        taxFilingId: 'test-filing-001',
        taxPartnerId: TEST_USERS.TAX_ADVISOR.taxPartnerId,
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
    expect(body.message).toContain('You do not have permission');
  });
});
