/**
 * POST /api/consultant-erp/sessions/:id/documents
 *   body: { slot, storagePath, originalFilename, fileSize?, mimeType? }
 *   → 201 { documentId, version }
 *
 * P1 mvp: stores metadata only. Actual multipart upload is implemented in P2
 * (Supabase Storage bucket "consultant-erp" with consultant-only RLS).
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
  slot: z.enum([
    'PAYROLL',
    'WITHHOLDING_INVOICE',
    'CORP_TAX_INPUT',
    'VAT_IN_OUT',
    'OTHER_REFERENCE',
    'BANK_STATEMENT',
  ]),
  storagePath: z.string().min(1),
  originalFilename: z.string().min(1),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/documents/);
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
  const { data: existing } = await admin
    .from('consultant_session_document')
    .select('version')
    .eq('session_id', sessionId)
    .eq('slot', parsed.data.slot)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { data, error } = await admin
    .from('consultant_session_document')
    .insert({
      session_id: sessionId,
      slot: parsed.data.slot,
      storage_path: parsed.data.storagePath,
      original_filename: parsed.data.originalFilename,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType,
      version: nextVersion,
      uploaded_by: ctx.userId,
      is_required: parsed.data.slot !== 'OTHER_REFERENCE',
    })
    .select('id, version, slot')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // bump session step → 2 (자료업로드) at minimum
  await admin
    .from('consultant_session')
    .update({ current_step: 2, status: 'UPLOADING' })
    .eq('id', sessionId);

return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_DOCUMENT_UPLOAD'),
  )(request as unknown as RequestWithSession, handlePost);
}
