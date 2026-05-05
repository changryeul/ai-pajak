import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

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

  const isSupervisor = SUPERVISOR_ROLES.includes(role);
  return { user, role, isSupervisor, admin };
}

/**
 * GET /api/operator/cases
 *   ?scope=mine | unassigned | all              — default: 'all' (supervisor) / 'mine' (operator)
 *   ?supervisorId=...                           — filter by supervisor (supervisor only)
 *   ?status=...                                 — comma-separated status filter
 *   ?priority=URGENT|HIGH|NORMAL|LOW
 *   ?customerId=...
 *
 * Returns case rows + joined customer + operator/supervisor display names.
 */
export async function GET(req: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin, isSupervisor, user } = auth;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') || (isSupervisor ? 'all' : 'mine');
  const statusFilter = (url.searchParams.get('status') || '').split(',').filter(Boolean);
  const priorityFilter = url.searchParams.get('priority');
  const supervisorIdFilter = url.searchParams.get('supervisorId');
  const customerIdFilter = url.searchParams.get('customerId');

  // Resolve current operator row id (if the user is in tax_operators).
  const { data: meRow } = await admin
    .from('tax_operators')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  const myOperatorId = meRow?.id ?? null;

  let q = admin.from('djp_submission_queue').select(`
    id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount,
    status, priority, operator_id, supervisor_id, due_date, service_label,
    assigned_at, created_at, updated_at, notes
  `).order('created_at', { ascending: false }).limit(500);

  if (scope === 'mine' && myOperatorId) {
    if (isSupervisor) q = q.eq('supervisor_id', myOperatorId);
    else q = q.eq('operator_id', myOperatorId);
  } else if (scope === 'unassigned') {
    q = q.is('operator_id', null);
  }
  if (statusFilter.length) q = q.in('status', statusFilter);
  if (priorityFilter) q = q.eq('priority', priorityFilter);
  if (supervisorIdFilter) q = q.eq('supervisor_id', supervisorIdFilter);
  if (customerIdFilter) q = q.eq('customer_id', customerIdFilter);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hydrate operator + supervisor + customer in separate round-trips because
  // there's no PostgREST FK relation declared for these joins in some envs.
  const items = data ?? [];
  const opIds = Array.from(new Set(items.map(i => i.operator_id).filter(Boolean) as string[]));
  const svIds = Array.from(new Set(items.map(i => i.supervisor_id).filter(Boolean) as string[]));
  const custIds = Array.from(new Set(items.map(i => i.customer_id).filter(Boolean) as string[]));
  const allOperatorIds = Array.from(new Set([...opIds, ...svIds]));
  const opMap = new Map<string, { employee_id: string; name: string }>();
  if (allOperatorIds.length > 0) {
    const { data: ops } = await admin
      .from('tax_operators')
      .select('id, employee_id, name')
      .in('id', allOperatorIds);
    for (const o of ops ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }
  const custMap = new Map<string, { id: string; full_name: string; company_name: string | null; npwp: string | null; customer_type: string }>();
  if (custIds.length > 0) {
    const { data: cs } = await admin
      .from('customer')
      .select('id, full_name, company_name, npwp, customer_type')
      .in('id', custIds);
    for (const c of cs ?? []) custMap.set(c.id, c);
  }

  const enriched = items.map(i => ({
    ...i,
    customer: custMap.get(i.customer_id) ?? null,
    operator: i.operator_id ? opMap.get(i.operator_id) ?? null : null,
    supervisor: i.supervisor_id ? opMap.get(i.supervisor_id) ?? null : null,
  }));

  return NextResponse.json({ success: true, data: { items: enriched } });
}
