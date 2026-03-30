import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];
const LEAD_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

async function getOperatorUser() {
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
  const isOperator = OPERATOR_ROLES.includes(role);
  if (!isOperator) {
    return { error: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * GET /api/operator
 *
 * Returns operator dashboard data:
 * - Assigned clients with data status
 * - Submission queue items
 * - Performance stats
 * - Summary counts
 */
export async function GET() {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get assigned clients
  const { data: assignments } = await admin
    .from('operator_assignments')
    .select(`
      id,
      customer_id,
      assigned_at,
      customer:customer_id (
        id,
        customer_name,
        npwp,
        customer_type,
        is_active
      )
    `)
    .eq('operator_id', user!.id)
    .eq('is_active', true);

  // Get submission queue items for this operator
  const { data: queueItems } = await admin
    .from('operator_submission_queue')
    .select(`
      id,
      customer_id,
      tax_type,
      tax_period,
      tax_year,
      amount,
      status,
      ebilling_code,
      bpe_number,
      bpe_date,
      notes,
      created_at,
      updated_at,
      customer:customer_id (
        id,
        customer_name,
        npwp
      )
    `)
    .eq('operator_id', user!.id)
    .order('created_at', { ascending: false });

  // Performance stats this month
  const { data: completedThisMonth } = await admin
    .from('operator_submission_queue')
    .select('id')
    .eq('operator_id', user!.id)
    .eq('status', 'COMPLETED')
    .gte('updated_at', monthStart);

  const { data: failedThisMonth } = await admin
    .from('operator_submission_queue')
    .select('id')
    .eq('operator_id', user!.id)
    .eq('status', 'FAILED')
    .gte('updated_at', monthStart);

  // Summary counts
  const totalAssigned = assignments?.length || 0;
  const pending = queueItems?.filter(q => q.status === 'PENDING').length || 0;
  const inProgress = queueItems?.filter(q =>
    !['PENDING', 'COMPLETED', 'FAILED'].includes(q.status)
  ).length || 0;
  const completed = completedThisMonth?.length || 0;
  const failed = failedThisMonth?.length || 0;

  return NextResponse.json({
    success: true,
    data: {
      assignments: assignments || [],
      queueItems: queueItems || [],
      stats: {
        totalAssigned,
        pending,
        inProgress,
        completedThisMonth: completed,
        failedThisMonth: failed,
      },
      summary: {
        totalAssigned,
        pending,
        inProgress,
        completed,
      },
    },
  });
}

/**
 * POST /api/operator
 *
 * Actions:
 * - assign-client: Assign a customer to an operator (lead/supervisor only)
 * - unassign-client: Remove assignment (lead/supervisor only)
 */
export async function POST(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, role, admin } = auth;

  const body = await request.json();
  const { action } = body;

  // Only leads/supervisors can assign/unassign
  if (['assign-client', 'unassign-client'].includes(action) && !LEAD_ROLES.includes(role!)) {
    return NextResponse.json(
      { error: 'Only leads and supervisors can manage assignments' },
      { status: 403 }
    );
  }

  switch (action) {
    case 'assign-client': {
      const { customerId, operatorId } = body;
      if (!customerId || !operatorId) {
        return NextResponse.json(
          { error: 'customerId and operatorId are required' },
          { status: 400 }
        );
      }

      // Verify target operator exists and has operator role
      const { data: targetRole } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', operatorId)
        .single();

      if (!targetRole || !OPERATOR_ROLES.includes(targetRole.role)) {
        return NextResponse.json(
          { error: 'Target user is not an operator' },
          { status: 400 }
        );
      }

      // Check if already assigned
      const { data: existing } = await admin
        .from('operator_assignments')
        .select('id')
        .eq('customer_id', customerId)
        .eq('operator_id', operatorId)
        .eq('is_active', true)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Customer is already assigned to this operator' },
          { status: 409 }
        );
      }

      const { data: assignment, error } = await admin
        .from('operator_assignments')
        .insert({
          customer_id: customerId,
          operator_id: operatorId,
          assigned_by: user!.id,
          assigned_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: assignment });
    }

    case 'unassign-client': {
      const { assignmentId } = body;
      if (!assignmentId) {
        return NextResponse.json(
          { error: 'assignmentId is required' },
          { status: 400 }
        );
      }

      const { error } = await admin
        .from('operator_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Client unassigned' });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
