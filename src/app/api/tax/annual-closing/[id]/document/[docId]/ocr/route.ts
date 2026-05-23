import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import {
  classifyClosingDocument,
  ClosingClassifierNotConfigured,
} from '@/lib/ai/closing-document-classifier';
import type { RequestWithSession } from '@/types/auth';

/**
 * POST /api/tax/annual-closing/[id]/document/[docId]/ocr
 *
 * 결산 wizard에 업로드된 closing_document 한 건을 AI로 분류·요약한다.
 * 결과는 closing_document.ocr_* 컬럼에 저장되어 wizard UI가 신뢰도/추출
 * 데이터를 표시할 수 있다. 비용이 들기 때문에 명시적 호출만 (자동 트리거 X).
 *
 * Body: 없음. URL 파라미터(id=sessionId, docId=closing_document.id)로 충분.
 */

const MAX_BYTES = 50 * 1024 * 1024;

async function handle(req: RequestWithSession, sessionId: string, docId: string): Promise<Response> {
  const sb = getSupabaseAdmin();

  // SessionContext.customerId 는 채워지지 않을 수 있으므로 userId 로 직접 lookup.
  // (다른 closing endpoint 들도 같은 문제 가능 — 별개 fix 후보)
  let customerId = req.session?.customerId;
  if (!customerId && req.session?.userId) {
    const { data } = await sb
      .from('customer')
      .select('id')
      .eq('user_id', req.session.userId)
      .maybeSingle();
    customerId = data?.id;
  }
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }

  // 소유권 검증 — session 의 customer_id 가 호출자 customer 와 일치해야 한다.
  const { data: session } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (!session || session.customer_id !== customerId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // 문서 행 + 같은 session 인지 확인.
  const { data: doc } = await sb
    .from('closing_document')
    .select('id, session_id, doc_type, file_name, storage_path, mime_type, size_bytes, ocr_status')
    .eq('id', docId)
    .single();
  if (!doc || doc.session_id !== sessionId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  if ((doc.size_bytes ?? 0) > MAX_BYTES) {
    return NextResponse.json({ success: false, error: 'File too large (50MB max)' }, { status: 400 });
  }

  // PROCESSING 마킹 — 여러 호출이 겹치지 않도록.
  await sb.from('closing_document').update({ ocr_status: 'PROCESSING', ocr_error: null }).eq('id', docId);

  try {
    // Storage 에서 다운로드.
    const { data: blob, error: dlErr } = await sb.storage
      .from('closing-documents')
      .download(doc.storage_path);
    if (dlErr || !blob) {
      throw new Error(`Storage download failed: ${dlErr?.message ?? 'unknown'}`);
    }
    const buf = await blob.arrayBuffer();

    const result = await classifyClosingDocument({
      data: buf,
      mimeType: doc.mime_type ?? 'application/octet-stream',
      docTypeHint: doc.doc_type,
    });

    const { error: updErr } = await sb
      .from('closing_document')
      .update({
        ocr_status: 'COMPLETED',
        ocr_confidence: result.confidence,
        ocr_extracted: {
          category: result.category,
          confidence: result.confidence,
          totalAmount: result.totalAmount,
          rowCount: result.rowCount,
          lineItems: result.lineItems,
          payrollRows: result.payrollRows ?? null,
          summary: result.summary,
          rawText: result.rawText,
          model: result.model,
        },
        ocr_error: null,
        ocr_completed_at: new Date().toISOString(),
      })
      .eq('id', docId);
    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      data: {
        docId,
        ocrStatus: 'COMPLETED',
        confidence: result.confidence,
        category: result.category,
        totalAmount: result.totalAmount,
        rowCount: result.rowCount,
        lineItems: result.lineItems,
        summary: result.summary,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR classification failed';
    const userMessage =
      err instanceof ClosingClassifierNotConfigured
        ? 'AI classification is not configured (admin: ANTHROPIC_API_KEY).'
        : message;
    loggers.ocr.error({ err, sessionId, docId }, 'closing-document OCR failed');
    await sb
      .from('closing_document')
      .update({ ocr_status: 'FAILED', ocr_error: userMessage })
      .eq('id', docId);
    const code = err instanceof ClosingClassifierNotConfigured ? 503 : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: code });
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_DOCUMENT_OCR'))(
    request as RequestWithSession,
    (r) => handle(r, id, docId)
  );
}
