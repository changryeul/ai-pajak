/**
 * Operator messenger helpers.
 *
 * Centralises:
 *   • zod schemas for request bodies
 *   • server-side sender masking (CUSTOMER channel ⇒ display_sender = AI_PAJAK)
 *   • assigned_operator_id resolution from caseId or current active assignment
 *
 * DB-level guards (CHECK constraint + RLS) are the final authority. This
 * module exists so we never round-trip an obviously-invalid row to Postgres
 * and so the masking decision is in one place.
 */

import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole } from '@/types/auth';

export const MESSAGE_CHANNELS = ['CUSTOMER', 'INTERNAL'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const operatorSendSchema = z.object({
  customerId: z.string().uuid(),
  channel: z.enum(MESSAGE_CHANNELS),
  body: z.string().min(1).max(4000),
  caseId: z.string().uuid().optional(),
  reasonCode: z.string().max(50).optional(),
  attachmentUrl: z.string().url().max(2000).optional(),
});

export const customerSendSchema = z.object({
  body: z.string().min(1).max(4000),
  caseId: z.string().uuid().optional(),
  attachmentUrl: z.string().url().max(2000).optional(),
});

export const listQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  channel: z.enum(MESSAGE_CHANNELS).optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const SUPERVISOR_ROLES: readonly UserRole[] = [
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];

const OPERATOR_ROLES: readonly UserRole[] = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
];

export function isOperatorRole(role: UserRole): boolean {
  return OPERATOR_ROLES.includes(role);
}

export function isSupervisorRole(role: UserRole): boolean {
  return SUPERVISOR_ROLES.includes(role);
}

/**
 * Pick the (sender_role, display_sender) pair the DB CHECK constraint will
 * accept for a given (channel, actor role). Returning a typed tuple keeps the
 * caller from having to remember the masking matrix.
 */
export function resolveSender(
  channel: MessageChannel,
  actorRole: UserRole,
): { senderRole: 'OPERATOR' | 'SUPERVISOR' | 'CUSTOMER'; displaySender: 'AI_PAJAK' | 'OPERATOR' | 'SUPERVISOR' | 'CUSTOMER' } {
  if (actorRole === UserRole.CUSTOMER) {
    // Customer can only ever be a CUSTOMER sender on the CUSTOMER channel.
    return { senderRole: 'CUSTOMER', displaySender: 'CUSTOMER' };
  }

  if (channel === 'CUSTOMER') {
    // Hard rule #2: operator/supervisor messages on the customer-visible
    // channel are masked to AI_PAJAK so the customer never sees that a
    // supervisor exists or which operator is on the case.
    return { senderRole: 'OPERATOR', displaySender: 'AI_PAJAK' };
  }

  // INTERNAL channel: real role is preserved.
  if (isSupervisorRole(actorRole)) {
    return { senderRole: 'SUPERVISOR', displaySender: 'SUPERVISOR' };
  }
  return { senderRole: 'OPERATOR', displaySender: 'OPERATOR' };
}

async function taxOperatorUserId(taxOperatorId: string | null | undefined): Promise<string | null> {
  if (!taxOperatorId) return null;
  const { data } = await getSupabaseAdmin()
    .from('tax_operators')
    .select('user_id')
    .eq('id', taxOperatorId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * Find the auth.users.id that should be cached on this message for RLS.
 *
 * Priority:
 *   1. djp_submission_queue(caseId).operator_id → tax_operators.user_id
 *   2. operator_client_assignments — latest active for this customer
 *   3. inherit from the latest non-null assigned_operator_id on the customer's
 *      messenger thread (lets supervisor replies stay bound to the operator
 *      who started the thread)
 *   4. NULL — supervisor still sees it; non-supervisor operator does not
 */
export async function resolveAssignedOperatorUserId(
  customerId: string,
  caseId?: string,
): Promise<string | null> {
  const admin = getSupabaseAdmin();

  if (caseId) {
    const { data: caseRow } = await admin
      .from('djp_submission_queue')
      .select('operator_id')
      .eq('id', caseId)
      .maybeSingle();
    const fromCase = await taxOperatorUserId(caseRow?.operator_id);
    if (fromCase) return fromCase;
  }

  const { data: assignment } = await admin
    .from('operator_client_assignments')
    .select('operator_id')
    .eq('customer_id', customerId)
    .is('unassigned_date', null)
    .order('assigned_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const fromAssignment = await taxOperatorUserId(assignment?.operator_id);
  if (fromAssignment) return fromAssignment;

  const { data: latestMsg } = await admin
    .from('operator_message')
    .select('assigned_operator_id')
    .eq('customer_id', customerId)
    .not('assigned_operator_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return latestMsg?.assigned_operator_id ?? null;
}
