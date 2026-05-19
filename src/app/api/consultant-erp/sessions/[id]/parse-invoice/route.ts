/**
 * POST /api/consultant-erp/sessions/:id/parse-invoice
 *   body: { documentId: uuid }
 *   → 200 { inserted, mode, modelVersion, confidence, lines }
 *
 * Phase 2 of the supervisor invoice line-item feature. Reads the source
 * document via Claude Sonnet 4.6 vision, normalizes the extracted rows,
 * and INSERTS them into consultant_session_invoice_line. Existing lines
 * for the same document are deleted first so re-running the parser
 * always reflects the latest model output (no append/duplicate drift).
 *
 * Graceful-degrade: parser returns mode=MOCK with empty lines when the
 * API key is missing, file is a synthetic fixture path, storage misses,
 * or the model fails. The endpoint still 200s so the supervisor UI can
 * surface the reason instead of an opaque error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import {
  ensureSessionAccess,
  resolveConsultantContext,
} from '@/lib/consultant-erp/session-helpers';
import { parseInvoiceLines } from '@/lib/consultant-erp/invoice-line-parser';
import type { RequestWithSession } from '@/types/auth';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bodySchema = z.object({
  documentId: z.string().regex(UUID_RE, 'documentId must be a UUID'),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/parse-invoice/);
  return m?.[1] ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { documentId } = parsed.data;

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
  const { data: doc, error: dErr } = await admin
    .from('consultant_session_document')
    .select('id, session_id, slot, storage_path, original_filename, mime_type')
    .eq('id', documentId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: 'Document not found in this session' }, { status: 404 });
  }
  if (doc.slot !== 'WITHHOLDING_INVOICE' && doc.slot !== 'VAT_IN_OUT') {
    return NextResponse.json(
      { error: `slot=${doc.slot} is not invoice-eligible (need WITHHOLDING_INVOICE or VAT_IN_OUT)` },
      { status: 400 },
    );
  }

  const result = await parseInvoiceLines({
    documentId: doc.id,
    slot: doc.slot,
    storagePath: doc.storage_path,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
  });

  // Clear existing lines for this doc so re-runs don't pile up duplicates.
  const { error: delErr } = await admin
    .from('consultant_session_invoice_line')
    .delete()
    .eq('document_id', doc.id);
  if (delErr) {
    loggers.api.warn(
      { err: delErr, documentId: doc.id },
      'invoice parser: cleanup before insert failed',
    );
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  let inserted = 0;
  if (result.lines.length > 0) {
    const rows = result.lines.map((l) => ({
      document_id: doc.id,
      session_id: sessionId,
      line_no: l.line_no,
      invoice_number: l.invoice_number,
      invoice_date: l.invoice_date,
      counterparty_name: l.counterparty_name,
      counterparty_npwp: l.counterparty_npwp,
      currency: l.currency,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      subtotal: l.subtotal,
      vat_amount: l.vat_amount,
      withholding_amount: l.withholding_amount,
      total: l.total,
      parse_confidence: result.confidence,
      ai_model_version: result.modelVersion,
    }));
    const { error: iErr, count } = await admin
      .from('consultant_session_invoice_line')
      .insert(rows, { count: 'exact' });
    if (iErr) {
      loggers.api.warn({ err: iErr, documentId: doc.id }, 'invoice parser: insert failed');
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }
    inserted = count ?? rows.length;
  }

  // Reflect parse status on the document row so the case detail UI can
  // show PARSED / PENDING badges without a second round-trip.
  await admin
    .from('consultant_session_document')
    .update({
      parse_status: result.mode === 'CLAUDE' ? 'PARSED' : 'FAILED',
      parse_confidence: result.confidence,
      ai_model_version: result.modelVersion,
    })
    .eq('id', doc.id);

  return NextResponse.json({
    success: true,
    data: {
      inserted,
      mode: result.mode,
      modelVersion: result.modelVersion,
      confidence: result.confidence,
      reason: result.reason,
      lines: result.lines,
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_INVOICE_PARSE'),
  )(request as unknown as RequestWithSession, handlePost);
}
