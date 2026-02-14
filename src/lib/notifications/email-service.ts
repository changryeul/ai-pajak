/**
 * Email Notification Service
 *
 * Uses Resend for transactional emails
 *
 * Resilience Features:
 * - Circuit Breaker: Prevents cascading failures when email service is down
 * - Retry: Automatic retry with exponential backoff
 * - Structured Logging: JSON logs with request context
 */

import { Resend } from 'resend';
import {
  EmailNotification,
  DeadlineReminderData,
  FilingStatusData,
  POAStatusData,
  PaymentData,
  PaymentConfirmationData,
  PaymentFailedData,
} from './types';
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';
import { withRetry, withTimeout } from '@/lib/resilience/timeout';
import { loggers } from '@/lib/logger';

// Lazy-load Resend client to avoid build-time errors
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'AI Pajak <noreply@aipajak.com>';
const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT || 'support@aipajak.com';

/**
 * Send email notification with resilience patterns
 */
export async function sendEmail(notification: EmailNotification): Promise<boolean> {
  const emailId = `${notification.to}-${Date.now()}`;

  loggers.email.info({
    emailId,
    to: notification.to,
    subject: notification.subject,
    tags: notification.tags,
  }, 'Sending email');

  try {
    // Use circuit breaker and retry for email sending
    const result = await circuitBreakers.email.execute(() =>
      withRetry(
        async () => {
          const client = getResendClient();
          return withTimeout(
            client.emails.send({
              from: FROM_EMAIL,
              to: notification.to,
              subject: notification.subject,
              html: notification.html,
              text: notification.text,
              replyTo: notification.replyTo || SUPPORT_EMAIL,
              tags: notification.tags?.map((tag) => ({ name: tag, value: 'true' })),
            }),
            10000, // 10s timeout
            'Email send timed out'
          );
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Retry on network errors but not on validation errors
            if (error instanceof Error) {
              return !error.message.includes('validation') &&
                     !error.message.includes('invalid');
            }
            return true;
          },
        }
      )
    );

    if (result.error) {
      loggers.email.error({
        emailId,
        to: notification.to,
        error: result.error,
      }, 'Failed to send email');
      return false;
    }

    loggers.email.info({
      emailId,
      to: notification.to,
      messageId: result.data?.id,
    }, 'Email sent successfully');

    return true;
  } catch (error) {
    loggers.email.error({
      emailId,
      to: notification.to,
      error,
    }, 'Error sending email');
    return false;
  }
}

/**
 * Send deadline reminder email
 */
export async function sendDeadlineReminder(
  email: string,
  data: DeadlineReminderData
): Promise<boolean> {
  const urgencyColor = data.daysUntilDue <= 3 ? '#dc2626' : data.daysUntilDue <= 7 ? '#f97316' : '#3b82f6';
  const urgencyText = data.daysUntilDue <= 1 ? 'URGENT' : data.daysUntilDue <= 7 ? 'IMPORTANT' : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Tax Deadline Reminder</p>
      </div>

      ${urgencyText ? `
      <div style="background-color: ${urgencyColor}; color: white; padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
        <strong>${urgencyText}: ${data.daysUntilDue} day${data.daysUntilDue !== 1 ? 's' : ''} remaining</strong>
      </div>
      ` : ''}

      <!-- Content -->
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        This is a reminder that your <strong>${data.taxType}</strong> tax filing for period <strong>${data.taxPeriod}</strong> is due on <strong>${data.dueDate}</strong>.
      </p>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Tax Type:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.taxType}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Period:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.taxPeriod}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Due Date:</td>
            <td style="color: ${urgencyColor}; font-weight: 600; text-align: right;">${data.dueDate}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Days Remaining:</td>
            <td style="color: ${urgencyColor}; font-weight: 600; text-align: right;">${data.daysUntilDue} day${data.daysUntilDue !== 1 ? 's' : ''}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.filingUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Complete Filing Now
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Late submissions may incur penalties. If you have any questions, please contact our support team.
      </p>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by AI Pajak. If you no longer wish to receive these reminders,
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #6b7280;">update your preferences</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `${urgencyText ? `[${urgencyText}] ` : ''}Tax Deadline Reminder: ${data.taxType} - ${data.taxPeriod}`,
    html,
    tags: ['deadline-reminder', data.taxType.toLowerCase()],
  });
}

/**
 * Send filing status update email
 */
export async function sendFilingStatusUpdate(
  email: string,
  data: FilingStatusData
): Promise<boolean> {
  const statusColors: Record<string, string> = {
    SUBMITTED: '#3b82f6',
    ACCEPTED: '#22c55e',
    REJECTED: '#dc2626',
    PAID: '#22c55e',
  };

  const statusColor = statusColors[data.newStatus] || '#6b7280';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Filing Status Update</p>
      </div>

      <!-- Status Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600;">
          ${data.newStatus}
        </span>
      </div>

      <!-- Content -->
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your tax filing status has been updated.
      </p>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Filing Number:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.filingNumber}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Tax Type:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.taxType}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Period:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.taxPeriod}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Previous Status:</td>
            <td style="color: #6b7280; text-align: right;">${data.previousStatus}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">New Status:</td>
            <td style="color: ${statusColor}; font-weight: 600; text-align: right;">${data.newStatus}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.filingUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Filing Details
        </a>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by AI Pajak.
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #6b7280;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `Filing ${data.newStatus}: ${data.taxType} - ${data.taxPeriod}`,
    html,
    tags: ['filing-status', data.newStatus.toLowerCase()],
  });
}

/**
 * Send POA status update email
 */
export async function sendPOAStatusUpdate(
  email: string,
  data: POAStatusData
): Promise<boolean> {
  const statusMessages: Record<string, string> = {
    PENDING_SIGNATURE: 'is awaiting signature',
    ACTIVE: 'is now active',
    EXPIRED: 'has expired',
    REVOKED: 'has been revoked',
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Power of Attorney Update</p>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Your Power of Attorney (${data.poaNumber}) with <strong>${data.taxPartnerName}</strong> ${statusMessages[data.newStatus] || 'has been updated'}.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.poaUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View POA Details
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by AI Pajak.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `POA ${data.newStatus}: ${data.poaNumber}`,
    html,
    tags: ['poa-status', data.newStatus.toLowerCase()],
  });
}

/**
 * Send payment reminder email
 */
export async function sendPaymentReminder(
  email: string,
  data: PaymentData
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: data.currency,
    minimumFractionDigits: 0,
  }).format(data.amount);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Payment Reminder</p>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        This is a reminder that payment for invoice <strong>${data.invoiceNumber}</strong> is due on <strong>${data.dueDate}</strong>.
      </p>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="color: #6b7280; margin: 0 0 8px;">Amount Due</p>
        <p style="color: #1f2937; font-size: 32px; font-weight: 700; margin: 0;">${formattedAmount}</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.paymentUrl}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Pay Now
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by AI Pajak.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `Payment Reminder: ${data.invoiceNumber} - ${formattedAmount}`,
    html,
    tags: ['payment-reminder'],
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmation(
  email: string,
  data: PaymentConfirmationData
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: data.currency,
    minimumFractionDigits: 0,
  }).format(data.amount);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Payment Confirmation</p>
      </div>

      <!-- Success Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; padding: 16px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <h2 style="color: #22c55e; text-align: center; margin: 0 0 24px;">Payment Successful!</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for your payment. Your transaction has been processed successfully.
      </p>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Invoice Number:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Amount Paid:</td>
            <td style="color: #22c55e; font-weight: 600; text-align: right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Payment Method:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.paymentMethod}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Transaction ID:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.transactionId}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Date:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.paidAt}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Service:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.serviceType}</td>
          </tr>
        </table>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        A copy of this receipt has been saved to your account. You can access your billing history at any time from your dashboard.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/billing" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Billing History
        </a>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by AI Pajak. Terima kasih telah menggunakan layanan kami!
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `✓ Payment Confirmed: ${data.invoiceNumber} - ${formattedAmount}`,
    html,
    tags: ['payment-confirmation', 'payment-success'],
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailed(
  email: string,
  data: PaymentFailedData
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: data.currency,
    minimumFractionDigits: 0,
  }).format(data.amount);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1f2937; font-size: 24px;">AI Pajak</h1>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Payment Status</p>
      </div>

      <!-- Failed Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: #fee2e2; border-radius: 50%; padding: 16px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
      </div>

      <h2 style="color: #dc2626; text-align: center; margin: 0 0 24px;">Payment Failed</h2>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hello ${data.customerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        We were unable to process your payment for invoice <strong>${data.invoiceNumber}</strong>.
      </p>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Invoice Number:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${data.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Amount:</td>
            <td style="color: #1f2937; font-weight: 600; text-align: right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 8px 0;">Reason:</td>
            <td style="color: #dc2626; font-weight: 600; text-align: right;">${data.reason}</td>
          </tr>
        </table>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Please try again or use a different payment method. If the problem persists, contact our support team.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.paymentUrl}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Try Again
        </a>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #6b7280;">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `⚠ Payment Failed: ${data.invoiceNumber}`,
    html,
    tags: ['payment-failed'],
  });
}
