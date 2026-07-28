/**
 * GET /api/operator/supervisor/approval/:sessionId
 *   → { session, customer, consultant, calcs, documents, parseRows,
 *       parseCounts, approvals, coretax }
 *
 * Consolidated payload for the 승인대기 케이스 상세 화면 (PDF p.2-5
 * of the 팀장용 ERP). Supervisor-only; the actual APPROVE/REJECT
 * action still flows through the existing /sessions/:id/approval
 * endpoint so we don't fork approval-state machine logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildCustomerTrend } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(
  req: RequestWithSession,
  sessionId: string,
): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from('consultant_session')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: customer } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp, customer_type')
    .eq('id', session.customer_id)
    .maybeSingle();

  let consultant: { id: string; full_name: string } | null = null;
  if (session.consultant_id) {
    const { data } = await admin
      .from('consultant')
      .select('id, full_name')
      .eq('id', session.consultant_id)
      .maybeSingle();
    consultant = data;
  }

  const [docsRes, calcsRes, approvalsRes, coretaxRes, reviewReqRes] = await Promise.all([
    admin
      .from('consultant_session_document')
      .select('*')
      .eq('session_id', sessionId)
      .order('uploaded_at', { ascending: true }),
    admin.from('consultant_session_calc').select('*').eq('session_id', sessionId),
    admin
      .from('consultant_session_approval')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }),
    admin
      .from('consultant_session_coretax_record')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle(),
    // v13 §4 — 상담원 수퍼바이저 검토요청 (OPEN 이 남아 있으면 승인 불가)
    admin
      .from('consultant_review_request')
      .select('id, calc_kind, item_label, reason, status, supervisor_comment, answered_at, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
  ]);

  // Parse rows (the findings panel)
  const docIds = (docsRes.data ?? []).map((d) => d.id);
  let parseRows: Array<{
    id: string;
    document_id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
    entity_label: string | null;
    field_name: string;
    field_value: unknown;
    message_ko: string | null;
    message_id: string | null;
    is_resolved: boolean;
  }> = [];
  if (docIds.length > 0) {
    const { data } = await admin
      .from('consultant_session_parse_row')
      .select(
        'id, document_id, severity, entity_label, field_name, field_value, message_ko, message_id, is_resolved',
      )
      .in('document_id', docIds)
      .limit(200);
    parseRows = (data ?? []) as typeof parseRows;
  }
  const parseCounts = { critical: 0, warning: 0, info: 0 };
  for (const r of parseRows) {
    if (r.severity === 'CRITICAL') parseCounts.critical++;
    else if (r.severity === 'WARNING') parseCounts.warning++;
    else if (r.severity === 'INFO') parseCounts.info++;
  }

  // 6개월 트렌드 (PDF p.3) — only meaningful for MONTHLY filings.
  const trend =
    session.filing_kind === 'MONTHLY' && session.customer_id
      ? await buildCustomerTrend(session.customer_id, 6)
      : [];

  // Invoice line-items (PDF p.4 자료 탭) — populated by the AI parser
  // for WITHHOLDING_INVOICE / VAT_IN_OUT documents.
  let invoiceLines: Array<{
    id: string;
    document_id: string;
    line_no: number;
    invoice_number: string | null;
    invoice_date: string | null;
    counterparty_name: string | null;
    counterparty_npwp: string | null;
    currency: string;
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    subtotal: number | null;
    vat_amount: number | null;
    withholding_amount: number | null;
    total: number | null;
    parse_confidence: number | null;
    is_reviewed: boolean;
    reviewer_note: string | null;
  }> = [];
  const { data: lineRows } = await admin
    .from('consultant_session_invoice_line')
    .select(
      'id, document_id, line_no, invoice_number, invoice_date, counterparty_name, counterparty_npwp, currency, description, quantity, unit_price, subtotal, vat_amount, withholding_amount, total, parse_confidence, is_reviewed, reviewer_note',
    )
    .eq('session_id', sessionId)
    .order('document_id', { ascending: true })
    .order('line_no', { ascending: true })
    .limit(500);
  invoiceLines = (lineRows ?? []) as typeof invoiceLines;

  return NextResponse.json({
    success: true,
    data: {
      session,
      customer,
      consultant,
      documents: docsRes.data ?? [],
      calcs: calcsRes.data ?? [],
      parseRows,
      parseCounts,
      approvals: approvalsRes.data ?? [],
      coretax: coretaxRes.data ?? null,
      trend,
      invoiceLines,
      reviewRequests: reviewReqRes.data ?? [],
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await ctx.params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, (r) => handleGet(r, sessionId));
}
