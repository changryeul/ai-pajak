/**
 * POST /api/consultant-erp/sessions/:id/coretax-record
 *   body: { idBilling, ntpn, bpeFilePath?, note? }
 *   → 200 — upserts the manual Coretax record and marks session COMPLETED.
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

const schema = z.object({
  idBilling: z.string().min(1),
  ntpn: z.string().min(1),
  bpeFilePath: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/coretax-record/);
  return m?.[1] ?? null;
}

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

  const admin = getSupabaseAdmin();

  // Session must be APPROVED before Coretax recording.
  const { data: sessionRow } = await admin
    .from('consultant_session')
    .select('status')
    .eq('id', sessionId)
    .single();
  if (!sessionRow || sessionRow.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Session must be APPROVED before recording Coretax result' },
      { status: 409 },
    );
  }

  const { error: upsertErr } = await admin.from('consultant_session_coretax_record').upsert(
    {
      session_id: sessionId,
      id_billing: parsed.data.idBilling,
      ntpn: parsed.data.ntpn,
      bpe_file_path: parsed.data.bpeFilePath ?? null,
      bpe_uploaded_at: parsed.data.bpeFilePath ? new Date().toISOString() : null,
      recorded_by: ctx.userId,
      recorded_at: new Date().toISOString(),
      note: parsed.data.note ?? null,
    },
    { onConflict: 'session_id' },
  );
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  await admin
    .from('consultant_session')
    .update({ status: 'COMPLETED', current_step: 5 })
    .eq('id', sessionId);

return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_CORETAX_RECORD'),
  )(request as unknown as RequestWithSession, handlePost);
}
