/**
 * POST /api/operator/customer-inbox/threads/:id/ai-draft
 *
 * Operator-tier only. Generates a Claude-suggested reply draft based on the
 * thread context. On-demand, ephemeral (no DB persistence). Operator pre-fills
 * input textarea with the draft, edits as needed, then sends via the regular
 * POST messages endpoint.
 *
 * Customer NEVER sees draft — endpoint is operator-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/ai-draft/);
  return m?.[1] ?? null;
}

interface ThreadRow {
  id: string;
  customer_id: string;
  context_kind: string;
  context_period: string;
  customer?: { full_name: string | null; company_name: string | null } | null;
}

interface MessageRow {
  sender_role: 'customer' | 'operator';
  content: string;
  created_at: string;
}

function buildSystemPrompt(thread: ThreadRow, messages: MessageRow[]): string {
  const customerName = thread.customer?.company_name || thread.customer?.full_name || 'customer';
  const conversationLines = messages
    .map((m) => {
      const tag = m.sender_role === 'customer' ? '[customer]' : '[operator]';
      return `${tag} ${m.content}`;
    })
    .join('\n');

  return `You are drafting a reply for an Indonesian tax consultant who is responding to a customer inquiry. The customer sees the consultant as "AI 상담원" (the platform's AI consultant persona) — they do not know a human is replying.

Customer context:
- Name: ${customerName}
- Tax case: ${thread.context_kind} period ${thread.context_period}

Recent conversation (oldest first):
${conversationLines || '(no messages yet)'}

Draft a helpful reply in the customer's language (default Indonesian if unclear from the conversation). Rules:
- Concise (1-3 short paragraphs)
- Professional + actionable
- If action needed, give specific menu paths (e.g., "/tax/pph21 페이지에서 직원 데이터를 업로드해주세요")
- If you need more info, ask specific questions
- Reply ONLY with the draft text — no preamble, no signature, no markdown formatting beyond line breaks.`;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }

  // Rate limit (per-operator). Reuses the predefined 'chatbot' bucket (20/hour).
  const rateCheck = await checkRateLimit(req.session.userId, 'chatbot');
  if (!rateCheck.allowed) {
    return NextResponse.json(rateLimitResponse(rateCheck, 'AI draft'), { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    loggers.api.error({}, 'ANTHROPIC_API_KEY missing');
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const admin = getSupabaseAdmin();

  // Fetch thread + customer join
  const { data: threadData, error: tErr } = await admin
    .from('customer_ai_thread')
    .select(`
      id, customer_id, context_kind, context_period,
      customer:customer_id (full_name, company_name)
    `)
    .eq('id', threadId)
    .maybeSingle();
  if (tErr || !threadData) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  }
  const thread = threadData as unknown as ThreadRow;

  // Last 10 messages (chronological)
  const { data: msgsData } = await admin
    .from('customer_ai_message')
    .select('sender_role, content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(10);
  const messages = ((msgsData ?? []) as MessageRow[]).reverse();

  const systemPrompt = buildSystemPrompt(thread, messages);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Draft a reply to the customer.' }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const draft = textBlock && 'text' in textBlock ? textBlock.text.trim() : '';

    if (!draft) {
      loggers.api.warn({ threadId }, 'AI draft empty response');
      return NextResponse.json({ error: 'AI returned empty draft' }, { status: 502 });
    }

    await recordAudit({
      action: 'CUSTOMER_AI_DRAFT_REQUEST',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { threadId, draftLength: draft.length },
    });

    return NextResponse.json({ data: { draft, model: MODEL } });
  } catch (e) {
    loggers.api.error(
      { err: e instanceof Error ? e.message : 'unknown', threadId },
      'AI draft generation failed',
    );
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
  )(request as RequestWithSession, handle);
}
