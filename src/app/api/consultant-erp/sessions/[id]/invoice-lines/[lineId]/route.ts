/**
 * PATCH /api/consultant-erp/sessions/:id/invoice-lines/:lineId
 *   body: { is_reviewed?: boolean, reviewer_note?: string | null }
 *   → 200 { line }
 *
 * Per-line reviewer overrides — supervisor (or staff before submitting)
 * can mark an AI-parsed line as reviewed/OK or attach a short note.
 * Schema columns already exist on consultant_session_invoice_line
 * (is_reviewed BOOLEAN, reviewer_note TEXT) — this just exposes them.
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
import type { RequestWithSession } from '@/types/auth';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const patchSchema = z
  .object({
    is_reviewed: z.boolean().optional(),
    reviewer_note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (d) => d.is_reviewed !== undefined || d.reviewer_note !== undefined,
    'Provide at least one of is_reviewed or reviewer_note',
  );

function getIds(req: NextRequest): { sessionId: string | null; lineId: string | null } {
  const m = req.nextUrl.pathname.match(
    /\/sessions\/([^/]+)\/invoice-lines\/([^/]+)/,
  );
  return { sessionId: m?.[1] ?? null, lineId: m?.[2] ?? null };
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const { sessionId, lineId } = getIds(req as unknown as NextRequest);
  if (!sessionId || !lineId) {
    return NextResponse.json({ error: 'Bad route params' }, { status: 400 });
  }
  if (!UUID_RE.test(sessionId) || !UUID_RE.test(lineId)) {
    return NextResponse.json({ error: 'session/line id must be uuid' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) {
    return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });
  }
  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (parsed.data.is_reviewed !== undefined) patch.is_reviewed = parsed.data.is_reviewed;
  if (parsed.data.reviewer_note !== undefined) patch.reviewer_note = parsed.data.reviewer_note;

  const { data, error } = await admin
    .from('consultant_session_invoice_line')
    .update(patch)
    .eq('id', lineId)
    .eq('session_id', sessionId)
    .select('id, is_reviewed, reviewer_note')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Line not found in this session' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { line: data } });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_INVOICE_LINE_REVIEW'),
  )(request as unknown as RequestWithSession, handlePatch);
}
