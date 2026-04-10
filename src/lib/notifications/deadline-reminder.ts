/**
 * Deadline Reminder Service
 *
 * Checks for upcoming tax deadlines and creates notifications
 * for customers and consultants.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NotificationService } from './notification-service';
import { sendDeadlineReminder as sendWaDeadlineReminder } from './whatsapp-service';
import { DeadlineReminderData, NotificationPriority } from './types';
import { loggers } from '@/lib/logger';

// Type for tax filing query result
interface TaxFilingRecord {
  customer_id: string;
  tax_type: string;
  tax_period: string;
  status: string;
}

// Tax deadlines — Coretax / PMK 81/2024 (effective 2025-01-01)
// All PPh payments: 15th of following month.
// All SPT Masa PPh filings: 20th of following month.
// PPN payment + SPT Masa PPN filing: BOTH end of following month (exception).
const TAX_DEADLINES: Record<string, { deadline: number; name: string }> = {
  PPh21: { deadline: 15, name: 'PPh 21' },
  PPh23: { deadline: 15, name: 'PPh 23' },
  PPh_4_2: { deadline: 15, name: 'PPh 4(2) Final' },
  PPh25: { deadline: 15, name: 'PPh 25' },
  PPh26: { deadline: 15, name: 'PPh 26' },
  PPh_FINAL: { deadline: 15, name: 'PPh Final UMKM' },
  PPN: { deadline: 31, name: 'PPN' }, // end of following month (payment + filing)
  SPT_MASA: { deadline: 20, name: 'SPT Masa PPh' },
  SPT_TAHUNAN: { deadline: 31, name: 'SPT Tahunan' }, // March 31 for individuals
};

// Default reminder days before deadline
const DEFAULT_REMINDER_DAYS = [30, 14, 7, 3, 1];

interface CustomerWithPreferences {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  notification_preferences?: {
    deadline_reminders: boolean;
    reminder_days_before: number[];
  };
}

interface UpcomingDeadline {
  customerId: string;
  customerName: string;
  customerUserId: string;
  customerEmail: string;
  taxType: string;
  taxTypeName: string;
  taxPeriod: string;
  dueDate: Date;
  daysUntilDue: number;
}

/**
 * Get upcoming tax deadlines for all customers
 */
export async function getUpcomingDeadlines(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  daysAhead: number = 30
): Promise<UpcomingDeadline[]> {
  const today = new Date();
  const deadlines: UpcomingDeadline[] = [];

  // Get all active customers with their preferences
  const { data: customers, error } = await supabase
    .from('customer')
    .select(`
      id,
      user_id,
      full_name,
      email,
      notification_preferences (
        deadline_reminders,
        reminder_days_before
      )
    `)
    .order('created_at', { ascending: false });

  if (error || !customers) {
    loggers.email.error({ err: error }, 'Error fetching customers for deadline reminders');
    return [];
  }

  // Get existing tax filings to determine which periods need reminders
  const { data: filings, error: filingError } = await supabase
    .from('tax_filing')
    .select('customer_id, tax_type, tax_period, status')
    .in('status', ['DRAFT', 'UNDER_REVIEW'])
    .returns<TaxFilingRecord[]>();

  if (filingError) {
    loggers.email.error({ err: filingError }, 'Error fetching filings for deadline reminders');
  }

  // Build a map of filed periods
  const filedPeriods = new Set(
    (filings || []).map((f: TaxFilingRecord) => `${f.customer_id}-${f.tax_type}-${f.tax_period}`)
  );

  // For each customer, check upcoming deadlines
  for (const customer of customers as unknown as CustomerWithPreferences[]) {
    // Skip if customer has disabled deadline reminders
    if (customer.notification_preferences?.deadline_reminders === false) {
      continue;
    }

    // Check each tax type
    for (const [taxType, config] of Object.entries(TAX_DEADLINES)) {
      // Calculate the next deadline
      const nextDeadline = getNextDeadline(taxType, config.deadline, today);
      const daysUntil = Math.ceil(
        (nextDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Skip if deadline is too far away
      if (daysUntil > daysAhead || daysUntil < 0) {
        continue;
      }

      // Format tax period (YYYY-MM)
      const taxPeriod = formatTaxPeriod(nextDeadline, taxType);

      // Skip if already filed for this period
      const filingKey = `${customer.id}-${taxType}-${taxPeriod}`;
      if (filedPeriods.has(filingKey)) {
        continue;
      }

      deadlines.push({
        customerId: customer.id,
        customerName: customer.full_name,
        customerUserId: customer.user_id,
        customerEmail: customer.email,
        taxType,
        taxTypeName: config.name,
        taxPeriod,
        dueDate: nextDeadline,
        daysUntilDue: daysUntil,
      });
    }
  }

  return deadlines;
}

/**
 * Calculate the next deadline date for a tax type
 */
function getNextDeadline(taxType: string, deadlineDay: number, fromDate: Date): Date {
  const year = fromDate.getFullYear();
  let month = fromDate.getMonth();
  const day = deadlineDay;

  // SPT Tahunan is special - always March 31 of next year
  if (taxType === 'SPT_TAHUNAN') {
    // If we're past March 31, deadline is next year
    const march31 = new Date(year, 2, 31);
    if (fromDate > march31) {
      return new Date(year + 1, 2, 31);
    }
    return march31;
  }

  // For monthly taxes, deadline is for the previous month's reporting
  // So if today is Jan 5, the deadline Jan 10 is for December's report
  let deadlineDate = new Date(year, month, day);

  // If we're past this month's deadline, the next one is next month
  if (fromDate.getDate() > deadlineDay) {
    month += 1;
    if (month > 11) {
      month = 0;
    }
    deadlineDate = new Date(month === 0 ? year + 1 : year, month, day);
  }

  return deadlineDate;
}

/**
 * Format tax period based on tax type and deadline
 */
function formatTaxPeriod(deadline: Date, taxType: string): string {
  if (taxType === 'SPT_TAHUNAN') {
    // SPT Tahunan reports previous year
    return (deadline.getFullYear() - 1).toString();
  }

  // Monthly taxes report for previous month
  const reportMonth = deadline.getMonth() === 0 ? 12 : deadline.getMonth();
  const reportYear =
    deadline.getMonth() === 0 ? deadline.getFullYear() - 1 : deadline.getFullYear();

  return `${reportYear}-${reportMonth.toString().padStart(2, '0')}`;
}

/**
 * Get notification priority based on days until deadline
 */
function getPriority(daysUntilDue: number): NotificationPriority {
  if (daysUntilDue <= 1) return 'HIGH';
  if (daysUntilDue <= 7) return 'MEDIUM';
  return 'LOW';
}

/**
 * Check if a reminder should be sent based on days until deadline
 */
function shouldSendReminder(
  daysUntilDue: number,
  reminderDays: number[] = DEFAULT_REMINDER_DAYS
): boolean {
  return reminderDays.includes(daysUntilDue);
}

/**
 * Process deadline reminders and create notifications
 */
export async function processDeadlineReminders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<{
  processed: number;
  notificationsSent: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    const deadlines = await getUpcomingDeadlines(supabase, 30);
    result.processed = deadlines.length;

    const notificationService = new NotificationService(supabase);

    for (const deadline of deadlines) {
      // Check if we should send a reminder for this number of days
      if (!shouldSendReminder(deadline.daysUntilDue)) {
        continue;
      }

      // Check if we've already sent a reminder for this deadline
      const reminderKey = `deadline-${deadline.customerId}-${deadline.taxType}-${deadline.taxPeriod}-${deadline.daysUntilDue}`;

      // Check for existing notification with same data
      const { data: existingNotification } = await supabase
        .from('notification')
        .select('id')
        .eq('user_id', deadline.customerUserId)
        .eq('type', 'DEADLINE_REMINDER')
        .contains('data', { reminderKey })
        .single();

      if (existingNotification) {
        continue; // Already sent this reminder
      }

      // Create reminder data with full URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com';
      const reminderData: DeadlineReminderData = {
        customerName: deadline.customerName,
        taxType: deadline.taxTypeName,
        taxPeriod: deadline.taxPeriod,
        dueDate: deadline.dueDate.toISOString().split('T')[0],
        daysUntilDue: deadline.daysUntilDue,
        filingUrl: `${baseUrl}/tax/filing?type=${deadline.taxType}&period=${deadline.taxPeriod}`,
      };

      try {
        // Create notification and send email
        await notificationService.sendNotification({
          userId: deadline.customerUserId,
          email: deadline.customerEmail, // Include email for email notification
          type: 'DEADLINE_REMINDER',
          priority: getPriority(deadline.daysUntilDue),
          title: getDeadlineTitle(deadline.daysUntilDue, deadline.taxTypeName),
          message: getDeadlineMessage(deadline),
          data: {
            ...reminderData,
            reminderKey,
          },
        });

        result.notificationsSent++;

        // Also send WhatsApp if customer opted in
        try {
          const { data: customer } = await supabase
            .from('customer')
            .select('phone_number')
            .eq('id', deadline.customerId)
            .single();

          if (customer?.phone_number) {
            const { data: prefs } = await supabase
              .from('notification_preferences')
              .select('whatsapp_enabled')
              .eq('user_id', deadline.customerUserId)
              .single();

            if (prefs?.whatsapp_enabled) {
              const waResult = await sendWaDeadlineReminder(
                customer.phone_number,
                deadline.customerName,
                deadline.taxTypeName,
                deadline.dueDate.toISOString().split('T')[0],
                deadline.daysUntilDue
              );

              if (waResult.success) {
                await supabase.from('whatsapp_message_log').insert({
                  customer_id: deadline.customerId,
                  user_id: deadline.customerUserId,
                  message_type: 'DEADLINE_REMINDER',
                  phone_number: customer.phone_number,
                  message_text: `Deadline: ${deadline.taxTypeName} ${deadline.taxPeriod} D-${deadline.daysUntilDue}`,
                  provider_message_id: waResult.messageId,
                  status: 'SENT',
                }).then(() => {}, () => {});
              }
            }
          }
        } catch {
          // WhatsApp is best-effort, don't fail the whole process
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(
          `Failed to send reminder for ${deadline.customerName}: ${errorMessage}`
        );
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Process failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Get notification title based on urgency
 */
function getDeadlineTitle(daysUntilDue: number, taxType: string): string {
  if (daysUntilDue <= 0) {
    return `Batas Waktu ${taxType} Hari Ini!`;
  }
  if (daysUntilDue === 1) {
    return `Batas Waktu ${taxType} Besok!`;
  }
  if (daysUntilDue <= 7) {
    return `${taxType} - ${daysUntilDue} Hari Lagi`;
  }
  return `Pengingat: Batas Waktu ${taxType}`;
}

/**
 * Get notification message
 */
function getDeadlineMessage(deadline: UpcomingDeadline): string {
  const formattedDate = new Date(deadline.dueDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (deadline.daysUntilDue <= 0) {
    return `Batas waktu pelaporan ${deadline.taxTypeName} periode ${deadline.taxPeriod} adalah HARI INI (${formattedDate}). Segera lakukan pelaporan untuk menghindari denda.`;
  }

  if (deadline.daysUntilDue === 1) {
    return `Batas waktu pelaporan ${deadline.taxTypeName} periode ${deadline.taxPeriod} adalah BESOK (${formattedDate}). Pastikan dokumen Anda sudah siap.`;
  }

  return `Batas waktu pelaporan ${deadline.taxTypeName} periode ${deadline.taxPeriod} adalah ${formattedDate} (${deadline.daysUntilDue} hari lagi).`;
}

/**
 * API handler for running deadline reminders
 * Can be called by a cron job or manually
 */
export async function runDeadlineReminders(): Promise<{
  success: boolean;
  result: Awaited<ReturnType<typeof processDeadlineReminders>>;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await processDeadlineReminders(supabase);

  loggers.email.info({
    processed: result.processed,
    sent: result.notificationsSent,
    errors: result.errors.length,
  }, 'Deadline reminders completed');

  return {
    success: result.errors.length === 0,
    result,
  };
}
