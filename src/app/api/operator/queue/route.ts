import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

type QueueStatus =
  | 'PENDING'
  | 'DATA_REVIEW'
  | 'EBILLING_GENERATED'
  | 'PAYMENT_CONFIRMED'
  | 'DJP_SUBMITTED'
  | 'BPE_UPLOADED'
  | 'COMPLETED'
  | 'FAILED';

const STATUS_TRANSITIONS: Record<string, { from: QueueStatus | QueueStatus[] | 'any'; to: QueueStatus }> = {
  'review':            { from: 'PENDING',           to: 'DATA_REVIEW' },
  'generate-ebilling': { from: 'DATA_REVIEW',       to: 'EBILLING_GENERATED' },
  'confirm-payment':   { from: 'EBILLING_GENERATED', to: 'PAYMENT_CONFIRMED' },
  'submit-djp':        { from: 'PAYMENT_CONFIRMED',  to: 'DJP_SUBMITTED' },
  'upload-bpe':        { from: 'DJP_SUBMITTED',      to: 'BPE_UPLOADED' },
  'complete':          { from: 'BPE_UPLOADED',        to: 'COMPLETED' },
  'fail':              { from: 'any',                 to: 'FAILED' },
};

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
 * GET /api/operator/queue
 *
 * List queue items for the operator, filtered by status and period.
 *
 * Query params:
 * - status: filter by queue status
 * - taxType: filter by tax type
 * - year: filter by tax year
 * - month: filter by tax period (month)
 * - page: page number (default 1)
 * - limit: items per page (default 50)
 */
export async function GET(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const taxType = searchParams.get('taxType');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = (page - 1) * limit;

  let query = admin
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
      failed_reason,
      created_at,
      updated_at,
      operator_id,
      customer:customer_id (
        id,
        customer_name,
        npwp,
        customer_type
      )
    `, { count: 'exact' })
    .eq('operator_id', user!.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (taxType) {
    query = query.eq('tax_type', taxType);
  }
  if (year) {
    query = query.eq('tax_year', parseInt(year, 10));
  }
  if (month) {
    query = query.eq('tax_period', parseInt(month, 10));
  }

  const { data: items, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      items: items || [],
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
 * PUT /api/operator/queue
 *
 * Update a queue item's status with the appropriate action.
 *
 * Body:
 * - id: queue item ID
 * - action: review | generate-ebilling | confirm-payment | submit-djp | upload-bpe | complete | fail
 * - ebillingCode: required for generate-ebilling
 * - bpeNumber: required for upload-bpe
 * - bpeDate: required for upload-bpe
 * - notes: optional notes
 * - failedReason: optional for fail action
 */
export async function PUT(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json();
  const { id, action, ebillingCode, bpeNumber, bpeDate, notes, failedReason } = body;

  if (!id || !action) {
    return NextResponse.json(
      { error: 'id and action are required' },
      { status: 400 }
    );
  }

  const transition = STATUS_TRANSITIONS[action];
  if (!transition) {
    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  }

  // Validate action-specific fields
  if (action === 'generate-ebilling' && !ebillingCode) {
    return NextResponse.json(
      { error: 'ebillingCode is required for generate-ebilling action' },
      { status: 400 }
    );
  }
  if (action === 'upload-bpe' && (!bpeNumber || !bpeDate)) {
    return NextResponse.json(
      { error: 'bpeNumber and bpeDate are required for upload-bpe action' },
      { status: 400 }
    );
  }

  // Get current queue item
  const { data: item, error: fetchError } = await admin
    .from('operator_submission_queue')
    .select('id, status, operator_id')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: 'Queue item not found' },
      { status: 404 }
    );
  }

  // Verify operator owns this item
  if (item.operator_id !== user!.id) {
    return NextResponse.json(
      { error: 'You are not assigned to this queue item' },
      { status: 403 }
    );
  }

  // Validate status transition
  if (transition.from !== 'any') {
    const validFrom = Array.isArray(transition.from) ? transition.from : [transition.from];
    if (!validFrom.includes(item.status as QueueStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition. Current status is ${item.status}, but action '${action}' requires status: ${validFrom.join(' or ')}`,
        },
        { status: 400 }
      );
    }
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    status: transition.to,
    updated_at: new Date().toISOString(),
    updated_by: user!.id,
  };

  if (ebillingCode) updatePayload.ebilling_code = ebillingCode;
  if (bpeNumber) updatePayload.bpe_number = bpeNumber;
  if (bpeDate) updatePayload.bpe_date = bpeDate;
  if (notes) updatePayload.notes = notes;
  if (failedReason) updatePayload.failed_reason = failedReason;

  // For completed/failed, set completion timestamp
  if (transition.to === 'COMPLETED' || transition.to === 'FAILED') {
    updatePayload.completed_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await admin
    .from('operator_submission_queue')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log the status transition
  await admin.from('audit_log').insert({
    user_id: user!.id,
    action: `OPERATOR_QUEUE_${action.toUpperCase().replace(/-/g, '_')}`,
    resource_type: 'operator_submission_queue',
    resource_id: id,
    details: {
      previousStatus: item.status,
      newStatus: transition.to,
      notes,
    },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: `Status updated to ${transition.to}`,
  });
}
