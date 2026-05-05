import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

async function getSupervisor() {
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
  if (!role || !SUPERVISOR_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) };
  }
  return { admin, user };
}

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED',
];

/**
 * GET /api/operator/team/bulk-transfer?mode=operator|supervisor&fromId=...
 *   Preview the transfer — counts of active cases that would move plus the
 *   list of customers tied to the leaving party. Does not mutate.
 *
 * POST /api/operator/team/bulk-transfer
 *   body: {
 *     mode: 'operator' | 'supervisor',
 *     fromId: string,        // tax_operators.id of the leaving member
 *     toId: string,          // tax_operators.id of the replacement
 *     reason?: string,
 *   }
 *   - operator mode: re-points djp_submission_queue.operator_id from→to for
 *     ACTIVE statuses only, sets reassignment metadata, then marks the leaving
 *     operator inactive (status='inactive', work_state='resigned',
 *     auto_assign_enabled=false).
 *   - supervisor mode: re-points djp_submission_queue.supervisor_id from→to,
 *     same inactive marking. Operators that the leaving supervisor managed
 *     are re-pointed in supervisor_operator_assignment too.
 */
export async function GET(req: NextRequest) {
  const auth = await getSupervisor();
  if ('error' in auth) return auth.error;
  const { admin } = auth;
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');
  const fromId = url.searchParams.get('fromId');
  if (!mode || !fromId) return NextResponse.json({ error: 'mode & fromId required' }, { status: 400 });

  if (mode === 'operator') {
    const { count: activeCount } = await admin
      .from('djp_submission_queue')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', fromId)
      .in('status', ACTIVE_STATUSES);
    const { data: customers } = await admin
      .from('djp_submission_queue')
      .select('customer_id')
      .eq('operator_id', fromId);
    const customerIds = Array.from(new Set((customers ?? []).map(c => c.customer_id)));
    return NextResponse.json({ success: true, data: { activeCount: activeCount ?? 0, customerCount: customerIds.length } });
  }

  if (mode === 'supervisor') {
    const { count: activeCount } = await admin
      .from('djp_submission_queue')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_id', fromId)
      .in('status', ACTIVE_STATUSES);
    const { count: completedCount } = await admin
      .from('djp_submission_queue')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_id', fromId)
      .eq('status', 'COMPLETED');
    const { count: managedOps } = await admin
      .from('supervisor_operator_assignment')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_id', fromId)
      .eq('is_active', true);
    return NextResponse.json({ success: true, data: { activeCount: activeCount ?? 0, completedCount: completedCount ?? 0, managedOperatorCount: managedOps ?? 0 } });
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await getSupervisor();
  if ('error' in auth) return auth.error;
  const { admin, user } = auth;

  const body = await req.json().catch(() => ({}));
  const { mode, fromId, toId, reason } = body as { mode?: string; fromId?: string; toId?: string; reason?: string };
  if (!mode || !fromId || !toId) return NextResponse.json({ error: 'mode, fromId, toId required' }, { status: 400 });
  if (fromId === toId) return NextResponse.json({ error: 'fromId and toId must differ' }, { status: 400 });

  const note = reason || `Bulk transfer (${mode}) on resignation`;
  const ts = new Date().toISOString();

  if (mode === 'operator') {
    const { data: moved, error } = await admin
      .from('djp_submission_queue')
      .update({
        operator_id: toId,
        reassigned_from: fromId,
        reassigned_at: ts,
        reassigned_by: user.id,
        reassignment_reason: note,
      })
      .eq('operator_id', fromId)
      .in('status', ACTIVE_STATUSES)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('tax_operators').update({
      status: 'inactive',
      work_state: 'resigned',
      auto_assign_enabled: false,
    }).eq('id', fromId);

    // Re-point the supervisor_operator_assignment row so the resigned operator
    // no longer counts against any supervisor's load.
    await admin.from('supervisor_operator_assignment').update({ is_active: false }).eq('operator_id', fromId);

    return NextResponse.json({ success: true, data: { transferred: moved?.length ?? 0 } });
  }

  if (mode === 'supervisor') {
    const { data: moved, error } = await admin
      .from('djp_submission_queue')
      .update({
        supervisor_id: toId,
        // Don't write reassigned_* fields — those track operator-level changes.
      })
      .eq('supervisor_id', fromId)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Re-home managed operators to the new supervisor.
    await admin
      .from('supervisor_operator_assignment')
      .update({ supervisor_id: toId })
      .eq('supervisor_id', fromId)
      .eq('is_active', true);

    await admin.from('tax_operators').update({
      status: 'inactive',
      work_state: 'resigned',
      auto_assign_enabled: false,
    }).eq('id', fromId);

    return NextResponse.json({ success: true, data: { transferred: moved?.length ?? 0 } });
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}
