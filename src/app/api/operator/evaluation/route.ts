import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING',
];

interface Weights { processing: number; accuracy: number; speed: number; approval: number; satisfaction: number }
interface Incentive { monthlyPool: number; perPoint: number; maxPerPerson: number; minScore: number; improvementThreshold: number }

async function authOk() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return null;
  return { admin, user };
}

/**
 * GET /api/operator/evaluation
 *
 * Computes per-operator scores from tax_operators metrics + completed/active
 * load + the saved weights. Speed score inverts avg_processing_minutes
 * (faster = higher). Returns ranked list + summary KPIs and the active
 * weights/incentive policy.
 */
export async function GET() {
  const auth = await authOk();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { admin } = auth;

  const { data: settingsRow } = await admin.from('operator_evaluation_settings').select('weights, incentive').eq('id', 1).maybeSingle();
  const weights: Weights = (settingsRow?.weights as Weights) ?? { processing: 20, accuracy: 30, speed: 20, approval: 20, satisfaction: 10 };
  const incentive: Incentive = (settingsRow?.incentive as Incentive) ?? { monthlyPool: 5_000_000, perPoint: 75_000, maxPerPerson: 2_000_000, minScore: 75, improvementThreshold: 60 };

  const { data: ops } = await admin
    .from('tax_operators')
    .select('id, employee_id, name, role, status, work_state, accuracy_pct, avg_processing_minutes, approval_quality_score, customer_satisfaction_score')
    .eq('role', 'tax_operator');
  const operators = ops ?? [];

  const opIds = operators.map(o => o.id);
  const loadMap = new Map<string, number>();
  const completedMap = new Map<string, number>();
  if (opIds.length > 0) {
    const { data: queue } = await admin.from('djp_submission_queue').select('operator_id, status').in('operator_id', opIds);
    for (const q of queue ?? []) {
      if (!q.operator_id) continue;
      if (ACTIVE_STATUSES.includes(q.status)) loadMap.set(q.operator_id, (loadMap.get(q.operator_id) ?? 0) + 1);
      else if (q.status === 'COMPLETED') completedMap.set(q.operator_id, (completedMap.get(q.operator_id) ?? 0) + 1);
    }
  }

  // Throughput baseline: max completed across team → 100 score.
  const maxCompleted = Math.max(1, ...operators.map(o => completedMap.get(o.id) ?? 0));
  // Speed baseline: best avg time among the team → 100. Slower → lower.
  const speedTimes = operators.map(o => o.avg_processing_minutes ?? 60).filter(t => t > 0);
  const bestTime = Math.min(...speedTimes, 60);

  const rows = operators.map(o => {
    const completed = completedMap.get(o.id) ?? 0;
    const processing = Math.round((completed / maxCompleted) * 100);     // 처리량
    const accuracy = Number(o.accuracy_pct ?? 0);                          // 정확도
    const speedRaw = o.avg_processing_minutes ?? 60;
    const speed = Math.round((bestTime / Math.max(speedRaw, 1)) * 100);   // 처리속도
    const approval = Number(o.approval_quality_score ?? 0);                // Supervisor 승인품질
    const satisfaction = Number(o.customer_satisfaction_score ?? 0);       // 고객응대

    const weighted =
      processing * (weights.processing / 100) +
      accuracy * (weights.accuracy / 100) +
      speed * (weights.speed / 100) +
      approval * (weights.approval / 100) +
      satisfaction * (weights.satisfaction / 100);
    const totalScore = Math.round(weighted * 10) / 10;

    return {
      id: o.id,
      employee_id: o.employee_id,
      name: o.name,
      work_state: o.work_state,
      active_load: loadMap.get(o.id) ?? 0,
      completed_count: completed,
      avg_minutes: o.avg_processing_minutes,
      accuracy,
      approval,
      satisfaction,
      scores: { processing, accuracy, speed, approval, satisfaction, total: totalScore },
    };
  });

  // Rank + incentive distribution.
  rows.sort((a, b) => b.scores.total - a.scores.total);
  let remainingPool = incentive.monthlyPool;
  const enriched = rows.map((r, idx) => {
    const earned = r.scores.total >= incentive.minScore
      ? Math.min(Math.round(r.scores.total * incentive.perPoint), incentive.maxPerPerson)
      : 0;
    const pay = Math.min(earned, Math.max(remainingPool, 0));
    remainingPool -= pay;
    let label: 'EXCELLENT' | 'PAYABLE' | 'IMPROVE' | 'HOLD' = 'HOLD';
    if (r.scores.total >= 90) label = 'EXCELLENT';
    else if (r.scores.total >= incentive.minScore) label = 'PAYABLE';
    else if (r.scores.total >= incentive.improvementThreshold) label = 'IMPROVE';
    return { ...r, rank: idx + 1, incentive_amount: pay, evaluation_label: label };
  });

  const totalIncentive = enriched.reduce((s, r) => s + r.incentive_amount, 0);
  const avgScore = enriched.length > 0
    ? Math.round((enriched.reduce((s, r) => s + r.scores.total, 0) / enriched.length) * 10) / 10
    : 0;
  const top = enriched[0] ?? null;
  const weightSum = weights.processing + weights.accuracy + weights.speed + weights.approval + weights.satisfaction;

  return NextResponse.json({
    success: true,
    data: {
      operators: enriched,
      weights,
      incentive,
      summary: {
        evaluatedCount: enriched.length,
        topOperator: top ? { name: top.name, employee_id: top.employee_id, score: top.scores.total } : null,
        avgScore,
        totalIncentive,
        weightSum,
      },
    },
  });
}
