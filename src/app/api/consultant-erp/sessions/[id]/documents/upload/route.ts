/**
 * POST /api/consultant-erp/sessions/:id/documents/upload   (multipart/form-data)
 *   form fields:
 *     slot   : string (document_slot enum)
 *     file   : binary
 *   → 201 { documentId, storagePath, version }
 *
 * Uploads the file to the "consultant-erp-docs" bucket under
 * `<sessionId>/<slot>/<timestamp>-<filename>` and inserts a metadata row so
 * the parsing endpoint can fetch + run Claude over it.
 */

import { NextRequest, NextResponse } from 'next/server';
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

const ALLOWED_SLOTS = new Set([
  'PAYROLL',
  'WITHHOLDING_INVOICE',
  'CORP_TAX_INPUT',
  'VAT_IN_OUT',
  'OTHER_REFERENCE',
  'BANK_STATEMENT',
]);
const STORAGE_BUCKET = 'consultant-erp-docs';

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/documents\/upload/);
  return m?.[1] ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }
  const slot = String(formData.get('slot') ?? '');
  const file = formData.get('file');
  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json({ error: `Unknown slot ${slot}` }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (20 MB max)' }, { status: 413 });
  }

  const admin = getSupabaseAdmin();
  const { data: prev } = await admin
    .from('consultant_session_document')
    .select('version')
    .eq('session_id', sessionId)
    .eq('slot', slot)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (prev?.[0]?.version ?? 0) + 1;
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const storagePath = `${sessionId}/${slot}/v${nextVersion}-${Date.now()}-${safeName}`;

  const arrayBuf = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, new Uint8Array(arrayBuf), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 500 });

  const { data, error } = await admin
    .from('consultant_session_document')
    .insert({
      session_id: sessionId,
      slot,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      version: nextVersion,
      uploaded_by: ctx.userId,
      is_required: slot !== 'OTHER_REFERENCE',
    })
    .select('id, version, slot')
    .single();
  if (error) {
    // Roll back the storage object so we never leave orphans.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin
    .from('consultant_session')
    .update({ current_step: 2, status: 'UPLOADING' })
    .eq('id', sessionId)
    .lt('current_step', 2);

  return NextResponse.json(
    { success: true, data: { documentId: data.id, storagePath, version: nextVersion } },
    { status: 201 },
  );
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_DOCUMENT_UPLOAD_FILE'),
  )(request as unknown as RequestWithSession, handlePost);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
