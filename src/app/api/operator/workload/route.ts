import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

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

  const role = allRoles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role || !SUPERVISOR_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * GET /api/operator/workload
 *
 * Returns per-operator workload data and unassigned queue items.
 * Supervisor/Lead only.
 */
export async function GET() {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin } = auth;

  // 1. Get all operators
  const { data: operators, error: opError } = await admin
    .from('tax_operators')
    .select('id, user_id, employee_id, name, email, role, max_clients, status')
    .order('name');

  if (opError) {
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
  }

  // 2. Get active queue items count per operator
  const { data: queueCounts, error: qcError } = await admin
    .from('djp_submission_queue')
    .select('operator_id, status')
    .not('status', 'in', '("COMPLETED","FAILED")');

  if (qcError) {
    return NextResponse.json({ error: 'Failed to fetch queue data' }, { status: 500 });
  }

  // Build per-operator counts
  const operatorCounts: Record<string, { active: number; pending: number; inProgress: number }> = {};
  for (const item of queueCounts || []) {
    if (!item.operator_id) continue;
    if (!operatorCounts[item.operator_id]) {
      operatorCounts[item.operator_id] = { active: 0, pending: 0, inProgress: 0 };
    }
    operatorCounts[item.operator_id].active++;
    if (item.status === 'PENDING') {
      operatorCounts[item.operator_id].pending++;
    } else {
      operatorCounts[item.operator_id].inProgress++;
    }
  }

  const operatorList = (operators || []).map(op => {
    const counts = operatorCounts[op.id] || { active: 0, pending: 0, inProgress: 0 };
    return {
      ...op,
      active_items: counts.active,
      pending_items: counts.pending,
      in_progress_items: counts.inProgress,
      utilization_pct: op.max_clients > 0 ? Math.round((counts.active / op.max_clients) * 100) : 0,
    };
  });

  // 3. Get unassigned queue items
  const { data: unassigned, error: uaError } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, created_at, customer:customer_id(id, customer_name, npwp)')
    .is('operator_id', null)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  if (uaError) {
    return NextResponse.json({ error: 'Failed to fetch unassigned items' }, { status: 500 });
  }

  // 4. Summary
  const activeOperators = operatorList.filter(op => op.status === 'active');
  const totalUtilization = activeOperators.length > 0
    ? Math.round(activeOperators.reduce((sum, op) => sum + op.utilization_pct, 0) / activeOperators.length)
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      operators: operatorList,
      unassigned_items: unassigned || [],
      summary: {
        total_operators: operatorList.length,
        active_operators: activeOperators.length,
        total_unassigned: (unassigned || []).length,
        avg_utilization_pct: totalUtilization,
      },
    },
  });
}
