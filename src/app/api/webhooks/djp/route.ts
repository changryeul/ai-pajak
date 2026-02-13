/**
 * DJP Webhook Handler
 *
 * Handles callback notifications from DJP (Direktorat Jenderal Pajak)
 * Events: FILING_ACCEPTED, FILING_REJECTED, BPE_READY, BILLING_PAID
 *
 * Pattern: Following Midtrans webhook pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DJPService } from '@/lib/djp/djp-service';
import { queueDJPJob } from '@/lib/djp/queue';
import type { DJPWebhookEventType, DJPJobRow } from '@/lib/djp/types';

// Admin client for webhook processing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WebhookPayload {
  event_type: string;
  transaction_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * POST /api/webhooks/djp
 *
 * Handle DJP webhook notifications
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-DJP-Signature') || '';
    const timestamp = request.headers.get('X-DJP-Timestamp') || '';

    // Log webhook receipt
    console.info('[DJP Webhook] Received', {
      signature: signature.slice(0, 20) + '...',
      timestamp,
      bodyLength: rawBody.length,
    });

    // Verify signature
    const isValid = DJPService.verifyWebhookSignature(rawBody, signature, timestamp);

    // Log to webhook_log table
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[DJP Webhook] Invalid JSON payload');
      await logWebhook(null, rawBody, signature, false, 'INVALID_JSON');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await logWebhook(payload, rawBody, signature, isValid, null);

    if (!isValid) {
      console.error('[DJP Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const eventType = payload.event_type as DJPWebhookEventType;
    const transactionId = payload.transaction_id;

    console.info('[DJP Webhook] Processing', {
      eventType,
      transactionId,
    });

    // Find the job/filing by transaction ID
    const { data: job } = await supabaseAdmin
      .from('djp_job')
      .select('id, tax_filing_id, customer_id, type')
      .eq('djp_transaction_id', transactionId)
      .single<Pick<DJPJobRow, 'id' | 'tax_filing_id' | 'customer_id' | 'type'>>();

    if (!job) {
      console.warn('[DJP Webhook] Job not found for transaction:', transactionId);
      // Still return success to prevent DJP from retrying
      return NextResponse.json({ received: true, warning: 'Job not found' });
    }

    // Handle different event types
    switch (eventType) {
      case 'FILING_ACCEPTED':
        await handleFilingAccepted(job, payload.data);
        break;

      case 'FILING_REJECTED':
        await handleFilingRejected(job, payload.data);
        break;

      case 'BPE_READY':
        await handleBPEReady(job, payload.data, transactionId);
        break;

      case 'BILLING_PAID':
        await handleBillingPaid(job, payload.data);
        break;

      default:
        console.warn('[DJP Webhook] Unknown event type:', eventType);
    }

    // Create audit log
    if (job.customer_id || job.tax_filing_id) {
      await supabaseAdmin.from('audit_log').insert({
        customer_id: job.customer_id,
        tax_filing_id: job.tax_filing_id,
        actor_user_id: null,
        actor_role: 'SYSTEM',
        activity_type: `DJP_${eventType}`,
        activity_details: {
          transactionId,
          data: payload.data,
          processingTimeMs: Date.now() - startTime,
        },
        ip_address: request.headers.get('x-forwarded-for') || 'djp-webhook',
        user_agent: request.headers.get('user-agent') || 'djp-webhook',
      });
    }

    console.info('[DJP Webhook] Processed successfully', {
      eventType,
      transactionId,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({ received: true, eventType });
  } catch (error) {
    console.error('[DJP Webhook] Error:', error);

    // Still return 200 to prevent DJP from retrying on our errors
    return NextResponse.json(
      {
        received: true,
        error: 'Internal processing error',
      },
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhooks/djp
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ai-pajak-djp-webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleFilingAccepted(
  job: Pick<DJPJobRow, 'id' | 'tax_filing_id' | 'customer_id'>,
  data: Record<string, unknown>
): Promise<void> {
  const bpeNumber = data.bpe_number as string | undefined;
  const bpeDate = data.bpe_date as string | undefined;

  // Update tax filing
  if (job.tax_filing_id) {
    await supabaseAdmin
      .from('tax_filing')
      .update({
        status: 'FILED',
        djp_submission_status: 'ACCEPTED',
        bpe_number: bpeNumber,
        bpe_date: bpeDate,
        filed_at: new Date().toISOString(),
      })
      .eq('id', job.tax_filing_id);
  }

  // Update job
  await supabaseAdmin
    .from('djp_job')
    .update({
      status: 'COMPLETED',
      result: data,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // Send notification
  await sendFilingNotification(job.tax_filing_id, 'accepted', bpeNumber);

  console.info('[DJP Webhook] Filing accepted', {
    taxFilingId: job.tax_filing_id,
    bpeNumber,
  });
}

async function handleFilingRejected(
  job: Pick<DJPJobRow, 'id' | 'tax_filing_id'>,
  data: Record<string, unknown>
): Promise<void> {
  const errorCode = data.error_code as string | undefined;
  const errorMessage = data.error_message as string | undefined;

  if (job.tax_filing_id) {
    await supabaseAdmin
      .from('tax_filing')
      .update({
        status: 'DRAFT', // Revert to draft so user can fix
        djp_submission_status: 'REJECTED',
        djp_error_code: errorCode,
        djp_error_message: errorMessage,
      })
      .eq('id', job.tax_filing_id);
  }

  await supabaseAdmin
    .from('djp_job')
    .update({
      status: 'FAILED',
      error_message: errorMessage || 'Filing rejected by DJP',
      result: data,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // Send notification
  await sendFilingNotification(job.tax_filing_id, 'rejected', undefined);

  console.info('[DJP Webhook] Filing rejected', {
    taxFilingId: job.tax_filing_id,
    errorCode,
  });
}

async function handleBPEReady(
  job: Pick<DJPJobRow, 'id' | 'tax_filing_id'>,
  data: Record<string, unknown>,
  transactionId: string
): Promise<void> {
  // Queue BPE retrieval job to get the PDF
  if (job.tax_filing_id) {
    const npwp = data.npwp as string;

    await queueDJPJob({
      type: 'BPE_RETRIEVAL',
      taxFilingId: job.tax_filing_id,
      payload: {
        transactionId,
        npwp: npwp || '',
      },
      priority: 'HIGH',
      maxRetries: 3,
    });

    console.info('[DJP Webhook] BPE retrieval queued', {
      taxFilingId: job.tax_filing_id,
    });
  }
}

async function handleBillingPaid(
  job: Pick<DJPJobRow, 'id'>,
  data: Record<string, unknown>
): Promise<void> {
  const ntpn = data.ntpn as string | undefined;
  const paymentDate = data.payment_date as string | undefined;

  // Update billing record
  await supabaseAdmin
    .from('djp_billing')
    .update({
      ntpn,
      payment_date: paymentDate,
      status: 'PAID',
    })
    .eq('djp_job_id', job.id);

  // Update job result
  const { data: existingJob } = await supabaseAdmin
    .from('djp_job')
    .select('result')
    .eq('id', job.id)
    .single<{ result: Record<string, unknown> | null }>();

  await supabaseAdmin
    .from('djp_job')
    .update({
      result: {
        ...(existingJob?.result || {}),
        ntpn,
        paymentDate,
        paidAt: new Date().toISOString(),
      },
    })
    .eq('id', job.id);

  console.info('[DJP Webhook] Billing payment recorded', {
    jobId: job.id,
    ntpn,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function logWebhook(
  payload: WebhookPayload | null,
  rawBody: string,
  signature: string,
  isValid: boolean,
  error: string | null
): Promise<void> {
  try {
    await supabaseAdmin.from('djp_webhook_log').insert({
      event_type: payload?.event_type || 'UNKNOWN',
      transaction_id: payload?.transaction_id,
      payload: payload || { raw: rawBody.slice(0, 1000) },
      signature,
      is_valid_signature: isValid,
      processing_result: error ? 'FAILED' : 'SUCCESS',
      error_message: error,
    });
  } catch (logError) {
    console.error('[DJP Webhook] Failed to log webhook:', logError);
  }
}

async function sendFilingNotification(
  taxFilingId: string | null,
  status: 'accepted' | 'rejected',
  bpeNumber: string | undefined
): Promise<void> {
  if (!taxFilingId) return;

  try {
    // Get filing with customer info
    const { data: filing } = await supabaseAdmin
      .from('tax_filing')
      .select(
        `
        id, tax_type, tax_period,
        customer:customer_id (user_id, full_name, email)
      `
      )
      .eq('id', taxFilingId)
      .single();

    if (!filing?.customer) return;

    const customer = filing.customer as {
      user_id?: string;
      full_name?: string;
      email?: string;
    };

    // Create in-app notification
    if (customer.user_id) {
      await supabaseAdmin.from('notification').insert({
        user_id: customer.user_id,
        type: status === 'accepted' ? 'TAX_FILING_ACCEPTED' : 'TAX_FILING_REJECTED',
        title:
          status === 'accepted' ? 'Laporan Pajak Diterima' : 'Laporan Pajak Ditolak',
        message:
          status === 'accepted'
            ? `SPT ${filing.tax_type} periode ${filing.tax_period} telah diterima DJP. BPE: ${bpeNumber}`
            : `SPT ${filing.tax_type} periode ${filing.tax_period} ditolak oleh DJP. Silakan periksa dan perbaiki.`,
        priority: status === 'rejected' ? 'HIGH' : 'MEDIUM',
        channel: 'IN_APP',
        data: { taxFilingId, bpeNumber },
      });
    }

    console.info('[DJP Webhook] Notification sent', {
      taxFilingId,
      status,
      userId: customer.user_id,
    });
  } catch (error) {
    // Don't fail the webhook for notification errors
    console.error('[DJP Webhook] Failed to send notification:', error);
  }
}
