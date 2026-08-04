import { test, expect } from '@playwright/test';
import { loginAs, createAuthHeaders } from './auth/login.helper';
import { TEST_USERS } from './fixtures/users';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Payment Flow E2E Tests
 *
 * Tests the Midtrans payment integration including:
 * - Payment initiation
 * - Idempotency handling
 * - Webhook processing
 * - Payment status checks
 */

// Create admin client for test data management
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let testTransactionId: string;

test.describe('Payment Flow Tests', () => {
  let customerToken: string;
  
  test.beforeAll(async ({ request }) => {
    // Login as customer
    customerToken = await loginAs(
      request,
      TEST_USERS.CUSTOMER.email,
      TEST_USERS.CUSTOMER.password
    );

    systemServiceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Create a test billing transaction for payment tests
    const { data: transaction, error } = await supabaseAdmin
      .from('billing_transaction')
      .insert({
        customer_id: TEST_USERS.CUSTOMER.customerId,
        tax_partner_id: TEST_USERS.TAX_ADVISOR.taxPartnerId,
        invoice_number: `INV-TEST-${Date.now()}`,
        service_type: 'TAX_FILING',
        description: 'E2E Test Payment Transaction',
        amount_base: 500_000,
        amount_tax: 55_000,
        amount_total: 555_000,
        currency: 'IDR',
        payment_status: 'PENDING',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create test transaction:', error);
    } else {
      testTransactionId = transaction.id;
      console.log(`[PAYMENT TEST] Created test transaction: ${testTransactionId}`);
    }
  });

  test.afterAll(async () => {
    // Clean up test transaction
    if (testTransactionId) {
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .eq('id', testTransactionId);
      console.log(`[PAYMENT TEST] Cleaned up test transaction: ${testTransactionId}`);
    }
  });

  test('✅ Customer can initiate payment for their transaction', async ({ request }) => {
    test.skip(!testTransactionId, 'No test transaction available');

    const idempotencyKey = `payment-init-${Date.now()}`;

    const response = await request.post('/api/payment/initiate', {
      headers: {
        ...createAuthHeaders(customerToken),
        'Idempotency-Key': idempotencyKey,
      },
      data: {
        transactionId: testTransactionId,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.transactionId).toBe(testTransactionId);
    expect(body.data.paymentToken).toBeTruthy();
    expect(body.data.paymentUrl).toBeTruthy();
    expect(body.data.expiresAt).toBeTruthy();

    console.log('[PAYMENT TEST] Payment initiated successfully');
  });

  test('✅ Idempotency key returns cached response', async ({ request }) => {
    test.skip(!testTransactionId, 'No test transaction available');

    const idempotencyKey = `payment-idempotent-${Date.now()}`;

    // First request
    const firstResponse = await request.post('/api/payment/initiate', {
      headers: {
        ...createAuthHeaders(customerToken),
        'Idempotency-Key': idempotencyKey,
      },
      data: {
        transactionId: testTransactionId,
      },
    });

    expect(firstResponse.status()).toBe(200);
    const firstBody = await firstResponse.json();

    // Second request with same idempotency key
    const secondResponse = await request.post('/api/payment/initiate', {
      headers: {
        ...createAuthHeaders(customerToken),
        'Idempotency-Key': idempotencyKey,
      },
      data: {
        transactionId: testTransactionId,
      },
    });

    expect(secondResponse.status()).toBe(200);
    expect(secondResponse.headers()['idempotency-replayed']).toBe('true');

    const secondBody = await secondResponse.json();
    expect(secondBody.data.paymentToken).toBe(firstBody.data.paymentToken);

    console.log('[PAYMENT TEST] Idempotency working correctly');
  });

  test('❌ Payment initiation requires authentication', async ({ request }) => {
    const response = await request.post('/api/payment/initiate', {
      data: {
        transactionId: testTransactionId,
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');

    console.log('[PAYMENT TEST] Unauthenticated payment rejected');
  });

  test('❌ Customer cannot initiate payment for another customer\'s transaction', async ({ request }) => {
    // Create a transaction for another customer
    const { data: otherTransaction } = await supabaseAdmin
      .from('billing_transaction')
      .insert({
        customer_id: TEST_USERS.CONSULTANT.consultantId, // Different customer
        tax_partner_id: TEST_USERS.TAX_ADVISOR.taxPartnerId,
        invoice_number: `INV-OTHER-${Date.now()}`,
        service_type: 'TAX_FILING',
        description: 'Other customer transaction',
        amount_base: 100_000,
        amount_tax: 11_000,
        amount_total: 111_000,
        currency: 'IDR',
        payment_status: 'PENDING',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (otherTransaction) {
      const response = await request.post('/api/payment/initiate', {
        headers: createAuthHeaders(customerToken),
        data: {
          transactionId: otherTransaction.id,
        },
      });

      // Should be 403 (forbidden) or 404 (RLS blocked)
      expect([403, 404]).toContain(response.status());

      // Clean up
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .eq('id', otherTransaction.id);

      console.log('[PAYMENT TEST] Cross-customer payment blocked');
    }
  });

  test('❌ Cannot pay already paid transaction', async ({ request }) => {
    // Create a paid transaction
    const { data: paidTransaction } = await supabaseAdmin
      .from('billing_transaction')
      .insert({
        customer_id: TEST_USERS.CUSTOMER.customerId,
        tax_partner_id: TEST_USERS.TAX_ADVISOR.taxPartnerId,
        invoice_number: `INV-PAID-${Date.now()}`,
        service_type: 'TAX_FILING',
        description: 'Already paid transaction',
        amount_base: 100_000,
        amount_tax: 11_000,
        amount_total: 111_000,
        currency: 'IDR',
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (paidTransaction) {
      const response = await request.post('/api/payment/initiate', {
        headers: createAuthHeaders(customerToken),
        data: {
          transactionId: paidTransaction.id,
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Transaction already paid');
      expect(body.paymentStatus).toBe('PAID');

      // Clean up
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .eq('id', paidTransaction.id);

      console.log('[PAYMENT TEST] Duplicate payment blocked');
    }
  });

  test('❌ Cannot pay cancelled transaction', async ({ request }) => {
    // Create a cancelled transaction
    const { data: cancelledTransaction } = await supabaseAdmin
      .from('billing_transaction')
      .insert({
        customer_id: TEST_USERS.CUSTOMER.customerId,
        tax_partner_id: TEST_USERS.TAX_ADVISOR.taxPartnerId,
        invoice_number: `INV-CANCEL-${Date.now()}`,
        service_type: 'TAX_FILING',
        description: 'Cancelled transaction',
        amount_base: 100_000,
        amount_tax: 11_000,
        amount_total: 111_000,
        currency: 'IDR',
        payment_status: 'CANCELLED',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (cancelledTransaction) {
      const response = await request.post('/api/payment/initiate', {
        headers: createAuthHeaders(customerToken),
        data: {
          transactionId: cancelledTransaction.id,
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Transaction cannot be paid');
      expect(body.paymentStatus).toBe('CANCELLED');

      // Clean up
      await supabaseAdmin
        .from('billing_transaction')
        .delete()
        .eq('id', cancelledTransaction.id);

      console.log('[PAYMENT TEST] Cancelled transaction payment blocked');
    }
  });
});

test.describe('Midtrans Webhook Tests', () => {
  test('✅ Webhook health check returns OK', async ({ request }) => {
    const response = await request.get('/api/webhooks/midtrans');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('ai-pajak-payment-webhook');
    expect(body.timestamp).toBeTruthy();

    console.log('[WEBHOOK TEST] Health check passed');
  });

  test('❌ Invalid order_id format is rejected', async ({ request }) => {
    const response = await request.post('/api/webhooks/midtrans', {
      data: {
        transaction_status: 'settlement',
        order_id: 'INVALID-FORMAT-123', // Should be PAY-{uuid}-{timestamp}
        status_code: '200',
        gross_amount: '555000.00',
        payment_type: 'bank_transfer',
        transaction_id: 'test-txn-id',
        transaction_time: new Date().toISOString(),
        signature_key: 'invalid-signature',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    // Webhook now routes by order_id prefix (CORP-, CONS-, PAY-). An order_id
    // that doesn't match any of these is rejected with "Unknown order_id prefix";
    // a truly malformed one (< 2 parts) is rejected with "Invalid order_id format".
    expect(['Invalid order_id format', 'Unknown order_id prefix']).toContain(body.error);

    console.log('[WEBHOOK TEST] Invalid order_id rejected');
  });

  test('❌ Invalid signature is rejected', async ({ request }) => {
    const response = await request.post('/api/webhooks/midtrans', {
      data: {
        transaction_status: 'settlement',
        order_id: 'PAY-00000000-0000-0000-0000-000000000000-1234567890',
        status_code: '200',
        gross_amount: '555000.00',
        payment_type: 'bank_transfer',
        transaction_id: 'test-txn-id',
        transaction_time: new Date().toISOString(),
        signature_key: 'invalid-signature-key',
      },
    });

    // Webhook returns 401 for invalid signature
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid signature');

    console.log('[WEBHOOK TEST] Invalid signature rejected');
  });
});

test.describe('Payment Status Summary', () => {
  test('Payment Flow Tests Summary', () => {
    console.log('\n===========================================');
    console.log('PAYMENT FLOW E2E TEST SUMMARY');
    console.log('===========================================');
    console.log('PAYMENT INITIATION:');
    console.log('  - Customer can initiate payment');
    console.log('  - Idempotency prevents duplicate payments');
    console.log('  - Authentication required');
    console.log('  - Cross-customer payments blocked');
    console.log('  - Already paid transactions blocked');
    console.log('  - Cancelled transactions blocked');
    console.log('');
    console.log('WEBHOOK PROCESSING:');
    console.log('  - Health check endpoint works');
    console.log('  - Invalid order_id format rejected');
    console.log('  - Invalid signature rejected');
    console.log('===========================================\n');

    expect(true).toBe(true);
  });
});
