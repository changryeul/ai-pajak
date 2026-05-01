import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const ALLOWED_DOC_TYPES = new Set([
  'akta', 'aktaRev', 'sk',
  'bank', 'sales', 'purchase',
  'petty', 'inventory', 'assets',
  'payroll', 'prepaid', 'prevSpt',
  'signedStatements',
]);

const MAX_BYTES = 50 * 1024 * 1024;

async function ensureOwnedSession(sessionId: string, customerId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (!data || data.customer_id !== customerId) return null;
  return data;
}

async function handleUpload(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  const userId = req.session?.userId;
  if (!customerId || !userId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const form = await req.formData();
  const docType = String(form.get('docType') ?? '');
  const file = form.get('file');
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json({ success: false, error: 'Invalid docType' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: 'File too large (max 50MB)' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  // Path is `<userId>/<sessionId>/<docType>-<ts>-<filename>` so storage RLS
  // (folder[0] = userId) keeps customers isolated.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `${userId}/${sessionId}/${docType}-${Date.now()}-${safeName}`;

  const { error: uploadErr } = await sb.storage
    .from('closing-documents')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
  if (uploadErr) {
    loggers.api.error({ err: uploadErr, sessionId, docType }, 'closing-document storage upload failed');
    return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 });
  }

  // Replace any existing row for the same (session, docType) slot.
  const { data: existing } = await sb
    .from('closing_document')
    .select('id, storage_path')
    .eq('session_id', sessionId)
    .eq('doc_type', docType)
    .maybeSingle();

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await sb.storage.from('closing-documents').remove([existing.storage_path]);
  }

  const { data: row, error: rowErr } = await sb
    .from('closing_document')
    .upsert(
      {
        session_id: sessionId,
        doc_type: docType,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,doc_type' }
    )
    .select()
    .single();
  if (rowErr) {
    loggers.api.error({ err: rowErr, sessionId, docType }, 'closing-document row upsert failed');
    return NextResponse.json({ success: false, error: rowErr.message }, { status: 500 });
  }

  // Convenience: when the signed financial-statements file is uploaded,
  // also flip the session flag so wizard step 4 unlocks "next".
  if (docType === 'signedStatements') {
    await sb
      .from('tax_closing_session')
      .update({ signed_statements_uploaded: true })
      .eq('id', sessionId);
  }

  return NextResponse.json({ success: true, data: row });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_DOCUMENT_UPLOAD'))(
    request as RequestWithSession,
    (r) => handleUpload(r, id)
  );
}
