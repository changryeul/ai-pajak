/**
 * Payment Reminders Cron Endpoint
 *
 * Checks for unpaid tax obligations and sends reminders via email + WhatsApp.
 * Runs daily at 09:00 via Vercel Cron.
 *
 * POST /api/cron/payment-reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPaymentReminder as sendWaPaymentReminder } from '@/lib/notifications/whatsapp-service';
import { loggers } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

interface QueueItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  ebilling_code: string | null;
  created_at: string;
  customer: {
    full_name: string;
    phone_number: string | null;
    user_id: string;
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    loggers.api.info('Starting payment reminders job');
    const startTime = Date.now();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find queue items pending payment
    const { data: items, error } = await supabase
      .from('djp_submission_queue')
      .select(`
        id, customer_id, tax_type, tax_period_month, tax_period_year,
        amount, status, ebilling_code, created_at,
        customer:customer_id(full_name, phone_number, user_id)
      `)
      .in('status', ['PAYMENT_PENDING', 'EBILLING_GENERATED'])
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch queue items: ${error.message}`);
    }

    let waSent = 0;
    let inAppSent = 0;
    const errors: string[] = [];

    // Batch-fetch WhatsApp preferences for all unique user_ids (avoids N+1)
    const userIds = [...new Set((items as unknown as QueueItem[])?.map(i => i.customer?.user_id).filter(Boolean) || [])];
    const { data: allPrefs } = userIds.length > 0
      ? await supabase.from('notification_preferences').select('user_id, whatsapp_enabled').in('user_id', userIds)
      : { data: [] };
    const prefsMap = new Map((allPrefs || []).map(p => [p.user_id, p.whatsapp_enabled]));

    for (const item of (items as unknown as QueueItem[]) || []) {
      const customer = item.customer;
      if (!customer) continue;

      const period = `${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}`;

      // Check WhatsApp preference (from batch-fetched map)
      if (customer.phone_number) {
        const waEnabled = prefsMap.get(customer.user_id);

        if (waEnabled) {
          try {
            const result = await sendWaPaymentReminder(
              customer.phone_number,
              customer.full_name,
              item.amount || 0,
              period
            );

            if (result.success) {
              waSent++;
              // Log to WhatsApp message log
              await supabase.from('whatsapp_message_log').insert({
                customer_id: item.customer_id,
                user_id: customer.user_id,
                message_type: 'PAYMENT_REMINDER',
                phone_number: customer.phone_number,
                message_text: `Payment reminder: ${item.tax_type} ${period} Rp ${item.amount}`,
                provider_message_id: result.messageId,
                status: 'SENT',
              }).then(() => {}, () => {});
            }
          } catch (err) {
            errors.push(`WA to ${customer.full_name}: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
      }

      // Create in-app notification
      await supabase.from('notification').insert({
        user_id: customer.user_id,
        type: 'PAYMENT_DUE',
        title: `Pembayaran ${item.tax_type} - ${period}`,
        message: `Tagihan pajak ${item.tax_type} sebesar Rp ${(item.amount || 0).toLocaleString('id-ID')} menunggu pembayaran.${item.ebilling_code ? ` Kode e-Billing: ${item.ebilling_code}` : ''}`,
        priority: 'HIGH',
        data: { queueItemId: item.id, taxType: item.tax_type, amount: item.amount },
      }).then(() => {}, () => {});
      inAppSent++;
    }

    const duration = Date.now() - startTime;

    loggers.api.info({
      duration: `${duration}ms`,
      totalItems: items?.length || 0,
      waSent,
      inAppSent,
      errors: errors.length,
    }, 'Payment reminders completed');

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      processed: items?.length || 0,
      waSent,
      inAppSent,
      errors,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Payment reminders failed');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'payment-reminders',
    configured: !!CRON_SECRET,
  });
}
