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

    switch (newStatus) {
      case 'PENDING_APPROVAL': {
        // Notify all supervisors
        const supervisorUserIds = await getSupervisorUserIds(admin);
        for (const supUserId of supervisorUserIds) {
          await svc.sendNotification({
            userId: supUserId,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `승인 요청: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName}의 ${queueItem.tax_type} ${period} 건이 승인 대기 중입니다. (${amountStr})`,
            data: baseData,
          });
        }
        break;
      }

      case 'APPROVED': {
        if (autoApproved) {
          // Auto-approved: notify operator + supervisors (low priority)
          if (operatorUserId) {
            await svc.sendNotification({
              userId: operatorUserId,
              type: 'FILING_STATUS',
              priority: 'LOW',
              title: `자동 승인: ${customerName} ${queueItem.tax_type}`,
              message: `${customerName}의 ${queueItem.tax_type} ${period} 건이 자동 승인되었습니다.`,
              data: { ...baseData, autoApproved: true },
            });
          }
        } else {
          // Manual approval: notify operator
          if (operatorUserId) {
            await svc.sendNotification({
              userId: operatorUserId,
              type: 'FILING_STATUS',
              priority: 'MEDIUM',
              title: `승인 완료: ${customerName} ${queueItem.tax_type}`,
              message: `${customerName}의 ${queueItem.tax_type} ${period} 건이 승인되었습니다. e-Billing을 생성해 주세요.`,
              data: baseData,
            });
          }
        }
        break;
      }

      case 'DATA_REVIEW': {
        // Rejection (from PENDING_APPROVAL): notify operator
        if (previousStatus === 'PENDING_APPROVAL' && operatorUserId) {
          await svc.sendNotification({
            userId: operatorUserId,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `반려: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName}의 ${queueItem.tax_type} ${period} 건이 반려되었습니다. 데이터를 확인해 주세요.`,
            data: baseData,
          });
        }
        break;
      }

      case 'PAYMENT_PENDING': {
        // Notify customer with billing info
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'PAYMENT_DUE',
            priority: 'HIGH',
            title: `납부 요청: ${queueItem.tax_type} ${period}`,
            message: `${queueItem.tax_type} ${period} 세금 ${amountStr}의 e-Billing이 발행되었습니다. 납부 후 증빙을 업로드해 주세요.`,
            data: { ...baseData, ebillingCode: queueItem.ebilling_code },
          });
        }
        break;
      }

      case 'PAYMENT_UPLOADED': {
        // Notify operator for verification
        if (operatorUserId) {
          await svc.sendNotification({
            userId: operatorUserId,
            type: 'FILING_STATUS',
            priority: 'MEDIUM',
            title: `납부증빙 제출: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName}이(가) ${queueItem.tax_type} ${period} 납부증빙을 업로드했습니다. 확인해 주세요.`,
            data: baseData,
          });
        }
        break;
      }

      case 'PAYMENT_VERIFIED': {
        // Notify customer
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'PAYMENT_RECEIVED',
            priority: 'LOW',
            title: `납부 확인: ${queueItem.tax_type} ${period}`,
            message: `${queueItem.tax_type} ${period} 납부가 확인되었습니다. DJP 신고가 진행됩니다.`,
            data: baseData,
          });
        }
        break;
      }

      case 'DJP_SUBMITTED': {
        // Notify customer + operator
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'FILING_STATUS',
            priority: 'MEDIUM',
            title: `DJP 제출 완료: ${queueItem.tax_type} ${period}`,
            message: `${queueItem.tax_type} ${period} 세금 신고가 DJP에 제출되었습니다.`,
            data: baseData,
          });
        }
        break;
      }

      case 'COMPLETED': {
        // Notify customer with BPE info
        if (customer?.user_id) {
          await svc.sendNotification({
            userId: customer.user_id,
            type: 'FILING_STATUS',
            priority: 'HIGH',
            title: `신고 완료: ${queueItem.tax_type} ${period}`,
            message: `${queueItem.tax_type} ${period} 세금 신고가 완료되었습니다. BPE 번호: ${queueItem.bpe_number || '-'}`,
            data: { ...baseData, bpeNumber: queueItem.bpe_number },
          });
        }
        break;
      }

      case 'FAILED': {
        // Notify operator + supervisors
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
            title: `실패: ${customerName} ${queueItem.tax_type}`,
            message: `${customerName}의 ${queueItem.tax_type} ${period} 건이 실패 처리되었습니다. 확인이 필요합니다.`,
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
