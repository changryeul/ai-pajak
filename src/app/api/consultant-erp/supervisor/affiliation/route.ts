/**
 * /api/consultant-erp/supervisor/affiliation (v13 §6 — 트랙 5-C)
 *
 * 상담원 소속관리. TAX_OPERATOR_SUPERVISOR 전용.
 *
 * GET  — 팀 소속 현황 + 나에게 온/내가 보낸 이동 요청.
 * POST — 이동 요청 생성 { operatorId, toSupervisorId, clientMode, reason }.
 *        상대 수퍼바이저 승인 전까지 소속은 바뀌지 않는다.
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

const createSchema = z.object({
  operatorId: z.string().uuid(),
  toSupervisorId: z.string().uuid(),
  clientMode: z.enum(['WITH_CLIENTS', 'OPERATOR_ONLY', 'REASSIGN_CLIENTS']),
  reason: z.string().min(2).max(2000),
});

async function myOperatorId(admin: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<string | null> {
  const { data } = await admin.from('tax_operators').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor role required' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  const meId = await myOperatorId(admin, req.session.userId);

  // 팀 소속 현황 — 전체 operator + 소속 supervisor 이름.
  const { data: operators } = await admin
    .from('tax_operators')
    .select('id, employee_id, name, role, status, work_state, supervisor_id')
    .order('name', { ascending: true });
  const supNames = new Map((operators ?? []).map(o => [o.id, o.name]));

  const team = (operators ?? [])
    .filter(o => o.role === 'tax_operator')
    .map(o => ({
      id: o.id, employeeId: o.employee_id, name: o.name, status: o.status, workState: o.work_state,
      supervisorId: o.supervisor_id,
      supervisorName: o.supervisor_id ? (supNames.get(o.supervisor_id) ?? '—') : null,
      isMine: o.supervisor_id === meId,
    }));

  const supervisors = (operators ?? [])
    .filter(o => o.role === 'tax_operator_supervisor' || o.role === 'tax_operator_lead')
    .map(o => ({ id: o.id, name: o.name, employeeId: o.employee_id }));

  // 이동 요청 — 나에게 온 것(incoming) + 내가 보낸 것(outgoing).
  const { data: transfers } = await admin
    .from('operator_affiliation_transfer')
    .select('id, operator_id, from_supervisor_id, to_supervisor_id, client_mode, reason, status, decision_comment, created_at, decided_at')
    .or(`to_supervisor_id.eq.${meId},from_supervisor_id.eq.${meId}`)
    .order('created_at', { ascending: false })
    .limit(100);

  const opNames = new Map((operators ?? []).map(o => [o.id, o.name]));
  const decorate = (t: NonNullable<typeof transfers>[number]) => ({
    id: t.id,
    operatorName: opNames.get(t.operator_id) ?? '—',
    fromSupervisorName: t.from_supervisor_id ? (supNames.get(t.from_supervisor_id) ?? '—') : null,
    toSupervisorName: supNames.get(t.to_supervisor_id) ?? '—',
    clientMode: t.client_mode, reason: t.reason, status: t.status,
    decisionComment: t.decision_comment, createdAt: t.created_at, decidedAt: t.decided_at,
    direction: t.to_supervisor_id === meId ? 'incoming' : 'outgoing',
  });

  return NextResponse.json({
    success: true,
    data: {
      meId,
      team,
      supervisors,
      incoming: (transfers ?? []).filter(t => t.to_supervisor_id === meId && t.status === 'REQUESTED').map(decorate),
      transfers: (transfers ?? []).map(decorate),
    },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor role required' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { operatorId, toSupervisorId, clientMode, reason } = parsed.data;

  const admin = getSupabaseAdmin();
  const meId = await myOperatorId(admin, req.session.userId);

  const { data: op } = await admin.from('tax_operators').select('id, supervisor_id, role').eq('id', operatorId).maybeSingle();
  if (!op || op.role !== 'tax_operator') return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
  if (toSupervisorId === op.supervisor_id) {
    return NextResponse.json({ error: 'Operator already belongs to the target supervisor' }, { status: 400 });
  }

  const { data: created, error } = await admin
    .from('operator_affiliation_transfer')
    .insert({
      operator_id: operatorId,
      from_supervisor_id: op.supervisor_id,
      to_supervisor_id: toSupervisorId,
      client_mode: clientMode,
      reason,
      requested_by: req.session.userId,
    })
    .select('id, status')
    .single();
  if (error) {
    // UNIQUE(open per operator) 위반 → 진행 중 요청 존재.
    if (error.code === '23505') return NextResponse.json({ error: 'An open transfer request already exists for this operator', errorKey: 'transferAlreadyOpen' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 참고: from_supervisor 가 자기 팀원을 다른 팀으로 보내는 요청도, 다른
  // supervisor 가 데려가는 요청도 모두 to_supervisor 승인으로 확정된다.
  void meId;
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth, blockPlatformAdmin, requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth, blockPlatformAdmin, requireConsultantOrSupervisor,
    withAudit('OPERATOR_AFFILIATION_TRANSFER_REQUEST'),
  )(request as unknown as RequestWithSession, handlePost);
}
