import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { sendWhatsApp } from '@/lib/notifications/whatsapp-service';
import { sendTelegram } from '@/lib/notifications/telegram-service';

/**
 * POST /api/tax/billing-reminder
 *
 * Sends payment reminders for unpaid ID Billings via WhatsApp + Telegram.
 * Can be triggered by:
 *   - Cron job (daily)
 *   - Manual trigger from admin
 *   - Dashboard auto-check
 *
 * Finds all items with status EBILLING_GENERATED or PAYMENT_PENDING
 * and sends reminders to the customer.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin();

    // Find all unpaid billings
    const { data: items } = await admin
      .from('djp_submission_queue')
      .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, ebilling_code, status, created_at')
      .in('status', ['EBILLING_GENERATED', 'PAYMENT_PENDING'])
      .not('ebilling_code', 'is', null);

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, data: { sent: 0 }, message: 'No unpaid items' });
    }

    // Group by customer
    const byCustomer = new Map<string, typeof items>();
    for (const item of items) {
      const list = byCustomer.get(item.customer_id) || [];
      list.push(item);
      byCustomer.set(item.customer_id, list);
    }

    let waSent = 0;
    let tgSent = 0;

    for (const [customerId, customerItems] of byCustomer) {
      // Get customer info
      const { data: customer } = await admin
        .from('customer')
        .select('user_id, full_name, company_name, phone_number, telegram_chat_id')
        .eq('id', customerId)
        .single();
      if (!customer) continue;

      const customerName = customer.company_name || customer.full_name;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app';

      // Customer-facing copy is in Indonesian. Once `customer.locale` exists
      // we can branch per recipient.
      const billingList = customerItems.map(i =>
        `• ${i.tax_type} ${i.tax_period_year}-${String(i.tax_period_month).padStart(2, '0')}: Rp ${i.amount?.toLocaleString('id-ID')} (kode: ${i.ebilling_code})`
      ).join('\n');

      const totalAmount = customerItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

      // WhatsApp
      if (customer.phone_number) {
        const { data: prefs } = await admin
          .from('notification_preferences')
          .select('whatsapp_enabled')
          .eq('user_id', customer.user_id)
          .maybeSingle();

        if (prefs?.whatsapp_enabled) {
          try {
            await sendWhatsApp({
              to: customer.phone_number,
              text: `🔴 *Pajak Belum Dibayar*\n\nHalo ${customerName},\n\n${customerItems.length} item pajak berikut belum dibayar:\n\n${billingList}\n\n💰 *Total: Rp ${totalAmount.toLocaleString('id-ID')}*\n\nMohon lakukan pembayaran melalui bank/ATM/mobile banking dengan kode ID Billing di atas, lalu unggah bukti pembayaran:\n${appUrl}/tax/billing\n\n_AI Pajak_`,
            });
            waSent++;
          } catch { /* */ }
        }
      }

      // Telegram
      if (customer.telegram_chat_id) {
        const { data: telePrefs } = await admin
          .from('notification_preferences')
          .select('telegram_enabled')
          .eq('user_id', customer.user_id)
          .maybeSingle();

        if (telePrefs?.telegram_enabled) {
          try {
            await sendTelegram({
              chatId: customer.telegram_chat_id,
              text: `🔴 *Pajak Belum Dibayar*\n\nHalo ${customerName},\n\n${customerItems.length} item belum dibayar:\n\n${billingList}\n\n💰 Total: *Rp ${totalAmount.toLocaleString('id-ID')}*\n\n[Halaman pembayaran](${appUrl}/tax/billing)`,
            });
            tgSent++;
          } catch { /* */ }
        }
      }

      // In-app notification (Indonesian)
      await admin.from('notification').insert({
        user_id: customer.user_id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: `${customerItems.length} pajak belum dibayar`,
        message: `Total Rp ${totalAmount.toLocaleString('id-ID')} perlu dibayar. Periksa halaman tagihan.`,
        priority: 'HIGH',
        data: { action: 'billing-reminder' },
      });
    }

    loggers.api.info({ customers: byCustomer.size, waSent, tgSent }, 'Billing reminders sent');

    return NextResponse.json({
      success: true,
      data: { customers: byCustomer.size, unpaidItems: items.length, waSent, tgSent },
      message: `Sent reminders to ${byCustomer.size} customers (WhatsApp ${waSent}, Telegram ${tgSent})`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Billing reminder error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
