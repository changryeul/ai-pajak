/**
 * DELETE /api/operator/customer-inbox/threads/:id/drafts/:draftId
 *
 * Phase 2.2 — soft-delete a draft (status='dismissed'). The row is preserved
 * for audit/history but hidden from the UI's "active" filter.
 *
 * Operator-tier only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getIds(req: NextRequest): { threadId: string; draftId: string } | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/drafts\/([^/]+)/);
  if (!m) return null;
  return { threadId: m[1], draftId: m[2] };
}

async function handle(req: RequestWithSession): Promise<Response> {
  const ids = getIds(req as unknown as NextRequest);
  if (!ids) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  const { threadId, draftId } = ids;
  if (!UUID_RE.test(threadId) || !UUID_RE.test(draftId)) {
    return NextResponse.json({ error: 'invalid uuid' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from('customer_ai_draft')
    .update({ status: 'dismissed' })
    .eq('id', draftId)
    .eq('thread_id', threadId);
  if (error) {
    loggers.api.error(
      { err: error.message, threadId, draftId },
      'draft dismiss failed',
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
    withAudit('CUSTOMER_AI_DRAFT_DISMISS'),
  )(request as RequestWithSession, handle);
}
