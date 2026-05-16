/**
 * GET    /api/consultant-erp/sessions/:id   — full detail
 * PATCH  /api/consultant-erp/sessions/:id   — update step / status / supervisor_id
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
  currentStep: z.number().int().min(1).max(5).optional(),
  status: z
    .enum([
      'DRAFT',
      'UPLOADING',
      'PARSING',
      'REVIEWING',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
  supervisorId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID").nullable().optional(),
  totalEstimatedTax: z.number().nonnegative().nullable().optional(),
});

async function getSessionId(req: NextRequest): Promise<string | null> {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const sessionId = await getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data: session } = await admin
    .from('consultant_session')
    .select('*')
    .eq('id', sessionId)
    .single();
  const { data: documents } = await admin
    .from('consultant_session_document')
    .select('*')
    .eq('session_id', sessionId)
    .order('uploaded_at', { ascending: true });
  const { data: calcs } = await admin
    .from('consultant_session_calc')
    .select('*')
    .eq('session_id', sessionId);
  const { data: approvals } = await admin
    .from('consultant_session_approval')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  const { data: coretax } = await admin
    .from('consultant_session_coretax_record')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    data: { session, documents, calcs, approvals, coretax },
  });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const sessionId = await getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.currentStep !== undefined) patch.current_step = parsed.data.currentStep;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.supervisorId !== undefined) patch.supervisor_id = parsed.data.supervisorId;
  if (parsed.data.totalEstimatedTax !== undefined) patch.total_estimated_tax = parsed.data.totalEstimatedTax;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_session')
    .update(patch)
    .eq('id', sessionId)
    .select('id, status, current_step')
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
    withAudit('CONSULTANT_ERP_SESSION_UPDATE'),
  )(request as unknown as RequestWithSession, handlePatch);
}
