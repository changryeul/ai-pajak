import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

async function getSupervisorUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: roleData } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role;
  if (!SUPERVISOR_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * POST /api/operator/auto-assign
 *
 * Auto-assign unassigned PENDING queue items to operators.
 * Algorithm:
 * 1. Sticky: if customer has existing operator with capacity → assign
 * 2. Round-robin: assign to operator with fewest active items
 * 3. Overflow: if all operators at capacity → leave unassigned
 */
export async function POST() {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin } = auth;

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
      data: { assigned: 0, overflow: 0, details: [] },
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
    data: { assigned: assignedCount, overflow: overflowCount, details },
  });
}
