/**
 * POST /api/id-billing/issue
 *
 * ID Billing 발행 처리 (v19 §4).
 * body: { sourceKind, sourceId, customerEmail?, billingCode? }
 *
 * 백엔드 게이트 (프론트 플래그 신뢰 금지):
 *   1) 소스가 여전히 수퍼바이저 승인완료(APPROVED) 상태
 *   2) 해당 소스의 Coretax 작성본 생성 이력(id_billing_workbook_log) 존재
 *   3) 미발행 (중복 발행 방지)
 *
 * 발행 시: 세금 항목별 id_billing_issuance row (BIL-YYYYMM-NNN 일련번호)
 * 생성. OPERATOR_QUEUE 소스는 기존 상태기계 그대로 APPROVED →
 * EBILLING_GENERATED 로 전이시킨다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireBillingIssuer } from '@/middleware/requireBillingIssuer';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildBillingBoard, nextSerials, resolveIssuerScope } from '@/lib/id-billing/board-data';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  sourceKind: z.enum(['ERP_SESSION', 'OPERATOR_QUEUE']),
  sourceId: z.string().uuid(),
  customerEmail: z.string().email().max(255).optional(),
  billingCode: z.string().max(40).optional(),
});

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }
  const { sourceKind, sourceId, customerEmail, billingCode } = parsed.data;

  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }

  // 보드 재구성으로 게이트 3종을 한 번에 검증 — 보드의 target 은
  // (APPROVED + 미발행)만 포함하고 canIssue 는 작성본 이력 여부다.
  const { targets } = await buildBillingBoard(admin, scope);
  const target = targets.find(t => t.sourceKind === sourceKind && t.sourceId === sourceId);
  if (!target) {
    return NextResponse.json(
      { error: 'Target not issuable — requires supervisor approval and must not be already issued' },
      { status: 404 },
    );
  }
  if (!target.canIssue) {
    return NextResponse.json(
      { error: 'Coretax workbook must be generated before issuing (download the filled workbook first)', errorKey: 'workbookRequired' },
      { status: 400 },
    );
  }

  const serials = await nextSerials(admin, scope.taxPartnerId, target.items.length);
  const email = customerEmail ?? target.customer.email ?? null;
  const rows = target.items.map((item, i) => ({
    tax_partner_id: scope.taxPartnerId,
    customer_id: target.customer.id,
    source_kind: sourceKind,
    session_id: sourceKind === 'ERP_SESSION' ? sourceId : null,
    queue_item_id: sourceKind === 'OPERATOR_QUEUE' ? sourceId : null,
    serial_no: serials[i],
    tax_type: item.taxType,
    tax_period: item.period,
    kap_code: item.kap,
    kjs_code: item.kjs,
    tax_base: item.taxBase,
    tax_rate: item.rateLabel,
    amount: item.amount,
    billing_code: billingCode ?? null,
    status: 'ISSUED',
    customer_email: email,
    issued_by: req.session.userId,
  }));

  const { data: inserted, error: insertError } = await admin
    .from('id_billing_issuance')
    .insert(rows)
    .select('id, serial_no, tax_type, amount');
  if (insertError) {
    return NextResponse.json({ error: `Issuance insert failed: ${insertError.message}` }, { status: 500 });
  }

  // OPERATOR_QUEUE 소스는 큐 상태기계도 전진 (APPROVED → EBILLING_GENERATED).
  if (sourceKind === 'OPERATOR_QUEUE') {
    await admin
      .from('djp_submission_queue')
      .update({
        status: 'EBILLING_GENERATED',
        ...(billingCode ? { ebilling_code: billingCode } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('status', 'APPROVED');
  }

  return NextResponse.json({
    success: true,
    data: {
      issued: inserted,
      customer: target.customer.name,
      totalAmount: target.totalAmount,
    },
    message: `${target.customer.name} — ${inserted?.length ?? 0} ID Billing issued`,
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireBillingIssuer,
    withAudit('ID_BILLING_ISSUE'),
  )(request as RequestWithSession, handlePost);
}
