/**
 * GET /api/operator/customer-inbox/threads/:id/drafts
 *
 * Phase 2.2 — returns draft history for a thread (max 10, newest first).
 * Operator-tier only. Used by CustomerInboxClient to render the "이전 N건"
 * dropdown above the input area.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/drafts$/);
  return m?.[1] ?? null;
}

interface DraftRow {
  id: string;
  draft_text: string;
  source: 'manual' | 'auto';
  status: 'active' | 'dismissed' | 'applied';
  generated_at: string;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from('customer_ai_draft')
    .select('id, draft_text, source, status, generated_at')
    .eq('thread_id', threadId)
    .order('generated_at', { ascending: false })
    .limit(10);
  if (error) {
    loggers.api.error({ err: error.message, threadId }, 'drafts list failed');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: ((data ?? []) as DraftRow[]).map((r) => ({
      id: r.id,
      draftText: r.draft_text,
      source: r.source,
      status: r.status,
      generatedAt: r.generated_at,
    })),
  });
}

export async function GET(request: NextRequest) {
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
