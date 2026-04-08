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
      return NextResponse.json({ success: true, data: { sent: 0 }, message: '미납 건이 없습니다' });
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

      // Build message
      const billingList = customerItems.map(i =>
        `• ${i.tax_type} ${i.tax_period_year}-${String(i.tax_period_month).padStart(2, '0')}: Rp ${i.amount?.toLocaleString('id-ID')} (코드: ${i.ebilling_code})`
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
              text: `🔴 *미납 세금 알림*\n\n안녕하세요, ${customerName}님.\n\n아래 ${customerItems.length}건의 세금이 아직 납부되지 않았습니다:\n\n${billingList}\n\n💰 *총 납부액: Rp ${totalAmount.toLocaleString('id-ID')}*\n\n은행/ATM/모바일뱅킹에서 위 ID Billing 코드로 납부해주세요.\n납부 후 증빙을 업로드해주세요:\n${appUrl}/tax/billing\n\n_AI Pajak_`,
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
              text: `🔴 *미납 세금 알림*\n\n안녕하세요, ${customerName}님.\n\n${customerItems.length}건 미납:\n\n${billingList}\n\n💰 총 납부액: *Rp ${totalAmount.toLocaleString('id-ID')}*\n\n[납부 페이지](${appUrl}/tax/billing)`,
            });
            tgSent++;
          } catch { /* */ }
        }
      }

      // In-app notification
      await admin.from('notification').insert({
        user_id: customer.user_id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: `미납 세금 ${customerItems.length}건`,
        message: `총 Rp ${totalAmount.toLocaleString('id-ID')} 납부가 필요합니다. 청구서 페이지에서 확인하세요.`,
        priority: 'HIGH',
        data: { action: 'billing-reminder' },
      });
    }

    loggers.api.info({ customers: byCustomer.size, waSent, tgSent }, 'Billing reminders sent');

    return NextResponse.json({
      success: true,
      data: { customers: byCustomer.size, unpaidItems: items.length, waSent, tgSent },
      message: `${byCustomer.size}명의 고객에게 미납 알림 발송 (WhatsApp ${waSent}, Telegram ${tgSent})`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Billing reminder error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
