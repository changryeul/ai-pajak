/**
 * In-App Notification Service
 *
 * Manages in-app notifications stored in database
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { loggers } from '@/lib/logger';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationPreferences,
  DeadlineReminderData,
  FilingStatusData,
  POAStatusData,
  PaymentData,
} from './types';
import {
  sendDeadlineReminder,
  sendFilingStatusUpdate,
  sendPOAStatusUpdate,
  sendPaymentReminder,
} from './email-service';

/**
 * Create a new notification
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  expiresAt?: string;
}): Promise<Notification | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('notification')
    .insert({
      user_id: params.userId,
      type: params.type,
      priority: params.priority,
      title: params.title,
      message: params.message,
      data: params.data,
      channels: params.channels || ['IN_APP'],
      read: false,
      expires_at: params.expiresAt,
    })
    .select()
    .single();

  if (error) {
    loggers.email.error({ err: error }, 'Failed to create notification');
    return null;
  }

  return mapNotification(data);
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<Notification[]> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  let query = supabase
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('read', false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    loggers.email.error({ err: error }, 'Failed to fetch notifications');
    return [];
  }

  return data.map(mapNotification);
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { count, error } = await supabase
    .from('notification')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    loggers.email.error({ err: error }, 'Failed to count notifications');
    return 0;
  }

  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { error } = await supabase
    .from('notification')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  return !error;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { error } = await supabase
    .from('notification')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('read', false);

  return !error;
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { error } = await supabase
    .from('notification')
    .delete()
    .eq('id', notificationId);

  return !error;
}

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // Return default preferences if none exist
    return {
      userId,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      deadlineReminders: true,
      filingUpdates: true,
      paymentReminders: true,
      marketingEmails: false,
      reminderDaysBefore: [30, 14, 7, 1],
    };
  }

  return {
    userId: data.user_id,
    emailEnabled: data.email_enabled,
    inAppEnabled: data.in_app_enabled,
    pushEnabled: data.push_enabled,
    deadlineReminders: data.deadline_reminders,
    filingUpdates: data.filing_updates,
    paymentReminders: data.payment_reminders,
    marketingEmails: data.marketing_emails,
    reminderDaysBefore: data.reminder_days_before,
  };
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      email_enabled: preferences.emailEnabled,
      in_app_enabled: preferences.inAppEnabled,
      push_enabled: preferences.pushEnabled,
      deadline_reminders: preferences.deadlineReminders,
      filing_updates: preferences.filingUpdates,
      payment_reminders: preferences.paymentReminders,
      marketing_emails: preferences.marketingEmails,
      reminder_days_before: preferences.reminderDaysBefore,
      updated_at: new Date().toISOString(),
    });

  return !error;
}

/**
 * Send notification through all channels
 */
export async function sendNotification(params: {
  userId: string;
  email: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: Record<string, unknown>;
}): Promise<void> {
  // Get user preferences
  const preferences = await getNotificationPreferences(params.userId);

  // Create in-app notification
  if (preferences?.inAppEnabled) {
    await createNotification({
      userId: params.userId,
      type: params.type,
      priority: params.priority,
      title: params.title,
      message: params.message,
      data: params.data,
      channels: ['IN_APP'],
    });
  }

  // Send email notification based on type
  if (preferences?.emailEnabled) {
    switch (params.type) {
      case 'DEADLINE_REMINDER':
        if (preferences.deadlineReminders) {
          await sendDeadlineReminder(params.email, params.data as unknown as DeadlineReminderData);
        }
        break;
      case 'FILING_STATUS':
        if (preferences.filingUpdates) {
          await sendFilingStatusUpdate(params.email, params.data as unknown as FilingStatusData);
        }
        break;
      case 'POA_STATUS':
        await sendPOAStatusUpdate(params.email, params.data as unknown as POAStatusData);
        break;
      case 'PAYMENT_DUE':
        if (preferences.paymentReminders) {
          await sendPaymentReminder(params.email, params.data as unknown as PaymentData);
        }
        break;
    }
  }
}

/**
 * Map database notification to type
 */
function mapNotification(data: {
  id: string;
  user_id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: string[];
  read: boolean;
  read_at?: string;
  created_at: string;
  expires_at?: string;
}): Notification {
  return {
    id: data.id,
    userId: data.user_id,
    type: data.type as NotificationType,
    priority: data.priority as NotificationPriority,
    title: data.title,
    message: data.message,
    data: data.data,
    channels: data.channels as NotificationChannel[],
    read: data.read,
    readAt: data.read_at,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

/**
 * NotificationService class for use with injected Supabase client
 * Useful for cron jobs and background services
 */
export class NotificationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Create a notification using injected Supabase client
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    channels?: NotificationChannel[];
    expiresAt?: string;
  }): Promise<Notification | null> {
    const { data, error } = await this.supabase
      .from('notification')
      .insert({
        user_id: params.userId,
        type: params.type,
        priority: params.priority,
        title: params.title,
        message: params.message,
        data: params.data,
        channels: params.channels || ['IN_APP'],
        read: false,
        expires_at: params.expiresAt,
      })
      .select()
      .single();

    if (error) {
      loggers.email.error({ err: error }, 'NotificationService failed to create notification');
      return null;
    }

    return mapNotification(data);
  }

  /**
   * Get user preferences using injected Supabase client
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return {
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        pushEnabled: false,
        deadlineReminders: true,
        filingUpdates: true,
        paymentReminders: true,
        marketingEmails: false,
        reminderDaysBefore: [30, 14, 7, 1],
      };
    }

    return {
      userId: data.user_id,
      emailEnabled: data.email_enabled,
      inAppEnabled: data.in_app_enabled,
      pushEnabled: data.push_enabled,
      deadlineReminders: data.deadline_reminders,
      filingUpdates: data.filing_updates,
      paymentReminders: data.payment_reminders,
      marketingEmails: data.marketing_emails,
      reminderDaysBefore: data.reminder_days_before,
    };
  }

  /**
   * Send notification through all channels
   */
  async sendNotification(params: {
    userId: string;
    email?: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const preferences = await this.getPreferences(params.userId);

    // Create in-app notification
    if (preferences?.inAppEnabled) {
      await this.createNotification({
        userId: params.userId,
        type: params.type,
        priority: params.priority,
        title: params.title,
        message: params.message,
        data: params.data,
        channels: ['IN_APP'],
      });
    }

    // Send email if enabled and email provided
    if (preferences?.emailEnabled && params.email) {
      switch (params.type) {
        case 'DEADLINE_REMINDER':
          if (preferences.deadlineReminders) {
            await sendDeadlineReminder(params.email, params.data as unknown as DeadlineReminderData);
          }
          break;
        case 'FILING_STATUS':
          if (preferences.filingUpdates) {
            await sendFilingStatusUpdate(params.email, params.data as unknown as FilingStatusData);
          }
          break;
        case 'POA_STATUS':
          await sendPOAStatusUpdate(params.email, params.data as unknown as POAStatusData);
          break;
        case 'PAYMENT_DUE':
          if (preferences.paymentReminders) {
            await sendPaymentReminder(params.email, params.data as unknown as PaymentData);
          }
          break;
      }
    }
  }
}
