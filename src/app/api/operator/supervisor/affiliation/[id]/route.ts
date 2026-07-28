/**
 * PATCH /api/operator/supervisor/affiliation/:id (v13 §6 — 트랙 5-C)
 *
 * 이동 요청 결재. to_supervisor(받는 쪽) 만 승인/반려할 수 있다.
 * body: { action: 'APPROVE' | 'REJECT', comment? }
 *
 * APPROVE 시 client_mode 에 따라:
 *   WITH_CLIENTS     → operator.supervisor_id 변경, 배정 유지
 *   OPERATOR_ONLY    → operator.supervisor_id 변경, 배정 유지 (상담원과 고객 함께)
 *   REASSIGN_CLIENTS → operator.supervisor_id 변경 + 해당 operator 의 활성 고객
 *                      배정 해제 (미배정 큐로 → 다음 auto-assign 재배정 대상)
 * 모든 결정은 감사(operator_affiliation_transfer + audit_log)로 남는다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().max(2000).optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/affiliation\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor role required' }, { status: 403 });
  }
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, comment } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data: me } = await admin.from('tax_operators').select('id').eq('user_id', req.session.userId).maybeSingle();

  const { data: tr } = await admin
    .from('operator_affiliation_transfer')
    .select('id, operator_id, to_supervisor_id, client_mode, status')
    .eq('id', id)
    .maybeSingle();
  if (!tr) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
  if (tr.status !== 'REQUESTED') return NextResponse.json({ error: `Already ${tr.status.toLowerCase()}` }, { status: 400 });
  // 받는 쪽 수퍼바이저만 결재.
  if (!me || tr.to_supervisor_id !== me.id) {
    return NextResponse.json({ error: 'Only the receiving supervisor can decide this transfer' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const reassignedIds: string[] = [];

  if (action === 'APPROVE') {
    // 소속 변경.
    await admin.from('tax_operators').update({ supervisor_id: tr.to_supervisor_id, updated_at: now }).eq('id', tr.operator_id);

    // 고객 처리범위.
    if (tr.client_mode === 'REASSIGN_CLIENTS') {
      const { data: assigns } = await admin
        .from('operator_client_assignments')
        .select('id, customer_id')
        .eq('operator_id', tr.operator_id)
        .eq('is_active', true);
      for (const a of assigns ?? []) {
        await admin.from('operator_client_assignments')
          .update({ is_active: false, unassigned_at: now, unassigned_date: now })
          .eq('id', a.id);
        reassignedIds.push(a.customer_id);
      }
      // 미배정 상태로 두어 다음 auto-assign 대상이 되게 한다 (기존팀 재배정).
    }
    // WITH_CLIENTS / OPERATOR_ONLY 는 배정 유지.
  }

  const { error: updErr } = await admin
    .from('operator_affiliation_transfer')
    .update({
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      decided_by: req.session.userId,
      decision_comment: comment ?? null,
      decided_at: now,
      reassigned_customer_ids: reassignedIds,
      updated_at: now,
    })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    data: { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', reassignedCount: reassignedIds.length },
  });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth, blockPlatformAdmin, requireConsultantOrSupervisor,
    withAudit('OPERATOR_AFFILIATION_TRANSFER_DECIDE'),
  )(request as unknown as RequestWithSession, handlePatch);
}
