/**
 * GET  /api/operator/customer-inbox/threads/:id/messages — operator view.
 *   Real sender identity shown.
 *   Side effect: marks customer messages as read, resets operator_unread_count.
 *
 * POST /api/operator/customer-inbox/threads/:id/messages — operator reply.
 *   body: { content: string }
 *   Side effect: customer_unread_count += 1, status='RESPONDED'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { MessageDTO } from '@/types/customer-ai';
import { mapMessageForOperator } from '@/lib/customer-ai/persona';

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
    .from('customer_ai_thread').select('id, customer_id').eq('id', threadId).maybeSingle();
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });

  const { data: msgs } = await admin.from('customer_ai_message').select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  const rawMsgs = (msgs ?? []) as RawMessage[];

  const now = new Date().toISOString();
  const unread = rawMsgs.filter((m) => m.sender_role === 'customer' && !m.operator_read_at);
  if (unread.length > 0) {
    await admin.from('customer_ai_message').update({ operator_read_at: now })
      .in('id', unread.map((m) => m.id));
  }
  await admin.from('customer_ai_thread')
    .update({ operator_unread_count: 0, updated_at: now }).eq('id', threadId);

  // Resolve operator emails
  const operatorIds = [...new Set(rawMsgs.filter((m) => m.sender_role === 'operator' && m.sender_user_id).map((m) => m.sender_user_id as string))];
  const emailById: Record<string, string | null> = {};
  await Promise.all(operatorIds.map(async (id) => {
    const { data: u } = await admin.auth.admin.getUserById(id);
    emailById[id] = u.user?.email ?? null;
  }));

  const customerName = await getCustomerName(admin, thread.customer_id);
  const dto: MessageDTO[] = rawMsgs.map((m) => mapMessageForOperator(m, emailById, customerName));
  return NextResponse.json({ data: dto });
}

const postSchema = z.object({ content: z.string().min(1).max(2000) });

async function handlePost(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: thread } = await admin.from('customer_ai_thread')
    .select('id, customer_id, customer_unread_count').eq('id', threadId).maybeSingle();
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: msg, error: iErr } = await admin.from('customer_ai_message').insert({
    thread_id: threadId,
    sender_role: 'operator',
    sender_user_id: req.session.userId,
    content: parsed.data.content,
  }).select('*').single();
  if (iErr || !msg) {
    loggers.api.error({ err: iErr?.message }, 'operator message insert failed');
    return NextResponse.json({ error: 'failed to insert message' }, { status: 500 });
  }

  await admin.from('customer_ai_thread').update({
    last_operator_message_at: now,
    customer_unread_count: (thread.customer_unread_count ?? 0) + 1,
    status: 'RESPONDED',
    updated_at: now,
  }).eq('id', threadId);

  await recordAudit({
    action: 'CUSTOMER_AI_REPLY',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { threadId, messageId: msg.id },
  });

  // Build emailById including self
  const { data: selfU } = await admin.auth.admin.getUserById(req.session.userId);
  const emailById: Record<string, string | null> = { [req.session.userId]: selfU.user?.email ?? null };
  const customerName = await getCustomerName(admin, thread.customer_id);
  return NextResponse.json({ data: mapMessageForOperator(msg as RawMessage, emailById, customerName) });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handlePost);
}
