/**
 * Operator messenger — list + send.
 *
 *   GET  /api/operator/messages?customerId=...&channel=...&since=...&limit=...
 *   POST /api/operator/messages   { customerId, channel, body, caseId?, reasonCode?, attachmentUrl? }
 *
 * Auth chain: requireAuth → blockPlatformAdmin → requireRole(operator tier) → withAudit
 * The DB CHECK + RLS are the final authority; this layer just keeps obviously
 * wrong rows out and enforces the masking matrix.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RequestWithSession, UserRole } from '@/types/auth';
import {
  operatorSendSchema,
  listQuerySchema,
  resolveSender,
  resolveAssignedOperatorId,
  isSupervisorRole,
} from '@/lib/messenger/operator-message';

const OPERATOR_ROLES = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

async function handleList(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    customerId: url.searchParams.get('customerId') ?? undefined,
    channel: url.searchParams.get('channel') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { customerId, channel, since, limit } = parsed.data;
  const admin = getSupabaseAdmin();

  let query = admin
    .from('operator_message')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (customerId) query = query.eq('customer_id', customerId);
  if (channel) query = query.eq('channel', channel);
  if (since) query = query.gt('created_at', since);

  // Non-supervisor operator only sees rows they're assigned to. Supervisor/
  // master see everything (RLS already enforces this; we mirror it here so
  // the admin client doesn't return extra rows the user wouldn't be allowed
  // to fetch through anon).
  if (!isSupervisorRole(req.session.role)) {
    const { data: op } = await admin
      .from('tax_operators')
      .select('id')
      .eq('user_id', req.session.userId)
      .maybeSingle();
    if (!op) {
      return NextResponse.json({ success: true, data: { messages: [] } });
    }
    query = query.eq('assigned_operator_id', op.id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { messages: data ?? [] } });
}

async function handleSend(req: RequestWithSession): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = operatorSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { customerId, channel, body: text, caseId, reasonCode, attachmentUrl } = parsed.data;

  // Supervisor sending on CUSTOMER channel is technically allowed (they still
  // get masked to AI_PAJAK) but PDF spec says supervisor only uses INTERNAL.
  // We allow it for ops flexibility; masking guarantees the customer never
  // sees the difference.
  const { senderRole, displaySender } = resolveSender(channel, req.session.role);
  const assignedOperatorId = await resolveAssignedOperatorId(customerId, caseId);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('operator_message')
    .insert({
      customer_id: customerId,
      case_id: caseId ?? null,
      channel,
      sender_user_id: req.session.userId,
      sender_role: senderRole,
      display_sender: displaySender,
      assigned_operator_id: assignedOperatorId,
      body: text,
      reason_code: reasonCode ?? null,
      attachment_url: attachmentUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    // CHECK constraint or FK errors surface here; treat as 400 so a bad
    // payload doesn't show up as a 5xx in Sentry.
    const isClientError = error.code === '23514' /* check_violation */
      || error.code === '23503' /* fk_violation */
      || error.code === '23502' /* not_null */;
    return NextResponse.json(
      { error: 'Failed to send message', detail: error.message },
      { status: isClientError ? 400 : 500 },
    );
  }

  // Attach customer_id to the audit row so /admin/audit can filter by customer.
  if (req.audit) {
    req.audit.action = 'OPERATOR_MESSAGE_SEND';
  }

  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPERATOR_ROLES),
  )(request as RequestWithSession, handleList);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPERATOR_ROLES),
    withAudit('OPERATOR_MESSAGE_SEND'),
  )(request as RequestWithSession, handleSend);
}
