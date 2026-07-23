/**
 * POST /api/id-billing/workbook
 *
 * Coretax 작성본 xlsx 생성 + 다운로드 (v19 §5).
 * body: { targets: [{ sourceKind: 'ERP_SESSION'|'OPERATOR_QUEUE', sourceId }] }
 *       — 생략 시 스코프의 발행대상 전체.
 *
 * 생성 이력은 id_billing_workbook_log 에 회사(소스)별로 기록되며,
 * 이 이력이 발행(issue)의 백엔드 게이트가 된다. 응답은 xlsx binary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireBillingIssuer } from '@/middleware/requireBillingIssuer';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildBillingBoard, resolveIssuerScope } from '@/lib/id-billing/board-data';
import { buildCoretaxWorkbook } from '@/lib/id-billing/workbook';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  targets: z.array(z.object({
    sourceKind: z.enum(['ERP_SESSION', 'OPERATOR_QUEUE']),
    sourceId: z.string().uuid(),
  })).optional(),
});

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }

  const { targets: allTargets } = await buildBillingBoard(admin, scope);
  const requested = parsed.data.targets;
  const selected = requested
    ? allTargets.filter(t => requested.some(r => r.sourceKind === t.sourceKind && r.sourceId === t.sourceId))
    : allTargets;

  if (selected.length === 0) {
    return NextResponse.json({ error: 'No issuable targets found (supervisor approval required first)' }, { status: 404 });
  }

  const buffer = await buildCoretaxWorkbook(admin, selected);

  // 발행 게이트 근거 — 소스별 생성 이력 + 항목 스냅샷.
  const logRows = selected.map(t => ({
    tax_partner_id: scope.taxPartnerId,
    customer_id: t.customer.id,
    source_kind: t.sourceKind,
    session_id: t.sourceKind === 'ERP_SESSION' ? t.sourceId : null,
    queue_item_id: t.sourceKind === 'OPERATOR_QUEUE' ? t.sourceId : null,
    item_snapshot: t.items,
    generated_by: req.session.userId,
  }));
  const { error: logError } = await admin.from('id_billing_workbook_log').insert(logRows);
  if (logError) {
    return NextResponse.json({ error: `Workbook log failed: ${logError.message}` }, { status: 500 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const name = selected.length === 1
    ? `AI_Pajak_Coretax_ID_Billing_${selected[0].customer.name.replace(/[^\w-]+/g, '_')}_${stamp}.xlsx`
    : `AI_Pajak_Coretax_ID_Billing_ALL_${stamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      'X-Workbook-Targets': String(selected.length),
    },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireBillingIssuer,
    withAudit('ID_BILLING_WORKBOOK_GENERATE'),
  )(request as RequestWithSession, handlePost);
}
