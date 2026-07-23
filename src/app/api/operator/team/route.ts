import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING',
];

async function getOperatorUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return { error: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  return { admin, user, role, isSupervisor: SUPERVISOR_ROLES.includes(role) };
}

/**
 * GET /api/operator/team
 *
 * Returns the full team roster the supervisor needs:
 *   - operators[]   : every tax_operator (12 of them in PDF demo) with state,
 *                      auto-assign flag, login time, current load, completed count,
 *                      and the supervisor that manages them
 *   - supervisors[] : every tax_operator_supervisor with their max_managed limit
 *                      and the operator IDs they currently manage
 *   - stateCounts   : counts grouped by work_state (대기/상담중/검토중/Coretax/휴식/오프라인/퇴사)
 *   - todayLoggedIn / autoEligibleCount / activeAssignmentCount
 */
export async function GET() {
  const auth = await getOperatorUser();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { data: ops } = await admin
    .from('tax_operators')
    .select('id, user_id, employee_id, name, email, role, status, max_clients, max_managed, work_state, auto_assign_enabled, last_login_at')
    .order('employee_id');

  const all = ops ?? [];
  const operators = all.filter(o => o.role === 'tax_operator');
  const supervisors = all.filter(o => o.role === 'tax_operator_supervisor');

  // Per-operator active load + completed count (lifetime).
  const opIds = operators.map(o => o.id);
  const loadMap = new Map<string, number>();
  const completedMap = new Map<string, number>();
  if (opIds.length > 0) {
    const { data: queue } = await admin
      .from('djp_submission_queue')
      .select('operator_id, status')
      .in('operator_id', opIds);
    for (const q of queue ?? []) {
      if (!q.operator_id) continue;
      if (ACTIVE_STATUSES.includes(q.status)) {
        loadMap.set(q.operator_id, (loadMap.get(q.operator_id) ?? 0) + 1);
      } else if (q.status === 'COMPLETED') {
        completedMap.set(q.operator_id, (completedMap.get(q.operator_id) ?? 0) + 1);
      }
    }
  }

  // Supervisor↔operator current assignment.
  const { data: assignments } = await admin
    .from('supervisor_operator_assignment')
    .select('supervisor_id, operator_id, is_active')
    .eq('is_active', true);
  const opSupervisor = new Map<string, string>(); // operator_id -> supervisor_id
  const supManaged = new Map<string, string[]>(); // supervisor_id -> operator_ids
  for (const a of assignments ?? []) {
    opSupervisor.set(a.operator_id, a.supervisor_id);
    const arr = supManaged.get(a.supervisor_id) ?? [];
    arr.push(a.operator_id);
    supManaged.set(a.supervisor_id, arr);
  }

  const operatorRows = operators.map(o => ({
    ...o,
    active_load: loadMap.get(o.id) ?? 0,
    completed_count: completedMap.get(o.id) ?? 0,
    supervisor_id: opSupervisor.get(o.id) ?? null,
  }));
  const supervisorRows = supervisors.map(s => ({
    ...s,
    managed_operator_ids: supManaged.get(s.id) ?? [],
    managed_count: (supManaged.get(s.id) ?? []).length,
  }));

  const STATE_KEYS = ['available', 'consulting', 'reviewing', 'coretax', 'break', 'offline', 'resigned'] as const;
  const stateCounts: Record<string, number> = Object.fromEntries(STATE_KEYS.map(k => [k, 0]));
  for (const o of operatorRows) {
    const k = (o.work_state || 'available') as typeof STATE_KEYS[number];
    if (k in stateCounts) stateCounts[k] += 1;
  }

  const todayLoggedIn = operatorRows.filter(o => {
    if (!o.last_login_at) return false;
    const ts = new Date(o.last_login_at).getTime();
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  }).length;
  const autoEligibleCount = operatorRows.filter(o => o.auto_assign_enabled && o.work_state === 'available').length;
  const activeAssignmentCount = operatorRows.reduce((s, o) => s + o.active_load, 0);

  return NextResponse.json({
    success: true,
    data: {
      operators: operatorRows,
      supervisors: supervisorRows,
      stateCounts,
      todayLoggedIn,
      autoEligibleCount,
      activeAssignmentCount,
    },
  });
}

/**
 * PUT /api/operator/team
 *   body: { operatorId, workState?, autoAssignEnabled?, supervisorId?, maxManaged? }
 *   Updates a single operator/supervisor row. supervisorId only applies to
 *   tax_operator rows (re-homes them in supervisor_operator_assignment).
 */
export async function PUT(req: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth) return auth.error;
  if (!auth.isSupervisor) return NextResponse.json({ error: 'Supervisor access required' }, { status: 403 });
  const { admin } = auth;
  const body = await req.json();
  const { operatorId, workState, autoAssignEnabled, supervisorId, maxManaged } = body as {
    operatorId?: string; workState?: string; autoAssignEnabled?: boolean; supervisorId?: string; maxManaged?: number;
  };
  if (!operatorId) return NextResponse.json({ error: 'operatorId required' }, { status: 400 });

  const opPatch: Record<string, unknown> = {};
  if (workState !== undefined) opPatch.work_state = workState;
  if (autoAssignEnabled !== undefined) opPatch.auto_assign_enabled = autoAssignEnabled;
  if (maxManaged !== undefined) opPatch.max_managed = maxManaged;
  if (Object.keys(opPatch).length > 0) {
    const { error } = await admin.from('tax_operators').update(opPatch).eq('id', operatorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (supervisorId !== undefined) {
    // Upsert supervisor_operator_assignment by operator_id (UNIQUE).
    const { data: existing } = await admin
      .from('supervisor_operator_assignment')
      .select('id')
      .eq('operator_id', operatorId)
      .maybeSingle();
    if (existing) {
      await admin.from('supervisor_operator_assignment').update({
        supervisor_id: supervisorId, is_active: true,
      }).eq('id', existing.id);
    } else {
      await admin.from('supervisor_operator_assignment').insert({
        supervisor_id: supervisorId, operator_id: operatorId, is_active: true,
      });
    }
  }

  return NextResponse.json({ success: true });
}
