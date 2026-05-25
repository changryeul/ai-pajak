/**
 * Customer-facing messenger — list + send.
 *
 *   GET  /api/customer/messages?since=...&limit=...
 *   POST /api/customer/messages   { body, caseId?, attachmentUrl? }
 *
 * Customer is hard-pinned to the CUSTOMER channel. INTERNAL channel is
 * invisible (RLS + this layer both block it). The operator-side AI_PAJAK
 * masking is already baked into stored rows, so the customer's GET response
 * naturally shows the masked display_sender.
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
  customerSendSchema,
  listQuerySchema,
  resolveAssignedOperatorId,
} from '@/lib/messenger/operator-message';

async function getCustomerIdForSession(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleList(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const customerId = await getCustomerIdForSession(req.session.userId);
  if (!customerId) {
    return NextResponse.json({ success: true, data: { messages: [] } });
  }

  let query = getSupabaseAdmin()
    .from('operator_message')
    .select('*')
    .eq('customer_id', customerId)
    .eq('channel', 'CUSTOMER')      // hard pin — customer never sees INTERNAL
    .order('created_at', { ascending: true })
    .limit(parsed.data.limit);

  if (parsed.data.since) query = query.gt('created_at', parsed.data.since);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { messages: data ?? [] } });
}

async function handleSend(req: RequestWithSession): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = customerSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const customerId = await getCustomerIdForSession(req.session.userId);
  if (!customerId) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  const { body: text, caseId, attachmentUrl } = parsed.data;
  const assignedOperatorId = await resolveAssignedOperatorId(customerId, caseId);

  const { data, error } = await getSupabaseAdmin()
    .from('operator_message')
    .insert({
      customer_id: customerId,
      case_id: caseId ?? null,
      channel: 'CUSTOMER',
      sender_user_id: req.session.userId,
      sender_role: 'CUSTOMER',
      display_sender: 'CUSTOMER',
      assigned_operator_id: assignedOperatorId,
      body: text,
      attachment_url: attachmentUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    const isClientError = error.code === '23514' || error.code === '23503' || error.code === '23502';
    return NextResponse.json(
      { error: 'Failed to send message', detail: error.message },
      { status: isClientError ? 400 : 500 },
    );
  }
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleList);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
    withAudit('CUSTOMER_MESSAGE_SEND'),
  )(request as RequestWithSession, handleSend);
}
