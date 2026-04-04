/**
 * Monthly Tax Report Cron Endpoint
 *
 * Generates monthly tax analysis reports and sends WhatsApp notifications.
 * Runs on the 1st of each month at 10:00.
 *
 * POST /api/cron/monthly-report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSavingsReport } from '@/lib/notifications/whatsapp-service';
import { loggers } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    loggers.api.info('Starting monthly report job');
    const startTime = Date.now();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Previous month period
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    // Get all customers with WhatsApp enabled
    const { data: customers } = await supabase
      .from('customer')
      .select(`
        id, full_name, phone_number, user_id,
        notification_preferences:user_id(whatsapp_enabled)
      `)
      .not('phone_number', 'is', null);

    // Batch-fetch ALL tax calculations for the period (avoids N+1)
    const customerIds = (customers || []).map(c => c.id);
    const { data: allCalcs } = customerIds.length > 0
      ? await supabase
          .from('tax_calculation')
          .select('customer_id, calculation_result, income_data')
          .in('customer_id', customerIds)
          .eq('tax_period', period)
      : { data: [] };

    // Group calculations by customer
    const calcsByCustomer = new Map<string, typeof allCalcs>();
    for (const calc of allCalcs || []) {
      const existing = calcsByCustomer.get(calc.customer_id) || [];
      existing.push(calc);
      calcsByCustomer.set(calc.customer_id, existing);
    }

    let waSent = 0;
    let inAppSent = 0;

    for (const customer of customers || []) {
      const calcs = calcsByCustomer.get(customer.id);
      if (!calcs || calcs.length === 0) continue;

      const totalTax = calcs.reduce((sum: number, c: { calculation_result?: { calculatedTax?: number } }) =>
        sum + (c.calculation_result?.calculatedTax || 0), 0);

      // Check for missing NPWPs (savings opportunity)
      const noNpwp = calcs.filter((c: { income_data?: { recipient_npwp?: string } }) => !c.income_data?.recipient_npwp);
      const potentialSavings = noNpwp.length > 0
        ? noNpwp.reduce((sum: number, c: { calculation_result?: { calculatedTax?: number } }) =>
          sum + (c.calculation_result?.calculatedTax || 0) * 0.5, 0)
        : 0;

      // Create in-app notification
      try {
        await supabase.from('notification').insert({
          user_id: customer.user_id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: `Laporan Pajak ${period}`,
          message: `Laporan analisis pajak bulan ${period} sudah tersedia. Total pajak: Rp ${totalTax.toLocaleString('id-ID')}.${potentialSavings > 0 ? ` Potensi penghematan: Rp ${Math.round(potentialSavings).toLocaleString('id-ID')}.` : ''}`,
          priority: 'MEDIUM',
          data: { period, totalTax, potentialSavings },
        });
      } catch { /* best-effort */ }
      inAppSent++;

      // Send WhatsApp if opted in
      const prefs = customer.notification_preferences as unknown as { whatsapp_enabled?: boolean } | null;
      if (customer.phone_number && prefs?.whatsapp_enabled) {
        try {
          const result = await sendSavingsReport(
            customer.phone_number,
            customer.full_name,
            period,
            Math.round(potentialSavings),
            noNpwp.length
          );

          if (result.success) {
            waSent++;
            await supabase.from('whatsapp_message_log').insert({
              customer_id: customer.id,
              user_id: customer.user_id,
              message_type: 'SAVINGS_REPORT',
              phone_number: customer.phone_number,
              message_text: `Monthly report ${period}: tax=${totalTax}, savings=${potentialSavings}`,
              provider_message_id: result.messageId,
              status: 'SENT',
            }).then(() => {}, () => {});
          }
        } catch {
          // Best-effort
        }
      }
    }

    const duration = Date.now() - startTime;

    loggers.api.info({
      duration: `${duration}ms`,
      period,
      customers: customers?.length || 0,
      waSent,
      inAppSent,
    }, 'Monthly report completed');

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      period,
      customersProcessed: customers?.length || 0,
      waSent,
      inAppSent,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Monthly report cron failed');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'monthly-report',
    configured: !!CRON_SECRET,
  });
}
