import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

interface RouteCtx { params: Promise<{ id: string }> }

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
  return { user, role, isSupervisor: SUPERVISOR_ROLES.includes(role), admin };
}

/**
 * GET /api/operator/cases/:id
 * Returns the full case row + customer + operator/supervisor display + previous
 * cases for the same customer (used by the "Sticky Assignment" panel — i.e. the
 * preferred operator is whoever last handled this customer).
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const { data: caseRow, error } = await admin
    .from('djp_submission_queue')
    .select(`
      id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount,
      status, priority, operator_id, supervisor_id, due_date, service_label,
      assigned_at, created_at, updated_at, notes, review_summary
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ids = [caseRow.operator_id, caseRow.supervisor_id].filter(Boolean) as string[];
  const opMap = new Map<string, { employee_id: string; name: string }>();
  if (ids.length > 0) {
    const { data: ops } = await admin.from('tax_operators').select('id, employee_id, name').in('id', ids);
    for (const o of ops ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }

  const { data: customerRow } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp, customer_type')
    .eq('id', caseRow.customer_id)
    .maybeSingle();

  // Past cases for the same customer — drives the "우선지원 / Sticky Assignment"
  // recommendation: the most-recent operator who already handled this customer
  // is the preferred candidate.
  const { data: pastRaw } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, status, operator_id, created_at')
    .eq('customer_id', caseRow.customer_id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(20);
  const pastOpIds = Array.from(new Set((pastRaw ?? []).map(p => p.operator_id).filter(Boolean) as string[]));
  if (pastOpIds.length > 0 && opMap.size === 0) {
    const { data: ops2 } = await admin.from('tax_operators').select('id, employee_id, name').in('id', pastOpIds);
    for (const o of ops2 ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }
  const pastCases = (pastRaw ?? []).map(p => ({ ...p, operator: p.operator_id ? opMap.get(p.operator_id) ?? null : null }));
  const preferredOperatorId = pastCases.find(p => p.operator_id)?.operator_id ?? null;

  return NextResponse.json({
    success: true,
    data: {
      ...caseRow,
      customer: customerRow ?? null,
      operator: caseRow.operator_id ? opMap.get(caseRow.operator_id) ?? null : null,
      supervisor: caseRow.supervisor_id ? opMap.get(caseRow.supervisor_id) ?? null : null,
      pastCases,
      preferredOperatorId,
    },
  });
}

/**
 * PUT /api/operator/cases/:id
 *
 * Body actions (Supervisor only):
 *   { action: 'assign',           operatorId: <uuid> }  — manual assignment
 *   { action: 'auto-assign' }                            — pick best operator (state + load)
 *   { action: 'assign-preferred' }                       — pick the customer's previous operator
 *   { action: 'recall' }                                 — clear operator_id, status='PENDING'
 *   { action: 'transfer-supervisor', supervisorId: <uuid> }
 *   { action: 'instruct',          note: string }         — append supervisor instruction to notes
 */
export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin, isSupervisor, user } = auth;
  if (!isSupervisor) return NextResponse.json({ error: 'Supervisor access required' }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  // reassigned_by FK targets auth.users — pass the auth user id directly.
  const actorId = user.id;

  const { data: caseRow, error: caseErr } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, supervisor_id, customer_id, status')
    .eq('id', id)
    .maybeSingle();
  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 500 });
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  switch (action) {
    case 'assign': {
      const operatorId = body.operatorId as string | undefined;
      if (!operatorId) return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
      const { error } = await admin.from('djp_submission_queue').update({
        operator_id: operatorId,
        assigned_at: new Date().toISOString(),
        reassigned_from: caseRow.operator_id !== operatorId ? caseRow.operator_id : null,
        reassigned_at: caseRow.operator_id !== operatorId ? new Date().toISOString() : null,
        reassigned_by: actorId,
        status: caseRow.status === 'PENDING' ? 'DATA_REVIEW' : caseRow.status,
      }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'assign-preferred': {
      const { data: past } = await admin
        .from('djp_submission_queue')
        .select('operator_id, created_at')
        .eq('customer_id', caseRow.customer_id)
        .neq('id', id)
        .not('operator_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!past?.operator_id) return NextResponse.json({ error: 'No preferred operator found' }, { status: 400 });
      const { error } = await admin.from('djp_submission_queue').update({
        operator_id: past.operator_id,
        assigned_at: new Date().toISOString(),
        reassigned_from: caseRow.operator_id,
        reassigned_at: caseRow.operator_id ? new Date().toISOString() : null,
        reassigned_by: actorId,
        reassignment_reason: 'preferred (sticky assignment)',
        status: caseRow.status === 'PENDING' ? 'DATA_REVIEW' : caseRow.status,
      }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { operatorId: past.operator_id } });
    }

    case 'auto-assign': {
      // Score = (auto_assign_enabled, work_state ranking, current load).
      // Pick the operator with the lowest active queue size + state in the
      // "ready" set + auto_assign_enabled = true.
      const READY = ['available', 'reviewing', 'consulting'];
      const { data: ops } = await admin
        .from('tax_operators')
        .select('id, work_state, auto_assign_enabled, max_clients')
        .eq('role', 'tax_operator')
        .eq('status', 'active')
        .eq('auto_assign_enabled', true)
        .in('work_state', READY);
      const candidates = ops ?? [];
      if (candidates.length === 0) {
        return NextResponse.json({ error: 'No eligible operator' }, { status: 400 });
      }
      // Per-candidate active load (PENDING/DATA_REVIEW/PENDING_APPROVAL etc except COMPLETED/FAILED)
      const { data: queue } = await admin
        .from('djp_submission_queue')
        .select('operator_id, status')
        .in('operator_id', candidates.map(c => c.id))
        .not('status', 'in', '("COMPLETED","FAILED")');
      const load = new Map<string, number>();
      for (const r of queue ?? []) {
        if (!r.operator_id) continue;
        load.set(r.operator_id, (load.get(r.operator_id) ?? 0) + 1);
      }
      const ranked = candidates
        .map(c => ({ id: c.id, load: load.get(c.id) ?? 0, max: c.max_clients ?? 35 }))
        .sort((a, b) => a.load - b.load);
      const pick = ranked[0];
      const { error } = await admin.from('djp_submission_queue').update({
        operator_id: pick.id,
        assigned_at: new Date().toISOString(),
        reassigned_from: caseRow.operator_id,
        reassigned_at: caseRow.operator_id ? new Date().toISOString() : null,
        reassigned_by: actorId,
        reassignment_reason: 'auto-assign (lowest load)',
        status: caseRow.status === 'PENDING' ? 'DATA_REVIEW' : caseRow.status,
      }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: { operatorId: pick.id, load: pick.load } });
    }

    case 'recall': {
      const reason = (body.reason as string | undefined) || 'recalled by supervisor';
      const { error } = await admin.from('djp_submission_queue').update({
        operator_id: null,
        reassigned_from: caseRow.operator_id,
        reassigned_at: new Date().toISOString(),
        reassigned_by: actorId,
        reassignment_reason: reason,
        status: 'PENDING',
      }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'transfer-supervisor': {
      const supervisorId = body.supervisorId as string | undefined;
      if (!supervisorId) return NextResponse.json({ error: 'supervisorId required' }, { status: 400 });
      const { error } = await admin.from('djp_submission_queue').update({
        supervisor_id: supervisorId,
      }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'instruct': {
      const note = (body.note as string | undefined)?.trim();
      if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });
      const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const { data: cur } = await admin.from('djp_submission_queue').select('notes').eq('id', id).maybeSingle();
      const newNotes = `${cur?.notes ? cur.notes + '\n' : ''}[${ts}] [SV-Instruction] ${note}`;
      const { error } = await admin.from('djp_submission_queue').update({ notes: newNotes }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
