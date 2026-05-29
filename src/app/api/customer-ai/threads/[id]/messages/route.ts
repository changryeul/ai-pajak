/**
 * GET  /api/customer-ai/threads/:id/messages — list messages.
 *   Customer can only see own thread (RLS).
 *   Operator messages persona-masked to 'AI 상담원' (server-enforced).
 *   Side effect: marks operator messages as read, resets customer_unread_count.
 *
 * POST /api/customer-ai/threads/:id/messages — customer posts a message.
 *   body: { content: string (1..2000) }
 *   Side effect: operator_unread_count += 1, status='AWAITING_OPERATOR'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { MessageDTO } from '@/types/customer-ai';
import { mapMessageForCustomer } from '@/lib/customer-ai/persona';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/messages/);
  return m?.[1] ?? null;
}

async function getCustomerName(admin: ReturnType<typeof getSupabaseAdmin>, customerId: string): Promise<string> {
  const { data } = await admin.from('customer').select('full_name, company_name').eq('id', customerId).maybeSingle();
  return data?.company_name || data?.full_name || '고객';
}

interface RawMessage {
  id: string;
  thread_id: string;
  sender_role: 'customer' | 'operator';
  sender_user_id: string | null;
  content: string;
  customer_read_at: string | null;
  operator_read_at: string | null;
  created_at: string;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  const { data: thread } = await admin
    .from('customer_ai_thread')
    .select('id, customer_id, customer_user_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread || thread.customer_user_id !== req.session.userId) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  }

  const { data: msgs } = await admin
    .from('customer_ai_message')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  // Mark operator messages as read by customer
  const now = new Date().toISOString();
  const unread = ((msgs ?? []) as RawMessage[]).filter((m) => m.sender_role === 'operator' && !m.customer_read_at);
  if (unread.length > 0) {
    await admin.from('customer_ai_message').update({ customer_read_at: now })
      .in('id', unread.map((m) => m.id));
  }
  await admin.from('customer_ai_thread')
    .update({ customer_unread_count: 0, updated_at: now }).eq('id', threadId);

  const customerName = await getCustomerName(admin, thread.customer_id);
  const dto: MessageDTO[] = ((msgs ?? []) as RawMessage[]).map((m) => mapMessageForCustomer(m, customerName));
  return NextResponse.json({ data: dto });
}

const postSchema = z.object({ content: z.string().min(1).max(2000) });

async function handlePost(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: thread } = await admin
    .from('customer_ai_thread')
    .select('id, customer_id, customer_user_id, operator_unread_count')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread || thread.customer_user_id !== req.session.userId) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: msg, error: iErr } = await admin
    .from('customer_ai_message')
    .insert({
      thread_id: threadId,
      sender_role: 'customer',
      sender_user_id: req.session.userId,
      content: parsed.data.content,
    })
    .select('*')
    .single();
  if (iErr || !msg) {
    loggers.api.error({ err: iErr?.message }, 'customer message insert failed');
    return NextResponse.json({ error: 'failed to insert message' }, { status: 500 });
  }

  await admin.from('customer_ai_thread').update({
    last_customer_message_at: now,
    operator_unread_count: (thread.operator_unread_count ?? 0) + 1,
    status: 'AWAITING_OPERATOR',
    updated_at: now,
  }).eq('id', threadId);

  const customerName = await getCustomerName(admin, thread.customer_id);
  return NextResponse.json({ data: mapMessageForCustomer(msg as RawMessage, customerName) });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handlePost);
}
