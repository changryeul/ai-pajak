/**
 * DELETE /api/operator/customer-inbox/threads/:id/auto-draft
 *
 * Operator clicks "닫기" on the auto-draft pill → marks all active drafts
 * as `dismissed` so the dropdown hides them.
 *
 * Phase 2.3 (commit dropping customer_ai_thread.auto_draft column): the
 * legacy `UPDATE customer_ai_thread SET auto_draft = null` is gone. All
 * draft state lives in customer_ai_draft table now.
 *
 * Next customer message re-triggers the auto-draft helper (subject to 30s
 * throttle in the messages route).
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

function getThreadId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/auto-draft/);
  return m?.[1] ?? null;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const threadId = getThreadId(req as unknown as NextRequest);
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { error: draftErr } = await admin
    .from('customer_ai_draft')
    .update({ status: 'dismissed' })
    .eq('thread_id', threadId)
    .eq('status', 'active');
  if (draftErr) {
    loggers.api.error(
      { err: draftErr.message, threadId },
      'auto-draft dismiss failed',
    );
    return NextResponse.json({ error: 'failed to clear draft' }, { status: 500 });
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
