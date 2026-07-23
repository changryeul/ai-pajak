/**
 * PATCH /api/consultant-erp/supervisor/review-requests/:id (v13 §4)
 *
 * 수퍼바이저가 상담원 검토요청에 의견을 남긴다.
 * body: { supervisorComment, status?: 'ANSWERED' | 'RESOLVED' }
 *
 * TAX_OPERATOR_SUPERVISOR 전용 + 자기 tax_partner 세션의 요청만.
 * OPEN 요청이 남아 있으면 세션 APPROVE 가 400 으로 막히므로 (approval
 * route 게이트), 이 endpoint 가 승인 흐름의 선행 단계다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureSessionAccess, resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import { UserRole, type RequestWithSession } from '@/types/auth';

const schema = z.object({
  supervisorComment: z.string().min(1).max(2000),
  status: z.enum(['ANSWERED', 'RESOLVED']).optional().default('ANSWERED'),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/review-requests\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor role required' }, { status: 403 });
  }
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({ userId: req.session.userId, role: req.session.role });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from('consultant_review_request')
    .select('id, session_id')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 세션 접근 검증 — ensureSessionAccess 와 동일 규칙 (supervisor 는 파트너
  // 무관 통과, ERP 전반의 기존 컨벤션과 정렬).
  const guard = await ensureSessionAccess({ sessionId: row.session_id, ctx });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data, error } = await admin
    .from('consultant_review_request')
    .update({
      supervisor_comment: parsed.data.supervisorComment,
      status: parsed.data.status,
      answered_by: req.session.userId,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status, supervisor_comment')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('SUPERVISOR_REVIEW_REQUEST_ANSWER'),
  )(request as unknown as RequestWithSession, handlePatch);
}
