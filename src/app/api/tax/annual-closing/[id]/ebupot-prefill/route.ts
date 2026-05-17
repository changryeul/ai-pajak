/**
 * GET /api/tax/annual-closing/[id]/ebupot-prefill
 *
 * Returns a prefill payload for the inline 1721 A1 issuance form based on the
 * most recent PAYROLL closing_document with ocr_status=COMPLETED for this
 * session.
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       sourceDocId: string | null,
 *       sourceFilename: string | null,
 *       source: 'payrollRows' | 'lineItems' | 'none',
 *       ocrConfidence: number | null,
 *       lowConfidence: boolean,
 *       employees: EbupotEmpDraft[],  // empty when no PAYROLL OCR exists yet
 *     }
 *   }
 *
 * Auth: customer-side. The session must belong to the calling customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mapClosingOcrToEmployees } from '@/lib/tax/ebupot/ocr-to-employees';
import type { ClosingClassificationResult } from '@/lib/ai/closing-document-classifier';
import type { RequestWithSession } from '@/types/auth';

async function handle(req: RequestWithSession, sessionId: string): Promise<Response> {
  const sb = getSupabaseAdmin();

  // Resolve customerId from session (matches the pattern in the ocr route).
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

  // Ownership check
  const { data: session } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (!session || session.customer_id !== customerId) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // Find the latest PAYROLL closing_document with completed OCR.
  // We sort by ocr_completed_at DESC so that re-uploads supersede older results.
  const { data: docs } = await sb
    .from('closing_document')
    .select('id, file_name, ocr_status, ocr_confidence, ocr_extracted, ocr_completed_at')
    .eq('session_id', sessionId)
    .eq('ocr_status', 'COMPLETED')
    .order('ocr_completed_at', { ascending: false })
    .limit(20);

  const payrollDoc = (docs ?? []).find((d) => {
    const e = d.ocr_extracted as Partial<ClosingClassificationResult> | null;
    return e?.category === 'PAYROLL';
  });

  if (!payrollDoc) {
    return NextResponse.json({
      success: true,
      data: {
        sourceDocId: null,
        sourceFilename: null,
        source: 'none' as const,
        ocrConfidence: null,
        lowConfidence: false,
        employees: [],
      },
    });
  }

  const mapped = mapClosingOcrToEmployees(
    payrollDoc.ocr_extracted as Partial<ClosingClassificationResult>,
  );

  return NextResponse.json({
    success: true,
    data: {
      sourceDocId: payrollDoc.id,
      sourceFilename: payrollDoc.file_name,
      source: mapped.source,
      ocrConfidence: mapped.ocrConfidence,
      lowConfidence: mapped.lowConfidence,
      employees: mapped.employees,
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, (r) => handle(r, id));
}
