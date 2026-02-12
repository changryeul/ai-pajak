import crypto from 'crypto';
import { MIDTRANS_CONFIG, type SubscriptionPlan } from '@/config/constants';

interface MidtransTransaction {
  orderId: string;
  grossAmount: number;
  customerDetails: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
  };
  itemDetails?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}

interface MidtransNotification {
  transaction_status: string;
  order_id: string;
  status_code: string;
  gross_amount: string;
  payment_type: string;
  transaction_id: string;
  transaction_time: string;
  fraud_status?: string;
  signature_key: string;
}

/**
 * Midtrans Payment Service
 * Handles payment processing for AI PAJAK subscriptions
 */
export class MidtransService {
  private static readonly baseUrl = MIDTRANS_CONFIG.IS_PRODUCTION
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';

  private static readonly snapUrl = MIDTRANS_CONFIG.IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  private static readonly serverKey = MIDTRANS_CONFIG.SERVER_KEY;

  /**
   * Get subscription plan pricing
   */
  static getPlanPricing(): Record<
    SubscriptionPlan,
    { monthly: number; yearly: number; features: string[] }
  > {
    return {
      free: {
        monthly: 0,
        yearly: 0,
        features: [
          '5 tax documents/month',
          'Basic tax calculator',
          'Email support',
        ],
      },
      basic: {
        monthly: 99_000, // Rp 99,000
        yearly: 990_000, // Rp 990,000 (save 2 months)
        features: [
          '25 tax documents/month',
          'OCR document scanning',
          'Tax calculator (all types)',
          'Priority email support',
        ],
      },
      professional: {
        monthly: 299_000, // Rp 299,000
        yearly: 2_990_000, // Rp 2,990,000
        features: [
          'Unlimited tax documents',
          'AI-powered OCR',
          'AI tax assistant chat',
          'DJP e-Filing integration',
          'Priority support',
          'Multi-user (up to 5)',
        ],
      },
      enterprise: {
        monthly: 999_000, // Rp 999,000
        yearly: 9_990_000, // Rp 9,990,000
        features: [
          'Everything in Professional',
          'Unlimited users',
          'Custom integrations',
          'Dedicated account manager',
          'SLA guarantee',
          'On-premise option',
        ],
      },
    };
  }

  /**
   * Create a Snap transaction token for payment
   */
  static async createSnapTransaction(
    transaction: MidtransTransaction
  ): Promise<MidtransSnapResponse> {
    const authString = Buffer.from(`${this.serverKey}:`).toString('base64');

    const payload = {
      transaction_details: {
        order_id: transaction.orderId,
        gross_amount: transaction.grossAmount,
      },
      customer_details: {
        first_name: transaction.customerDetails.firstName,
        last_name: transaction.customerDetails.lastName || '',
        email: transaction.customerDetails.email,
        phone: transaction.customerDetails.phone || '',
      },
      item_details: transaction.itemDetails || [
        {
          id: transaction.orderId,
          name: 'AI PAJAK Subscription',
          price: transaction.grossAmount,
          quantity: 1,
        },
      ],
      enabled_payments: [
        'credit_card',
        'bca_va',
        'bni_va',
        'bri_va',
        'permata_va',
        'gopay',
        'shopeepay',
        'dana',
        'ovo',
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/callback`,
      },
    };

    const response = await fetch(this.snapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_messages?.[0] || 'Failed to create transaction');
    }

    return response.json();
  }

  /**
   * Create a subscription for recurring payments
   */
  static async createSubscription(
    plan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly',
    customerDetails: MidtransTransaction['customerDetails']
  ): Promise<MidtransSnapResponse> {
    const pricing = this.getPlanPricing()[plan];
    const amount = billingCycle === 'monthly' ? pricing.monthly : pricing.yearly;
    const orderId = `SUB-${plan.toUpperCase()}-${Date.now()}`;

    return this.createSnapTransaction({
      orderId,
      grossAmount: amount,
      customerDetails,
      itemDetails: [
        {
          id: plan,
          name: `AI PAJAK ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan (${billingCycle})`,
          price: amount,
          quantity: 1,
        },
      ],
    });
  }

  /**
   * Verify notification from Midtrans webhook
   *
   * Signature formula: SHA512(order_id + status_code + gross_amount + ServerKey)
   * See: https://docs.midtrans.com/reference/handling-notifications
   */
  static verifyNotification(notification: MidtransNotification): boolean {
    // Midtrans signature formula: SHA512(order_id + status_code + gross_amount + ServerKey)
    const signatureInput =
      notification.order_id +
      notification.status_code +
      notification.gross_amount +
      this.serverKey;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(signatureInput)
      .digest('hex');

    const isValid = notification.signature_key === expectedSignature;

    if (!isValid) {
      console.warn('[Midtrans] Signature verification failed', {
        orderId: notification.order_id,
        statusCode: notification.status_code,
        expectedLength: expectedSignature.length,
        receivedLength: notification.signature_key?.length,
      });
    }

    return isValid;
  }

  /**
   * Handle webhook notification
   */
  static async handleNotification(notification: MidtransNotification): Promise<{
    success: boolean;
    status: string;
    orderId: string;
  }> {
    const transactionStatus = notification.transaction_status;
    const orderId = notification.order_id;

    let status = 'pending';

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      status = 'paid';
    } else if (
      transactionStatus === 'deny' ||
      transactionStatus === 'cancel' ||
      transactionStatus === 'expire'
    ) {
      status = 'failed';
    } else if (transactionStatus === 'refund') {
      status = 'refunded';
    }

    return {
      success: status === 'paid',
      status,
      orderId,
    };
  }

  /**
   * Get transaction status
   */
  static async getTransactionStatus(orderId: string): Promise<Record<string, unknown>> {
    const authString = Buffer.from(`${this.serverKey}:`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v2/${orderId}/status`, {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    return response.json();
  }

  /**
   * Cancel a transaction
   */
  static async cancelTransaction(orderId: string): Promise<Record<string, unknown>> {
    const authString = Buffer.from(`${this.serverKey}:`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v2/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    return response.json();
  }

  /**
   * Refund a transaction
   */
  static async refundTransaction(
    orderId: string,
    amount?: number,
    reason?: string
  ): Promise<Record<string, unknown>> {
    const authString = Buffer.from(`${this.serverKey}:`).toString('base64');

    const payload: Record<string, unknown> = {};
    if (amount) payload.refund_amount = amount;
    if (reason) payload.reason = reason;

    const response = await fetch(`${this.baseUrl}/v2/${orderId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    return response.json();
  }
}
