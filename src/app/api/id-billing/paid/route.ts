/**
 * POST /api/id-billing/paid
 *
 * 납부확인 — Coretax API 보류(2026-08-04) 기간의 수동 마감 경로.
 * 운영자/상담원이 Coretax 포털에서 납부 확인 후 NTPN 을 직접 입력하면:
 *   1. id_billing_issuance: ISSUED/SENT → PAID (+ ntpn, paid_at)
 *   2. 소스가 OPERATOR_QUEUE 면 djp_submission_queue 행도
 *      EBILLING_GENERATED/PAYMENT_PENDING → COMPLETED (+ ntpn, completed_at) 동기화
 *
 * body: { issuanceId: uuid, ntpn: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireBillingIssuer } from '@/middleware/requireBillingIssuer';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveIssuerScope } from '@/lib/id-billing/board-data';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  issuanceId: z.string().uuid(),
  // NTPN 은 16자리 영숫자가 표준이지만 포털 표기 편차를 감안해 느슨하게 받는다.
  ntpn: z.string().trim().min(8).max(40),
});

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', errorKey: 'invalidNtpn', details: parsed.error.flatten() }, { status: 400 });
  }
  const { issuanceId, ntpn } = parsed.data;

  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }

  const { data: row } = await admin
    .from('id_billing_issuance')
    .select('id, status, source_kind, queue_item_id, serial_no')
    .eq('id', issuanceId)
    .eq('tax_partner_id', scope.taxPartnerId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Issuance not found in your scope' }, { status: 404 });

  if (row.status === 'PAID') {
    return NextResponse.json({ error: 'Already marked as paid', errorKey: 'alreadyPaid' }, { status: 400 });
  }
  if (row.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Cancelled issuance cannot be marked paid', errorKey: 'cancelled' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from('id_billing_issuance')
    .update({ status: 'PAID', ntpn, paid_at: now, updated_at: now })
    .eq('id', row.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 소스 큐 동기화 (best-effort — 큐가 이미 다른 상태면 issuance PAID 만 남긴다).
  let queueSynced = false;
  if (row.source_kind === 'OPERATOR_QUEUE' && row.queue_item_id) {
    const { data: q } = await admin
      .from('djp_submission_queue')
      .select('id, status')
      .eq('id', row.queue_item_id)
      .maybeSingle();
    if (q && (q.status === 'EBILLING_GENERATED' || q.status === 'PAYMENT_PENDING')) {
      const { error: qErr } = await admin
        .from('djp_submission_queue')
        .update({ status: 'COMPLETED', ntpn, completed_at: now, updated_at: now })
        .eq('id', q.id);
      if (qErr) {
        loggers.api.warn({ err: qErr.message, issuanceId: row.id }, 'paid: queue sync failed');
      } else {
        queueSynced = true;
      }
    }
  }

  await admin.from('audit_log').insert({
    user_id: req.session.userId,
    action: 'ID_BILLING_MARK_PAID',
    resource_type: 'id_billing_issuance',
    resource_id: row.id,
    details: { serialNo: row.serial_no, ntpn, queueSynced, queueItemId: row.queue_item_id },
    created_at: now,
  });

  return NextResponse.json({ success: true, data: { id: row.id, status: 'PAID', ntpn, queueSynced } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireBillingIssuer,
    withAudit('ID_BILLING_MARK_PAID'),
  )(request as RequestWithSession, handlePost);
}
