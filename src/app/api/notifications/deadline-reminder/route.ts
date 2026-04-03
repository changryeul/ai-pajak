import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendDeadlineReminder } from '@/lib/notifications/email-service';

/**
 * POST /api/notifications/deadline-reminder
 *
 * Checks for upcoming tax deadlines (D-3, D-1) and sends email reminders.
 * Designed to be called by a cron job (Vercel Cron or external scheduler).
 *
 * Auth: Requires service role key or cron secret.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret or service role
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date();
  const d1 = new Date(now); d1.setDate(d1.getDate() + 1);
  const d3 = new Date(now); d3.setDate(d3.getDate() + 3);

  // Find unpaid payments with deadlines in 1 or 3 days
  const { data: urgentPayments } = await admin
    .from('tax_monthly_payment')
    .select('*, customer:customer_id(full_name, email)')
    .in('status', ['UNPAID', 'PARTIAL'])
    .or(`payment_deadline.eq.${d1.toISOString().slice(0, 10)},payment_deadline.eq.${d3.toISOString().slice(0, 10)}`);

  let sent = 0;
  let failed = 0;

  for (const payment of urgentPayments || []) {
    const customer = payment.customer as { full_name: string; email: string } | null;
    if (!customer?.email) continue;

    const deadline = new Date(payment.payment_deadline);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    try {
      await sendDeadlineReminder({
        to: customer.email,
        customerName: customer.full_name || 'Wajib Pajak',
        taxType: payment.tax_type,
        taxPeriod: payment.tax_period,
        deadlineDate: payment.payment_deadline,
        daysRemaining: daysLeft,
        amountDue: payment.amount_due,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      checked: (urgentPayments || []).length,
      sent,
      failed,
      checkedAt: now.toISOString(),
    },
  });
}
