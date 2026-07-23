/**
 * POST /api/consultant-erp/sessions/:id/approval
 *   body: { action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW', comment? }
 *   → 200 { sessionStatus }
 *
 * Authorization rules (rule 3 of CLAUDE.md hard rules):
 *   - SUBMIT / WITHDRAW : any consultant of the session's tax_partner
 *   - APPROVE / REJECT  : TAX_OPERATOR_SUPERVISOR only (1-단 결재)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  ensureSessionAccess,
  resolveConsultantContext,
} from '@/lib/consultant-erp/session-helpers';
import { UserRole, type RequestWithSession } from '@/types/auth';

const schema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW']),
  comment: z.string().max(2000).optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/approval/);
  return m?.[1] ?? null;
}

const SUPERVISOR_ONLY = new Set(['APPROVE', 'REJECT']);

async function handlePost(req: RequestWithSession): Promise<Response> {
  const sessionId = getId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, comment } = parsed.data;

  if (SUPERVISOR_ONLY.has(action) && req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json(
      { error: `${action} requires TAX_OPERATOR_SUPERVISOR role` },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdmin();

  // v13 §4: 상담원이 올린 검토요청에 수퍼바이저 의견이 달리기 전(OPEN)에는
  // 승인할 수 없다 — "검토요청 항목 의견 작성 → 승인완료" 순서 강제.
  if (action === 'APPROVE') {
    const { count: openCount } = await admin
      .from('consultant_review_request')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('status', 'OPEN');
    if ((openCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `Cannot approve: ${openCount} review request(s) still await supervisor comment`,
          errorKey: 'openReviewRequests',
          openCount,
        },
        { status: 400 },
      );
    }
  }

  // Build snapshot at decision time (4-값 포함)
  const { data: sessionRow } = await admin
    .from('consultant_session')
    .select('*')
    .eq('id', sessionId)
    .single();
  const { data: calcs } = await admin
    .from('consultant_session_calc')
    .select('kind, amount, customer_input_amount, ai_amount, consultant_amount, source_summary, confidence')
    .eq('session_id', sessionId);
  const { data: docs } = await admin
    .from('consultant_session_document')
    .select('slot, version, parse_status')
    .eq('session_id', sessionId);
  const snapshot = {
    sessionRow,
    calcs,
    documents: docs,
  };

  const { error: approvalErr } = await admin.from('consultant_session_approval').insert({
    session_id: sessionId,
    action,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    comment: comment ?? null,
    snapshot,
  });
  if (approvalErr) return NextResponse.json({ error: approvalErr.message }, { status: 500 });

  const newStatus =
    action === 'SUBMIT'
      ? 'PENDING_APPROVAL'
      : action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
          ? 'REJECTED'
          : 'DRAFT';
  const newStep = action === 'APPROVE' ? 5 : action === 'SUBMIT' ? 4 : sessionRow!.current_step;

  const patch: Record<string, unknown> = { status: newStatus, current_step: newStep };
  if (action === 'SUBMIT' && !sessionRow!.supervisor_id) {
    // Auto-assign: pick any supervisor of the same tax_partner.
    const { data: sup } = await admin
      .from('consultant')
      .select('id')
      .eq('tax_partner_id', ctx.taxPartnerId)
      .eq('is_active', true)
      .limit(50);
    // we cannot filter by role here from the consultant table — leave NULL if none.
    if (sup && sup.length > 0) patch.supervisor_id = sup[0].id;
  }
  await admin.from('consultant_session').update(patch).eq('id', sessionId);

  // 최종 승인값 스탬프 (4-값 분리 저장의 4번째 값) — 승인 시점의 유효값을
  // approved_amount 로 고정. REJECT/WITHDRAW 시에는 초기화.
  if (action === 'APPROVE') {
    const { data: savedCalcs } = await admin
      .from('consultant_session_calc')
      .select('id, amount')
      .eq('session_id', sessionId)
      .eq('is_saved', true);
    const now = new Date().toISOString();
    for (const c of savedCalcs ?? []) {
      await admin
        .from('consultant_session_calc')
        .update({ approved_amount: c.amount, approved_at: now })
        .eq('id', c.id);
    }
  } else if (action === 'REJECT' || action === 'WITHDRAW') {
    await admin
      .from('consultant_session_calc')
      .update({ approved_amount: null, approved_at: null })
      .eq('session_id', sessionId);
  }

  return NextResponse.json({ success: true, data: { newStatus, newStep } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_APPROVAL'),
  )(request as unknown as RequestWithSession, handlePost);
}
