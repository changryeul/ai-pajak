/**
 * Notification System Types
 */

export type NotificationType =
  | 'DEADLINE_REMINDER'      // Tax deadline approaching
  | 'FILING_STATUS'          // Filing status changed
  | 'POA_STATUS'             // POA status changed
  | 'DOCUMENT_PROCESSED'     // OCR completed
  | 'PAYMENT_DUE'            // Payment reminder
  | 'PAYMENT_RECEIVED'       // Payment confirmed
  | 'SYSTEM_ANNOUNCEMENT';   // Platform announcements

export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'PUSH';

export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  read: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  deadlineReminders: boolean;
  filingUpdates: boolean;
  paymentReminders: boolean;
  marketingEmails: boolean;
  reminderDaysBefore: number[]; // e.g., [30, 14, 7, 1]
}

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: string[];
}

export interface DeadlineReminderData {
  customerName: string;
  taxType: string;
  taxPeriod: string;
  dueDate: string;
  daysUntilDue: number;
  filingUrl: string;
}

export interface FilingStatusData {
  customerName: string;
  filingNumber: string;
  taxType: string;
  taxPeriod: string;
  previousStatus: string;
  newStatus: string;
  filingUrl: string;
}

export interface POAStatusData {
  customerName: string;
  poaNumber: string;
  taxPartnerName: string;
  previousStatus: string;
  newStatus: string;
  poaUrl: string;
}

export interface PaymentData {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentUrl: string;
}
