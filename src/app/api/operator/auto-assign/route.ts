import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { assignCustomerToOperator } from '@/lib/operator/assign-customer';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

async function getSupervisorUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: allRoles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const role = allRoles?.map(r => r.role).find(r => SUPERVISOR_ROLES.includes(r));
  if (!role) {
    return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * POST /api/operator/auto-assign  (v13 §5 — 트랙 4)
 *
 * ① 미배정 고객(operator_client_assignments 없음)을 스코어링 엔진으로
 *    tax_operator 에게 배정 (7기준 중 데이터 있는 것 반영, 감사 기록).
 * ② 미배정 PENDING 큐 아이템을 고객의 담당 operator 로 sticky 배정
 *    (없으면 스코어 최상위). 모두 만석/오프라인이면 overflow(미배정 큐 유지).
 */
export async function POST() {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin, user } = auth;

  // ── ① 미배정 고객 자동배정 (customer → operator) ──
  const { data: activeAssignments } = await admin
    .from('operator_client_assignments')
    .select('customer_id')
    .eq('is_active', true);
  const assignedCustomerIds = new Set((activeAssignments ?? []).map(a => a.customer_id));

  // 배정 대상: 큐에 항목이 있는데 아직 담당 operator 배정이 없는 고객.
  const { data: queuedCustomers } = await admin
    .from('djp_submission_queue')
    .select('customer_id')
    .not('status', 'in', '("COMPLETED","FAILED")');
  const unassignedCustomers = Array.from(
    new Set((queuedCustomers ?? []).map(q => q.customer_id).filter((id): id is string => !!id && !assignedCustomerIds.has(id))),
  );

  const customerResults: Array<{ customerId: string; operatorId: string | null; method: string; score: number | null }> = [];
  for (const customerId of unassignedCustomers) {
    const r = await assignCustomerToOperator(admin, customerId, { triggeredBy: 'SUPERVISOR', actorUserId: user!.id });
    customerResults.push({ customerId, operatorId: r.operatorId, method: r.method, score: r.score });
  }
  const customersAssigned = customerResults.filter(r => r.operatorId && r.method !== 'overflow').length;

  // 1. Get unassigned PENDING items
  const { data: unassigned, error: uaError } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id')
    .is('operator_id', null)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  if (uaError) {
    return NextResponse.json({ error: 'Failed to fetch unassigned items' }, { status: 500 });
  }

  if (!unassigned || unassigned.length === 0) {
    return NextResponse.json({
      success: true,
      data: { customersAssigned, customerResults, assigned: 0, overflow: 0, details: [] },
    });
  }

  // 2. Get active operators with max_clients
  const { data: operators, error: opError } = await admin
    .from('tax_operators')
    .select('id, max_clients')
    .eq('status', 'active');

  if (opError || !operators || operators.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        customersAssigned,
        customerResults,
        assigned: 0,
        overflow: unassigned.length,
        details: unassigned.map(item => ({
          queueItemId: item.id,
          operatorId: null,
          method: 'overflow',
        })),
      },
    });
  }

  // 3. Get active queue item count per operator
  const { data: activeItems } = await admin
    .from('djp_submission_queue')
    .select('operator_id')
    .not('status', 'in', '("COMPLETED","FAILED")')
    .not('operator_id', 'is', null);

  const operatorLoad: Record<string, number> = {};
  for (const op of operators) {
    operatorLoad[op.id] = 0;
  }
  for (const item of activeItems || []) {
    if (item.operator_id && operatorLoad[item.operator_id] !== undefined) {
      operatorLoad[item.operator_id]++;
    }
  }

  // 4. Get existing customer-operator assignments (sticky)
  const { data: assignments } = await admin
    .from('operator_client_assignments')
    .select('customer_id, operator_id')
    .eq('is_active', true);

  const customerOperatorMap: Record<string, string> = {};
  for (const a of assignments || []) {
    customerOperatorMap[a.customer_id] = a.operator_id;
  }

  // Build operator capacity lookup
  const operatorCapacity: Record<string, number> = {};
  for (const op of operators) {
    operatorCapacity[op.id] = op.max_clients;
  }

  // 5. Assign items
  const now = new Date().toISOString();
  const details: Array<{ queueItemId: string; operatorId: string | null; method: string }> = [];
  let assignedCount = 0;
  let overflowCount = 0;

  for (const item of unassigned) {
    let targetOperatorId: string | null = null;
    let method = 'overflow';

    // 5a. Sticky assignment: check if customer has existing operator
    const stickyOperatorId = customerOperatorMap[item.customer_id];
    if (stickyOperatorId && operatorCapacity[stickyOperatorId] !== undefined) {
      const load = operatorLoad[stickyOperatorId] || 0;
      const capacity = operatorCapacity[stickyOperatorId];
      if (load < capacity) {
        targetOperatorId = stickyOperatorId;
        method = 'sticky';
      }
    }

    // 5b. Round-robin: find operator with least load and available capacity
    if (!targetOperatorId) {
      let minLoad = Infinity;
      let bestOperator: string | null = null;

      for (const op of operators) {
        const load = operatorLoad[op.id] || 0;
        if (load < op.max_clients && load < minLoad) {
          minLoad = load;
          bestOperator = op.id;
        }
      }

      if (bestOperator) {
        targetOperatorId = bestOperator;
        method = 'round_robin';
      }
    }

    // 5c. Assign or overflow
    if (targetOperatorId) {
      const { error: updateError } = await admin
        .from('djp_submission_queue')
        .update({
          operator_id: targetOperatorId,
          assigned_at: now,
          updated_at: now,
        })
        .eq('id', item.id);

      if (!updateError) {
        operatorLoad[targetOperatorId] = (operatorLoad[targetOperatorId] || 0) + 1;
        assignedCount++;
      } else {
        targetOperatorId = null;
        method = 'error';
        overflowCount++;
      }
    } else {
      overflowCount++;
    }

    details.push({
      queueItemId: item.id,
      operatorId: targetOperatorId,
      method,
    });
  }

  return NextResponse.json({
    success: true,
    data: { customersAssigned, customerResults, assigned: assignedCount, overflow: overflowCount, details },
  });
}
