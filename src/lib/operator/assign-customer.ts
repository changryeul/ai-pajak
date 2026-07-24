/**
 * 고객 → tax_operator 자동배정 실행 (v13 §5, 트랙 4).
 *
 * 스코어링 엔진(assignment-engine)으로 최적 operator 를 골라
 * operator_client_assignments 에 배정 row 를 만들고 operator_assignment_log
 * 에 근거를 기록한다. 전원 만석/오프라인이면 배정하지 않고 overflow 를
 * 반환(미배정 큐 fallback).
 *
 * 순수 스코어링은 engine 에, DB I/O·감사는 여기에.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { rankOperators, type OperatorCandidate } from './assignment-engine';

export interface AssignResult {
  assigned: boolean;
  operatorId: string | null;
  method: 'sticky' | 'scored' | 'overflow';
  score: number | null;
  candidatesConsidered: number;
  reason?: string;
}

async function loadCandidates(admin: SupabaseClient): Promise<OperatorCandidate[]> {
  const { data } = await admin
    .from('tax_operators')
    .select('id, max_clients, status, work_state, auto_assign_enabled, approval_quality_score, accuracy_pct, specialties')
    .eq('role', 'tax_operator');
  return (data ?? []).map((o) => ({
    id: o.id,
    maxClients: Number(o.max_clients ?? 0),
    status: o.status,
    workState: o.work_state,
    autoAssignEnabled: o.auto_assign_enabled !== false,
    approvalQualityScore: o.approval_quality_score,
    accuracyPct: o.accuracy_pct,
    specialties: Array.isArray(o.specialties) ? o.specialties : [],
  }));
}

async function loadOperatorLoads(admin: SupabaseClient): Promise<Record<string, number>> {
  // 진행 중(미완료) 배정 건수 = 업무량.
  const { data } = await admin
    .from('operator_client_assignments')
    .select('operator_id')
    .eq('is_active', true);
  const loads: Record<string, number> = {};
  for (const r of data ?? []) {
    if (r.operator_id) loads[r.operator_id] = (loads[r.operator_id] ?? 0) + 1;
  }
  return loads;
}

/**
 * 한 고객을 배정한다. 이미 활성 배정이 있으면 skip (idempotent).
 * @param triggeredBy 'AUTO' (접수 즉시) | 'SUPERVISOR' (수동 실행)
 */
export async function assignCustomerToOperator(
  admin: SupabaseClient,
  customerId: string,
  opts: { triggeredBy?: 'AUTO' | 'SUPERVISOR'; actorUserId?: string | null; taxType?: string | null } = {},
): Promise<AssignResult> {
  const { triggeredBy = 'AUTO', actorUserId = null, taxType = null } = opts;

  // 이미 배정돼 있으면 무동작.
  const { data: existing } = await admin
    .from('operator_client_assignments')
    .select('operator_id')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();
  if (existing) {
    return { assigned: false, operatorId: existing.operator_id, method: 'sticky', score: null, candidatesConsidered: 0, reason: 'already-assigned' };
  }

  const [candidates, loads] = await Promise.all([loadCandidates(admin), loadOperatorLoads(admin)]);

  // sticky: 과거(비활성 포함) 배정 이력의 최근 operator.
  const { data: history } = await admin
    .from('operator_client_assignments')
    .select('operator_id, assigned_date')
    .eq('customer_id', customerId)
    .order('assigned_date', { ascending: false })
    .limit(1);
  const stickyOperatorId = history?.[0]?.operator_id ?? null;

  const result = rankOperators(candidates, (id) => loads[id] ?? 0, { currentLoad: 0, stickyOperatorId, taxType });

  const now = new Date().toISOString();

  if (!result.best) {
    // overflow — 미배정 큐 fallback. 로그만 남기고 배정 안 함.
    await admin.from('operator_assignment_log').insert({
      customer_id: customerId, operator_id: null, method: 'overflow',
      score: null, breakdown: { unappliedCriteria: result.unappliedCriteria },
      candidates_considered: candidates.length, triggered_by: triggeredBy, actor_user_id: actorUserId,
    });
    return { assigned: false, operatorId: null, method: 'overflow', score: null, candidatesConsidered: candidates.length, reason: 'all-at-capacity-or-offline' };
  }

  const best = result.best;
  const { error: insErr } = await admin.from('operator_client_assignments').insert({
    customer_id: customerId,
    operator_id: best.operatorId,
    is_active: true,
    assigned_date: now,
    assignment_reason: `auto:${result.method} score=${best.score}`,
    assigned_by: actorUserId,
  });
  if (insErr) {
    return { assigned: false, operatorId: null, method: 'overflow', score: null, candidatesConsidered: candidates.length, reason: insErr.message };
  }

  await admin.from('operator_assignment_log').insert({
    customer_id: customerId, operator_id: best.operatorId, method: result.method,
    score: best.score,
    breakdown: { ...best.breakdown, unappliedCriteria: result.unappliedCriteria },
    candidates_considered: candidates.length, triggered_by: triggeredBy, actor_user_id: actorUserId,
  });

  return { assigned: true, operatorId: best.operatorId, method: result.method, score: best.score, candidatesConsidered: candidates.length };
}
