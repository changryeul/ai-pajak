/**
 * DELETE /api/operator/customer-inbox/threads/:id/auto-draft
 *
 * Operator clicks "닫기" on the Phase 2.1 auto-draft pill → clears
 * `auto_draft` + `auto_draft_at` so the pill disappears for everyone.
 *
 * Next customer message re-triggers the auto-draft helper.
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
  const { error } = await admin
    .from('customer_ai_thread')
    .update({ auto_draft: null, auto_draft_at: null })
    .eq('id', threadId);
  if (error) {
    loggers.api.error(
      { err: error.message, threadId },
      'auto-draft dismiss failed',
    );
    return NextResponse.json({ error: 'failed to clear draft' }, { status: 500 });
  }
  // Phase 2.2: also soft-delete any active draft history rows so the dropdown
  // hides them. Best effort — non-fatal if it fails.
  const { error: draftErr } = await admin
    .from('customer_ai_draft')
    .update({ status: 'dismissed' })
    .eq('thread_id', threadId)
    .eq('status', 'active');
  if (draftErr) {
    loggers.api.warn(
      { err: draftErr.message, threadId },
      'auto-draft history dismiss failed (non-fatal)',
    );
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
