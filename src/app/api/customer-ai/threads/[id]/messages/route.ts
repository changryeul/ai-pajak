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

import { NextRequest, NextResponse, after } from 'next/server';
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
import { generateDraft } from '@/lib/customer-ai/draft';
import { recordAudit } from '@/middleware/audit';

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
    // Fetch current count + compute. Race-safe: decrement by exactly the rows
    // we just marked read. New unread arrivals between SELECT and UPDATE
    // remain counted.
    const { data: current } = await admin
      .from('customer_ai_thread')
      .select('customer_unread_count')
      .eq('id', threadId)
      .maybeSingle();
    const newCount = Math.max(0, (current?.customer_unread_count ?? 0) - unread.length);
    await admin.from('customer_ai_thread')
      .update({ customer_unread_count: newCount, updated_at: now })
      .eq('id', threadId);
  }

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

  // Phase 2.1: auto-draft trigger. Only fire if no pending draft exists
  // (state = NULL means it's the first customer message since the operator's
  // last reply / since dismiss). Background work via next/server `after()` —
  // customer response latency stays unchanged.
  const { data: draftState } = await admin
    .from('customer_ai_thread')
    .select('auto_draft')
    .eq('id', threadId)
    .maybeSingle();
  if (draftState && draftState.auto_draft === null) {
    after(async () => {
      try {
        const result = await generateDraft(threadId);
        if (!result) return;
        // Race-safe update: only set if still NULL (another in-flight trigger
        // might have already populated it).
        const { error: upErr } = await admin
          .from('customer_ai_thread')
          .update({
            auto_draft: result.draft,
            auto_draft_at: new Date().toISOString(),
          })
          .eq('id', threadId)
          .is('auto_draft', null);
        if (upErr) {
          loggers.api.warn(
            { err: upErr.message, threadId },
            'auto-draft update failed',
          );
          return;
        }
        // Phase 2.2: also persist to customer_ai_draft history. Backward compat
        // with Phase 2.1's auto_draft column is preserved above. INSERT failure
        // is non-fatal — the pill still shows from the UPDATE.
        try {
          const { error: insertErr } = await admin
            .from('customer_ai_draft')
            .insert({
              thread_id: threadId,
              draft_text: result.draft,
              source: 'auto',
              status: 'active',
            });
          if (insertErr) {
            loggers.api.warn(
              { err: insertErr.message, threadId },
              'auto-draft history insert failed (non-fatal)',
            );
          }
        } catch (e) {
          loggers.api.warn(
            { err: e instanceof Error ? e.message : 'unknown', threadId },
            'auto-draft history insert threw (non-fatal)',
          );
        }
        await recordAudit({
          action: 'CUSTOMER_AI_DRAFT_REQUEST',
          actorUserId: req.session.userId,
          actorRole: req.session.role,
          details: {
            threadId,
            trigger: 'auto',
            draftLength: result.draft.length,
          },
        });
      } catch (e) {
        loggers.api.error(
          { err: e instanceof Error ? e.message : 'unknown', threadId },
          'auto-draft background trigger failed',
        );
      }
    });
  }

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
