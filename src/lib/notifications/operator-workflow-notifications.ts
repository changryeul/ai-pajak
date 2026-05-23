/**
 * Operator Workflow Notifications
 *
 * Sends notifications when queue item status changes.
 * Uses existing NotificationService with admin client.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationService } from './notification-service';
import type { NotificationPriority } from './types';
import { loggers } from '@/lib/logger';

interface QueueItemContext {
  id: string;
  customer_id: string;
  operator_id: string | null;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  ebilling_code?: string | null;
  bpe_number?: string | null;
}

interface StatusChangeParams {
  queueItem: QueueItemContext;
  previousStatus: string;
  newStatus: string;
  action: string;
  actorUserId: string;
  autoApproved?: boolean;
}

/**
 * Send notifications for operator workflow status changes.
 * Non-blocking — errors are logged but don't throw.
 */
export async function notifyWorkflowStatusChange(
  admin: SupabaseClient,
  params: StatusChangeParams
): Promise<void> {
  const { queueItem, previousStatus, newStatus, action, actorUserId, autoApproved } = params;
  const svc = new NotificationService(admin);

  try {
    const period = `${queueItem.tax_period_year}/${String(queueItem.tax_period_month).padStart(2, '0')}`;
    const amountStr = `Rp ${queueItem.amount.toLocaleString('id-ID')}`;

    // Get customer info
    const { data: customer } = await admin
      .from('customer')
      .select('user_id, customer_name')
      .eq('id', queueItem.customer_id)
      .maybeSingle();

    // Get operator user_id from tax_operators
    let operatorUserId: string | null = null;
    if (queueItem.operator_id) {
      const { data: op } = await admin
        .from('tax_operators')
        .select('user_id')
        .eq('id', queueItem.operator_id)
        .single();
      operatorUserId = op?.user_id || null;
    }

    const customerName = customer?.customer_name || 'Customer';
    const baseData = {
      queueItemId: queueItem.id,
      taxType: queueItem.tax_type,
      taxPeriod: period,
      amount: amountStr,
      previousStatus,
      newStatus,
      customerName,
    };

    // Notification copy policy:
    //   - Customer-bound notifications go in Bahasa Indonesia (most customers
    //     are Indonesian; locale-per-customer is a future refactor).
    //   - Operator/supervisor notifications go in English so JTC + EXTERNAL
    //     operators can both read them.
    switch (newStatus) {
      case 'PENDING_APPROVAL': {
        // Notify all supervisors (English)
        const supervisorUserIds = await getSupervisorUserIds(admin);
        for (const supUserId of supervisorUserIds) {
          await svc.sendNotification({
            userId: supUserId,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `Approval requested: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName} ${queueItem.tax_type} ${period} is waiting for approval (${amountStr}).`,
            data: baseData,
          });
        }
        break;
      }

      case 'APPROVED': {
        if (autoApproved) {
          // Auto-approved: notify operator (English)
          if (operatorUserId) {
            await svc.sendNotification({
              userId: operatorUserId,
              type: 'FILING_STATUS',
              priority: 'LOW',
              title: `Auto-approved: ${customerName} ${queueItem.tax_type}`,
              message: `${customerName} ${queueItem.tax_type} ${period} was auto-approved.`,
              data: { ...baseData, autoApproved: true },
            });
          }
        } else {
          // Manual approval: notify operator (English)
          if (operatorUserId) {
            await svc.sendNotification({
              userId: operatorUserId,
              type: 'FILING_STATUS',
              priority: 'MEDIUM',
              title: `Approved: ${customerName} ${queueItem.tax_type}`,
              message: `${customerName} ${queueItem.tax_type} ${period} was approved. Please generate the e-Billing.`,
              data: baseData,
            });
          }
        }
        break;
      }

      case 'DATA_REVIEW': {
        // Rejection (from PENDING_APPROVAL): notify operator (English)
        if (previousStatus === 'PENDING_APPROVAL' && operatorUserId) {
          await svc.sendNotification({
            userId: operatorUserId,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `Rejected: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName} ${queueItem.tax_type} ${period} was rejected. Please review the data.`,
            data: baseData,
          });
        }
        break;
      }

      case 'PAYMENT_PENDING': {
        // Notify customer with billing info (Bahasa Indonesia)
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'PAYMENT_DUE',
            priority: 'HIGH',
            title: `Permintaan pembayaran: ${queueItem.tax_type} ${period}`,
            message: `e-Billing untuk pajak ${queueItem.tax_type} ${period} sebesar ${amountStr} telah diterbitkan. Mohon bayar dan unggah bukti pembayaran.`,
            data: { ...baseData, ebillingCode: queueItem.ebilling_code },
          });
        }
        break;
      }

      case 'PAYMENT_UPLOADED': {
        // Notify operator for verification (English)
        if (operatorUserId) {
          await svc.sendNotification({
            userId: operatorUserId,
            type: 'FILING_STATUS',
            priority: 'MEDIUM',
            title: `Payment proof submitted: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName} uploaded payment proof for ${queueItem.tax_type} ${period}. Please verify.`,
            data: baseData,
          });
        }
        break;
      }

      case 'PAYMENT_VERIFIED': {
        // Notify customer (Bahasa Indonesia)
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'PAYMENT_RECEIVED',
            priority: 'LOW',
            title: `Pembayaran terverifikasi: ${queueItem.tax_type} ${period}`,
            message: `Pembayaran ${queueItem.tax_type} ${period} telah diverifikasi. Pelaporan DJP sedang diproses.`,
            data: baseData,
          });
        }
        break;
      }

      case 'DJP_SUBMITTED': {
        // Notify customer (Bahasa Indonesia)
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'FILING_STATUS',
            priority: 'MEDIUM',
            title: `Terkirim ke DJP: ${queueItem.tax_type} ${period}`,
            message: `Pelaporan pajak ${queueItem.tax_type} ${period} telah dikirim ke DJP.`,
            data: baseData,
          });
        }
        break;
      }

      case 'COMPLETED': {
        // Notify customer with BPE info (Bahasa Indonesia)
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `Pelaporan selesai: ${queueItem.tax_type} ${period}`,
            message: `Pelaporan pajak ${queueItem.tax_type} ${period} telah selesai. Nomor BPE: ${queueItem.bpe_number || '-'}`,
            data: { ...baseData, bpeNumber: queueItem.bpe_number },
          });
        }
        break;
      }

      case 'FAILED': {
        // Notify operator + supervisors (English)
        const targets: string[] = [];
        if (operatorUserId) targets.push(operatorUserId);
        const supervisorUserIds = await getSupervisorUserIds(admin);
        targets.push(...supervisorUserIds);

        const uniqueTargets = [...new Set(targets)];
        for (const userId of uniqueTargets) {
          await svc.sendNotification({
            userId,
            type: 'FILING_STATUS',
            priority: 'HIGH' as NotificationPriority,
            title: `Failed: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName} ${queueItem.tax_type} ${period} failed. Investigation required.`,
            data: baseData,
          });
        }
        break;
      }
    }
  } catch (err) {
    loggers.email.error({ err }, 'Failed to send workflow notifications');
    // Non-blocking — don't throw
  }
}

/**
 * Get user IDs of all active supervisors/leads.
 */
async function getSupervisorUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from('user_roles')
    .select('user_id')
    .in('role', ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'])
    .eq('is_active', true);

  return (data || []).map(r => r.user_id);
}
