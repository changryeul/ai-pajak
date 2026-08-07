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
import { buildBillingBoard, buildExceptionQueueTarget, nextSerials, resolveIssuerScope, type BillingTarget } from '@/lib/id-billing/board-data';
import type { RequestWithSession } from '@/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

const bodySchema = z.object({
  sourceKind: z.enum(['ERP_SESSION', 'OPERATOR_QUEUE']),
  sourceId: z.string().uuid(),
  customerEmail: z.string().email().max(255).optional(),
  billingCode: z.string().max(40).optional(),
  // 수정요청 #26 — 승인 없이 예외 발행 (워크큐 검토화면 트리거, OPERATOR_QUEUE 전용)
  exception: z.boolean().optional(),
  exceptionReason: z.string().trim().min(5).max(500).optional(),
});

/** 예외 발행 사실을 담당 상담원·수퍼바이저에게 in-app 통지 (admin insert, best-effort). */
async function notifyExceptionIssuance(
  admin: SupabaseClient,
  params: { customerName: string; taxType: string; period: string; reason: string; byUserId: string },
): Promise<void> {
  try {
    const { data: sups } = await admin
      .from('user_roles')
      .select('user_id')
      .in('role', ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'])
      .eq('is_active', true);
    const recipients = [...new Set((sups ?? []).map(r => r.user_id).filter(Boolean))];
    if (recipients.length === 0) return;
    const rows = recipients.map(userId => ({
      user_id: userId,
      type: 'FILING_STATUS',
      priority: 'HIGH',
      title: `예외 발행: ${params.customerName} ${params.taxType}`,
      message: `${params.customerName} ${params.taxType} ${params.period} — 승인 없이 예외 발행됨. 사유: ${params.reason}`,
      data: { kind: 'ID_BILLING_EXCEPTION', ...params },
      channels: ['IN_APP'],
      read: false,
    }));
    await admin.from('notification').insert(rows);
  } catch {
    /* 통지 실패는 발행을 막지 않는다 */
  }
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }
  const { sourceKind, sourceId, customerEmail, billingCode, exception, exceptionReason } = parsed.data;

  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }

  let target: BillingTarget | null | undefined;
  if (exception) {
    // 수정요청 #26 — 승인 없이 예외 발행. 워크큐 큐 항목(OPERATOR_QUEUE)만 허용.
    if (sourceKind !== 'OPERATOR_QUEUE') {
      return NextResponse.json({ error: 'Exception issuance is only for operator queue items', errorKey: 'exceptionQueueOnly' }, { status: 400 });
    }
    if (!exceptionReason) {
      return NextResponse.json({ error: 'Exception reason is required (min 5 chars)', errorKey: 'exceptionReasonRequired' }, { status: 400 });
    }
    target = await buildExceptionQueueTarget(admin, scope, sourceId);
    if (!target) {
      return NextResponse.json(
        { error: 'Queue item not issuable — missing, already issued, zero amount, or out of scope' },
        { status: 404 },
      );
    }
  } else {
    // 정상 경로: 보드 재구성으로 게이트 3종 검증 — 보드의 target 은
    // (APPROVED + 미발행)만 포함하고 canIssue 는 작성본 이력 여부다.
    const { targets } = await buildBillingBoard(admin, scope);
    target = targets.find(t => t.sourceKind === sourceKind && t.sourceId === sourceId);
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
    is_exception: !!exception,
    issue_reason: exception ? exceptionReason : null,
  }));

  const { data: inserted, error: insertError } = await admin
    .from('id_billing_issuance')
    .insert(rows)
    .select('id, serial_no, tax_type, amount');
  if (insertError) {
    return NextResponse.json({ error: `Issuance insert failed: ${insertError.message}` }, { status: 500 });
  }

  // OPERATOR_QUEUE 소스는 큐 상태기계도 전진 (→ EBILLING_GENERATED).
  // 정상 경로는 APPROVED 에서만 전이. 예외 경로는 승인 전 상태에서 전이하되
  // 이미 발행/납부/완료된 큐는 되돌리지 않는다.
  if (sourceKind === 'OPERATOR_QUEUE') {
    let upd = admin
      .from('djp_submission_queue')
      .update({
        status: 'EBILLING_GENERATED',
        ...(billingCode ? { ebilling_code: billingCode } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId);
    upd = exception
      ? upd.not('status', 'in', '(EBILLING_GENERATED,PAYMENT_PENDING,COMPLETED)')
      : upd.eq('status', 'APPROVED');
    await upd;
  }

  // 예외 발행은 담당 상담원·수퍼바이저에게 통지 (감사는 withAudit + issue_reason 컬럼).
  if (exception && exceptionReason) {
    await notifyExceptionIssuance(admin, {
      customerName: target.customer.name,
      taxType: target.items[0]?.taxType ?? '—',
      period: target.items[0]?.period ?? '—',
      reason: exceptionReason,
      byUserId: req.session.userId,
    });
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
