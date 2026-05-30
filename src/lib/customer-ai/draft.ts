/**
 * Phase 2.1: shared Claude-call helper used by both the on-demand operator
 * endpoint (Phase 2 — POST /ai-draft) and the auto-trigger from customer
 * message arrival (POST customer/messages → background `after()`).
 *
 * Never throws — returns null on missing API key / thread-not-found / Claude
 * failure. Caller decides how to surface the failure (HTTP 500 vs silent skip).
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

export interface GenerateDraftResult {
  draft: string;
  model: string;
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
  const customerName =
    thread.customer?.company_name || thread.customer?.full_name || 'customer';
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

export async function generateDraft(
  threadId: string,
): Promise<GenerateDraftResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    loggers.api.warn({ threadId }, 'generateDraft: ANTHROPIC_API_KEY missing');
    return null;
  }

  const admin = getSupabaseAdmin();

  const { data: threadData, error: tErr } = await admin
    .from('customer_ai_thread')
    .select(
      `id, customer_id, context_kind, context_period,
       customer:customer_id (full_name, company_name)`,
    )
    .eq('id', threadId)
    .maybeSingle();
  if (tErr || !threadData) {
    loggers.api.warn(
      { threadId, err: tErr?.message },
      'generateDraft: thread not found',
    );
    return null;
  }
  const thread = threadData as unknown as ThreadRow;

  const { data: msgsData } = await admin
    .from('customer_ai_message')
    .select('sender_role, content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(10);
  const messages = ((msgsData ?? []) as MessageRow[]).reverse();

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(thread, messages),
      messages: [{ role: 'user', content: 'Draft a reply to the customer.' }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const draft =
      textBlock && 'text' in textBlock ? textBlock.text.trim() : '';

    if (!draft) {
      loggers.api.warn({ threadId }, 'generateDraft: empty response');
      return null;
    }

    return { draft, model: MODEL };
  } catch (e) {
    loggers.api.error(
      { err: e instanceof Error ? e.message : 'unknown', threadId },
      'generateDraft: Claude failed',
    );
    return null;
  }
}
