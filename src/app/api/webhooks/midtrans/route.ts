/**
 * Midtrans Webhook Handler
 *
 * POST /api/webhooks/midtrans
 *
 * Handles payment notifications from Midtrans.
 * Updates billing transaction status based on payment outcome.
 *
 * IMPORTANT: This endpoint is called by Midtrans servers, not by users.
 * It should be publicly accessible (no auth) but verify signature.
 *
 * Midtrans will send notifications for these statuses:
 * - capture: For card payments, payment captured successfully
 * - settlement: Payment received/settled
 * - pending: Payment still pending (e.g., waiting for bank transfer)
 * - deny: Payment denied by bank/payment provider
 * - cancel: Payment cancelled
 * - expire: Payment expired
 * - refund: Payment refunded
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MidtransService } from '@/lib/payment/midtrans';

interface MidtransNotification {
  transaction_status: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_id: string;
  transaction_time: string;
  fraud_status?: string;
  signature_key: string;
  status_code?: string;
  status_message?: string;
}

// Create Supabase client with service role for webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const notification = (await request.json()) as MidtransNotification;

    console.log('[WEBHOOK] Midtrans notification received:', {
      orderId: notification.order_id,
      status: notification.transaction_status,
      paymentType: notification.payment_type,
      amount: notification.gross_amount,
    });

    // Extract transaction ID from order_id
    // Format: PAY-{transactionId}-{timestamp}
    const orderIdParts = notification.order_id.split('-');
    if (orderIdParts.length < 2 || orderIdParts[0] !== 'PAY') {
      console.error('[WEBHOOK] Invalid order_id format:', notification.order_id);
      return NextResponse.json(
        { error: 'Invalid order_id format' },
        { status: 400 }
      );
    }

    const transactionId = orderIdParts[1];

    // Verify the notification with Midtrans (double-check)
    const verificationResult = await MidtransService.getTransactionStatus(
      notification.order_id
    );

    if (
      verificationResult.status_code &&
      verificationResult.status_code !== '200' &&
      verificationResult.status_code !== '201'
    ) {
      console.warn('[WEBHOOK] Transaction verification failed:', verificationResult);
      // Continue processing but log warning - Midtrans may have delay
    }

    // Process the notification
    const result = await MidtransService.handleNotification(notification);

    // Map Midtrans status to our payment status
    let paymentStatus: string;
    let paidAt: string | null = null;

    switch (result.status) {
      case 'paid':
        paymentStatus = 'PAID';
        paidAt = new Date().toISOString();
        break;
      case 'failed':
        paymentStatus = 'FAILED';
        break;
      case 'refunded':
        paymentStatus = 'REFUNDED';
        break;
      case 'pending':
      default:
        paymentStatus = 'PENDING';
        break;
    }

    // Update billing transaction
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_method: notification.payment_type,
      midtrans_transaction_id: notification.transaction_id,
      updated_at: new Date().toISOString(),
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { data: transaction, error: updateError } = await supabaseAdmin
      .from('billing_transaction')
      .update(updateData)
      .eq('id', transactionId)
      .select('id, customer_id, invoice_number, amount_total, service_type')
      .single();

    if (updateError) {
      console.error('[WEBHOOK] Failed to update transaction:', updateError);
      // Return 200 to Midtrans to prevent retry loops, but log error
      return NextResponse.json({
        success: false,
        error: 'Failed to update transaction',
        message: updateError.message,
      });
    }

    // Create audit log for payment event
    await supabaseAdmin.from('audit_log').insert({
      customer_id: transaction.customer_id,
      actor_user_id: null, // System action
      actor_organization_id: null,
      actor_role: 'SYSTEM',
      activity_type: `PAYMENT_${paymentStatus}`,
      activity_details: {
        transactionId: transaction.id,
        invoiceNumber: transaction.invoice_number,
        amountTotal: transaction.amount_total,
        serviceType: transaction.service_type,
        paymentMethod: notification.payment_type,
        midtransTransactionId: notification.transaction_id,
        midtransStatus: notification.transaction_status,
        fraudStatus: notification.fraud_status,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'midtrans',
      user_agent: 'midtrans-webhook',
    });

    // If payment successful, send notification to customer
    if (paymentStatus === 'PAID') {
      // Get customer's user_id for notification
      const { data: customer } = await supabaseAdmin
        .from('customer')
        .select('user_id')
        .eq('id', transaction.customer_id)
        .single();

      if (customer?.user_id) {
        await supabaseAdmin.from('notification').insert({
          user_id: customer.user_id,
          type: 'PAYMENT_RECEIVED',
          title: 'Pembayaran Berhasil',
          message: `Pembayaran untuk invoice ${transaction.invoice_number} sebesar Rp ${transaction.amount_total.toLocaleString('id-ID')} telah diterima. Terima kasih!`,
          priority: 'MEDIUM',
          channel: 'IN_APP',
          data: {
            transactionId: transaction.id,
            invoiceNumber: transaction.invoice_number,
            amountTotal: transaction.amount_total,
          },
        });
      }
    }

    console.log('[WEBHOOK] Payment processed successfully:', {
      transactionId,
      paymentStatus,
      invoiceNumber: transaction.invoice_number,
    });

    // Midtrans expects 200 OK response
    return NextResponse.json({
      success: true,
      transactionId,
      paymentStatus,
    });
  } catch (error) {
    console.error('[WEBHOOK] Error processing Midtrans notification:', error);

    // Return 200 to prevent Midtrans retry loops
    // Log error for investigation
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/webhooks/midtrans
 *
 * Health check endpoint - Midtrans may ping this to verify webhook URL
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ai-pajak-payment-webhook',
    timestamp: new Date().toISOString(),
  });
}
