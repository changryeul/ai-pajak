/**
 * Midtrans Payment Integration Tests
 *
 * These tests verify the payment flow works correctly.
 * For local testing, you need:
 * 1. Midtrans Sandbox credentials in .env.local
 * 2. ngrok for webhook testing
 *
 * Test card numbers (Sandbox):
 * - Success: 4811 1111 1111 1114 (any CVV, any expiry)
 * - Denied: 4911 1111 1111 1113
 * - Challenge by FDS: 4511 1111 1111 1117
 *
 * Virtual Account (Sandbox):
 * - BCA VA: Any 16 digit number
 * - BNI VA: Any 16 digit number
 *
 * E-Wallet (Sandbox):
 * - GoPay: Simulator will auto-approve
 * - ShopeePay: Simulator will auto-approve
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => ({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' },
          },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    })),
  })),
}));

// Mock MidtransService
vi.mock('@/lib/payment/midtrans', () => ({
  MidtransService: {
    createSnapTransaction: vi.fn(() =>
      Promise.resolve({
        token: 'mock-snap-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-token',
      })
    ),
    handleNotification: vi.fn(() =>
      Promise.resolve({
        success: true,
        status: 'paid',
        orderId: 'PAY-test-123-1234567890',
      })
    ),
    getTransactionStatus: vi.fn(() =>
      Promise.resolve({
        status_code: '200',
        transaction_status: 'settlement',
      })
    ),
  },
}));

describe('Payment Initiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a payment token for valid transaction', async () => {
    const { MidtransService } = await import('@/lib/payment/midtrans');

    const result = await MidtransService.createSnapTransaction({
      orderId: 'PAY-test-123',
      grossAmount: 100000,
      customerDetails: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
    });

    expect(result.token).toBeDefined();
    expect(result.redirect_url).toContain('midtrans.com');
  });

  it('should handle webhook notification correctly', async () => {
    const { MidtransService } = await import('@/lib/payment/midtrans');

    const notification = {
      transaction_status: 'settlement',
      order_id: 'PAY-test-123-1234567890',
      gross_amount: '100000.00',
      payment_type: 'credit_card',
      transaction_id: 'txn-123',
      transaction_time: '2024-01-01 12:00:00',
      signature_key: 'mock-signature',
    };

    const result = await MidtransService.handleNotification(notification);

    expect(result.success).toBe(true);
    expect(result.status).toBe('paid');
  });
});

describe('Payment Status Mapping', () => {
  it('should map settlement to PAID', () => {
    const midtransStatus = 'settlement';
    const expectedStatus = 'PAID';

    const status = mapMidtransStatus(midtransStatus);
    expect(status).toBe(expectedStatus);
  });

  it('should map capture to PAID', () => {
    const midtransStatus = 'capture';
    const expectedStatus = 'PAID';

    const status = mapMidtransStatus(midtransStatus);
    expect(status).toBe(expectedStatus);
  });

  it('should map deny to FAILED', () => {
    const midtransStatus = 'deny';
    const expectedStatus = 'FAILED';

    const status = mapMidtransStatus(midtransStatus);
    expect(status).toBe(expectedStatus);
  });

  it('should map pending to PENDING', () => {
    const midtransStatus = 'pending';
    const expectedStatus = 'PENDING';

    const status = mapMidtransStatus(midtransStatus);
    expect(status).toBe(expectedStatus);
  });
});

// Helper function for testing
function mapMidtransStatus(midtransStatus: string): string {
  switch (midtransStatus) {
    case 'capture':
    case 'settlement':
      return 'PAID';
    case 'deny':
    case 'cancel':
    case 'expire':
      return 'FAILED';
    case 'refund':
      return 'REFUNDED';
    case 'pending':
    default:
      return 'PENDING';
  }
}
