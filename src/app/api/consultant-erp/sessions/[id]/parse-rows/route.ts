/**
 * GET   /api/consultant-erp/sessions/:id/parse-rows
 *   → 200 { rows, customerName, consultantName }
 *
 * PATCH /api/consultant-erp/sessions/:id/parse-rows
 *   body: { rowId, isResolved? }
 *   → 200 { row }
 *
 * POST  /api/consultant-erp/sessions/:id/parse-rows/message
 *   body: { locale, includeInfo? }
 *   → 200 { markdown }
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

const patchSchema = z.object({
  rowId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID"),
  isResolved: z.boolean().optional(),
  clientMessageSent: z.boolean().optional(),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/parse-rows/);
  return m?.[1] ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data: docs } = await admin
    .from('consultant_session_document')
    .select('id, slot')
    .eq('session_id', sessionId);
  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) {
    return NextResponse.json({ success: true, data: { rows: [], counts: { critical: 0, warning: 0, info: 0 } } });
  }
  const slotByDocId = new Map((docs ?? []).map((d) => [d.id, d.slot]));

  const { data: rows } = await admin
    .from('consultant_session_parse_row')
    .select('*')
    .in('document_id', docIds)
    .order('severity', { ascending: true })
    .order('row_index', { ascending: true });

  const counts = { critical: 0, warning: 0, info: 0 };
  for (const r of rows ?? []) {
    if (r.severity === 'CRITICAL') counts.critical++;
    else if (r.severity === 'WARNING') counts.warning++;
    else if (r.severity === 'INFO') counts.info++;
  }

  const augmented = (rows ?? []).map((r) => ({
    ...r,
    slot: slotByDocId.get(r.document_id) ?? null,
  }));

  return NextResponse.json({ success: true, data: { rows: augmented, counts } });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Confirm the row belongs to a doc of this session (defence-in-depth).
  const { data: row } = await admin
    .from('consultant_session_parse_row')
    .select('id, document_id')
    .eq('id', parsed.data.rowId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  const { data: doc } = await admin
    .from('consultant_session_document')
    .select('session_id')
    .eq('id', row.document_id)
    .maybeSingle();
  if (!doc || doc.session_id !== sessionId) {
    return NextResponse.json({ error: 'Row does not belong to this session' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.isResolved !== undefined) {
    patch.is_resolved = parsed.data.isResolved;
    patch.resolved_by = parsed.data.isResolved ? ctx.userId : null;
    patch.resolved_at = parsed.data.isResolved ? new Date().toISOString() : null;
  }
  if (parsed.data.clientMessageSent !== undefined) {
    patch.client_message_sent = parsed.data.clientMessageSent;
  }
  const { data, error } = await admin
    .from('consultant_session_parse_row')
    .update(patch)
    .eq('id', parsed.data.rowId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_PARSE_ROW_PATCH'),
  )(request as unknown as RequestWithSession, handlePatch);
}
