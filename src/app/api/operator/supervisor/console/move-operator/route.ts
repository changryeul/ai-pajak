/**
 * POST /api/operator/supervisor/console/move-operator
 *   body: { operatorId, toSupervisorId, reason? }
 *
 * 8/21 #30/#32 — 소속관리에서 상담원을 특정 수퍼바이저 팀으로 즉시 이동.
 * 기존 요청→승인(operator_affiliation_transfer) 흐름과 달리, 콘솔(조직 관리 화면)
 * 에서는 수퍼바이저가 바로 소속(tax_operators.supervisor_id)을 변경한다.
 * 미지정(supervisor_id NULL) 상담원도 이 경로로 팀에 배정한다.
 * 감사를 위해 operator_affiliation_transfer 에 APPROVED 이력 1건을 남긴다(best-effort).
 * 수퍼바이저(및 상위) 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUP_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_MASTER'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !SUP_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const parsed = z.object({
    operatorId: z.string().uuid(),
    toSupervisorId: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { operatorId, toSupervisorId, reason } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data: op } = await admin.from('tax_operators').select('id, supervisor_id, role').eq('id', operatorId).maybeSingle();
  if (!op) return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
  if (op.role !== 'tax_operator') return NextResponse.json({ error: 'Only counselors can be moved' }, { status: 400 });
  if (op.supervisor_id === toSupervisorId) return NextResponse.json({ error: 'Already in that team' }, { status: 400 });

  const { data: sup } = await admin.from('tax_operators').select('id, role').eq('id', toSupervisorId).maybeSingle();
  if (!sup || !['tax_operator_supervisor', 'tax_operator_lead'].includes(sup.role)) {
    return NextResponse.json({ error: 'Target is not a supervisor' }, { status: 400 });
  }

  const from = op.supervisor_id;
  const { error: updErr } = await admin.from('tax_operators').update({ supervisor_id: toSupervisorId }).eq('id', operatorId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 감사 이력 (best-effort — 실패해도 이동은 유효)
  await admin.from('operator_affiliation_transfer').insert({
    operator_id: operatorId, from_supervisor_id: from, to_supervisor_id: toSupervisorId,
    client_mode: 'OPERATOR_ONLY', reason: reason || '콘솔 즉시 이동', status: 'APPROVED',
    requested_by: user.id, decided_at: new Date().toISOString(),
  }).then(() => {}, () => {});

  return NextResponse.json({ success: true, data: { operatorId, from, to: toSupervisorId } });
}
