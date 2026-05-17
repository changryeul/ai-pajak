/**
 * GET /api/consultant-erp/supervisor/approval/:sessionId
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

  const [docsRes, calcsRes, approvalsRes, coretaxRes] = await Promise.all([
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
