/**
 * POST /api/operator/customer-inbox/threads/:id/ai-draft
 *
 * Operator-tier only. Generates a Claude-suggested reply draft based on the
 * thread context. On-demand, ephemeral (no DB persistence — the auto-trigger
 * in Phase 2.1 writes to `auto_draft` column; this endpoint does not, so
 * operator can re-roll without overwriting the pill state).
 *
 * Customer NEVER sees draft — endpoint is operator-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { generateDraft } from '@/lib/customer-ai/draft';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/ai-draft/);
  return m?.[1] ?? null;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    loggers.api.error({}, 'ANTHROPIC_API_KEY missing');
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const result = await generateDraft(threadId);
  if (!result) {
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }

  await recordAudit({
    action: 'CUSTOMER_AI_DRAFT_REQUEST',
    actorUserId: req.session.userId,
    actorRole: req.session.role,
    details: { threadId, draftLength: result.draft.length, trigger: 'manual' },
  });

  return NextResponse.json({ data: result });
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
