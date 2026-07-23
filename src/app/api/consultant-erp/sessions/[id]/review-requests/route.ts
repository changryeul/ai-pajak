/**
 * /api/consultant-erp/sessions/:id/review-requests (v13 §4, 트랙 3)
 *
 * 상담원이 확신 없는 항목만 수퍼바이저에게 올리는 검토요청.
 * 거래별 진행상태 나열을 대체하는 supervisor 승인대기 화면의 핵심 입력.
 *
 * GET  — 세션의 검토요청 목록 (consultant + supervisor)
 * POST — 검토요청 생성 { calcKind?, itemLabel, reason } (세션 접근 가능한 상담원)
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
import type { RequestWithSession } from '@/types/auth';

const createSchema = z.object({
  calcKind: z.enum(['PPH21_TER', 'WITHHOLDING_SUMMARY', 'CORP_TAX_MONTHLY', 'PPN_NET', 'BANK_RECON']).nullable().optional(),
  itemLabel: z.string().min(2).max(200),
  reason: z.string().min(2).max(2000),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/review-requests/);
  return m?.[1] ?? null;
}

type GuardResult =
  | { error: Response; sessionId?: never }
  | { error?: never; sessionId: string };

async function guardSession(req: RequestWithSession): Promise<GuardResult> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return { error: NextResponse.json({ error: 'Bad id' }, { status: 400 }) };
  const ctx = await resolveConsultantContext({ userId: req.session.userId, role: req.session.role });
  if (!ctx) return { error: NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 }) };
  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return { error: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  return { sessionId };
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const g = await guardSession(req);
  if (g.error) return g.error;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_review_request')
    .select('id, calc_kind, item_label, reason, status, supervisor_comment, requested_by, answered_by, answered_at, created_at')
    .eq('session_id', g.sessionId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const g = await guardSession(req);
  if (g.error) return g.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_review_request')
    .insert({
      session_id: g.sessionId,
      calc_kind: parsed.data.calcKind ?? null,
      item_label: parsed.data.itemLabel,
      reason: parsed.data.reason,
      requested_by: req.session.userId,
    })
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_REVIEW_REQUEST'),
  )(request as unknown as RequestWithSession, handlePost);
}
