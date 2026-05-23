import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

async function getOperatorUser() {
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
  if (!role) {
    return { error: NextResponse.json({ error: 'Operator access required' }, { status: 403 }) };
  }

  return { user, role, admin };
}

/**
 * GET /api/operator/complaints
 *
 * List complaints. Supervisors see all, operators see own.
 * Query params: status, operatorId, priority, page, limit
 */
export async function GET(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, role, admin } = auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const operatorId = url.searchParams.get('operatorId');
  const priority = url.searchParams.get('priority');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = admin
    .from('customer_complaints')
    .select('*', { count: 'exact' });

  // Access control: operators see only their own complaints
  if (!SUPERVISOR_ROLES.includes(role)) {
    const { data: opData } = await admin
      .from('tax_operators')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (opData) {
      query = query.eq('operator_id', opData.id);
    }
  }

  if (status) query = query.eq('status', status);
  if (operatorId) query = query.eq('operator_id', operatorId);
  if (priority) query = query.eq('priority', priority);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: complaintsRaw, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
  }

  // Enrich with customer and operator names
  const custIds = [...new Set((complaintsRaw || []).map(c => c.customer_id).filter(Boolean))];
  const opIds = [...new Set((complaintsRaw || []).map(c => c.operator_id).filter(Boolean))];

  const custMap: Record<string, { id: string; customer_name: string; npwp: string }> = {};
  const opMap: Record<string, { id: string; name: string; employee_id: string }> = {};

  if (custIds.length > 0) {
    const { data: custs } = await admin.from('customer').select('id, customer_name, npwp').in('id', custIds);
    for (const c of custs || []) custMap[c.id] = c;
  }
  if (opIds.length > 0) {
    const { data: ops } = await admin.from('tax_operators').select('id, name, employee_id').in('id', opIds);
    for (const o of ops || []) opMap[o.id] = o;
  }

  const complaints = (complaintsRaw || []).map(c => ({
    ...c,
    customer: custMap[c.customer_id] || null,
    operator: opMap[c.operator_id] || null,
  }));

  // Summary counts
  const { data: statusCounts } = await admin
    .from('customer_complaints')
    .select('status');

  const summary = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const c of statusCounts || []) {
    if (c.status === 'OPEN') summary.open++;
    else if (c.status === 'IN_PROGRESS') summary.in_progress++;
    else if (c.status === 'RESOLVED') summary.resolved++;
    else if (c.status === 'CLOSED') summary.closed++;
  }

  return NextResponse.json({
    success: true,
    data: {
      items: complaints || [],
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    },
  });
}

/**
 * POST /api/operator/complaints
 *
 * Actions: create, update-status, resolve
 * Supervisor/Lead only for create and status changes.
 */
export async function POST(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, role, admin } = auth;

  const body = await request.json();
  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  // Only supervisors can create and manage complaints
  if (!SUPERVISOR_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Supervisor access required' }, { status: 403 });
  }

  if (action === 'create') {
    const { customerId, operatorId, queueItemId, complaintType, subject, description, priority } = body;

    if (!customerId || !complaintType || !subject || !description) {
      return NextResponse.json({
        error: 'customerId, complaintType, subject, description are required',
      }, { status: 400 });
    }

    const validTypes = ['delay', 'error', 'communication', 'other'];
    if (!validTypes.includes(complaintType)) {
      return NextResponse.json({ error: `Invalid complaintType. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await admin
      .from('customer_complaints')
      .insert({
        customer_id: customerId,
        operator_id: operatorId || null,
        queue_item_id: queueItemId || null,
        complaint_type: complaintType,
        subject,
        description,
        priority: priority || 'medium',
        status: 'OPEN',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  }

  if (action === 'update-status') {
    const { complaintId, status: newStatus } = body;

    if (!complaintId || !newStatus) {
      return NextResponse.json({ error: 'complaintId and status are required' }, { status: 400 });
    }

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      updatePayload.resolved_by = user!.id;
      updatePayload.resolved_at = new Date().toISOString();
      if (body.resolutionNotes) {
        updatePayload.resolution_notes = body.resolutionNotes;
      }
    }

    const { data, error } = await admin
      .from('customer_complaints')
      .update(updatePayload)
      .eq('id', complaintId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
