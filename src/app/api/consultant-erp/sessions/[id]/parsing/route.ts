/**
 * POST /api/consultant-erp/sessions/:id/parsing
 *   body: { documentId? }   // omit → parse every document of the session
 *   → 200 { parsed: [{ documentId, rowCount, findingCount }] }
 *
 * P3 mvp:
 *   - Drives the mock parser per slot, evaluates each row against the rule
 *     engine, and stores findings as `consultant_session_parse_row`.
 *   - Sets the document's parse_status to PARSED with parse_confidence.
 *   - Next iteration (P3.b) swaps the mock for Claude Sonnet 4.6 streaming.
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
import { getMockRowsForSlot } from '@/lib/consultant-erp/mock-parser';
import { evaluateRow } from '@/lib/consultant-erp/parse-row-rules';
import type { RequestWithSession } from '@/types/auth';

const schema = z.object({
  documentId: z.string().uuid().optional(),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/parsing/);
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

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();

  let docsQuery = admin
    .from('consultant_session_document')
    .select('id, slot, storage_path')
    .eq('session_id', sessionId);
  if (parsed.data.documentId) docsQuery = docsQuery.eq('id', parsed.data.documentId);
  const { data: docs, error: docsErr } = await docsQuery;
  if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });
  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents to parse' }, { status: 400 });
  }

  const result: Array<{ documentId: string; slot: string; rowCount: number; findingCount: number }> = [];

  for (const doc of docs) {
    // Wipe any previous findings for this document so we always recompute.
    await admin
      .from('consultant_session_parse_row')
      .delete()
      .eq('document_id', doc.id);

    const rows = getMockRowsForSlot(doc.slot);
    const inserts: Array<{
      document_id: string;
      row_index: number;
      entity_label: string;
      field_name: string;
      field_value: unknown;
      severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
      issue_code: string;
      message_ko: string;
      message_id: string;
    }> = [];

    let findingCount = 0;
    for (const r of rows) {
      const findings = evaluateRow({ slot: doc.slot, row: r.fields });
      for (const { fieldName, finding } of findings) {
        findingCount++;
        inserts.push({
          document_id: doc.id,
          row_index: r.rowIndex,
          entity_label: r.entityLabel,
          field_name: fieldName,
          field_value: r.fields[fieldName] as unknown,
          severity: finding.severity,
          issue_code: finding.issueCode,
          message_ko: finding.messageKo,
          message_id: finding.messageId,
        });
      }
    }

    if (inserts.length > 0) {
      const { error: insertErr } = await admin
        .from('consultant_session_parse_row')
        .insert(inserts);
      if (insertErr) {
        return NextResponse.json(
          { error: `Insert findings failed: ${insertErr.message}` },
          { status: 500 },
        );
      }
    }

    await admin
      .from('consultant_session_document')
      .update({
        parse_status: 'PARSED',
        parse_confidence: 85,
        ai_model_version: 'mock-p3-mvp-v1',
      })
      .eq('id', doc.id);

    result.push({
      documentId: doc.id,
      slot: doc.slot,
      rowCount: rows.length,
      findingCount,
    });
  }

  await admin
    .from('consultant_session')
    .update({ status: 'REVIEWING', current_step: 3 })
    .eq('id', sessionId)
    .lt('current_step', 3);

  return NextResponse.json({ success: true, data: { parsed: result } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_PARSING'),
  )(request as unknown as RequestWithSession, handlePost);
}
