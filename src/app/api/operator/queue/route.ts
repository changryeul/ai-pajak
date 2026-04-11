import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateAutoApproval } from '@/lib/ai/auto-approval-engine';
import { notifyWorkflowStatusChange } from '@/lib/notifications/operator-workflow-notifications';
import { submitQueueItemToDJP } from '@/lib/djp/operator-djp-submit';
import { loggers } from '@/lib/logger';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR'];

type QueueStatus =
  | 'PENDING'
  | 'DATA_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EBILLING_GENERATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_UPLOADED'
  | 'PAYMENT_VERIFIED'
  | 'DJP_SUBMITTED'
  | 'BPE_UPLOADED'
  | 'COMPLETED'
  | 'FAILED';

const STATUS_TRANSITIONS: Record<string, { from: QueueStatus | QueueStatus[] | 'any'; to: QueueStatus }> = {
  'review':            { from: 'PENDING',            to: 'DATA_REVIEW' },
  'request-approval':  { from: 'DATA_REVIEW',        to: 'PENDING_APPROVAL' },
  'approve':           { from: 'PENDING_APPROVAL',   to: 'APPROVED' },
  'reject':            { from: 'PENDING_APPROVAL',   to: 'DATA_REVIEW' },
  'generate-ebilling': { from: 'APPROVED',           to: 'EBILLING_GENERATED' },
  'notify-customer':   { from: 'EBILLING_GENERATED', to: 'PAYMENT_PENDING' },
  'verify-payment':    { from: 'PAYMENT_UPLOADED',   to: 'PAYMENT_VERIFIED' },
  'submit-djp':        { from: 'PAYMENT_VERIFIED',   to: 'DJP_SUBMITTED' },
  'upload-bpe':        { from: 'DJP_SUBMITTED',      to: 'BPE_UPLOADED' },
  'complete':          { from: 'BPE_UPLOADED',        to: 'COMPLETED' },
  'fail':              { from: 'any',                 to: 'FAILED' },
};

const SUPERVISOR_ACTIONS = ['approve', 'reject', 'reassign'];

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
 * GET /api/operator/queue
 *
 * List queue items for the operator, filtered by status and period.
 * Supervisors can see all items; operators see only their own.
 */
export async function GET(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, role, admin } = auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const taxType = searchParams.get('taxType');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = (page - 1) * limit;

  // Get operator tax_operators.id for non-supervisors
  let operatorProfileId: string | null = null;
  if (!SUPERVISOR_ROLES.includes(role)) {
    const { data: opProfile } = await admin
      .from('tax_operators')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();
    operatorProfileId = opProfile?.id || null;
  }

  let query = admin
    .from('operator_submission_queue')
    .select(`
      id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status,
      ebilling_code, bpe_number, bpe_date, notes, failed_reason,
      approved_by, approved_at, approval_notes, rejected_reason, review_summary,
      payment_proof_url, payment_amount, payment_date, payment_verified_by, payment_verified_at,
      created_at, updated_at, operator_id
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Supervisors see all items; operators see only their own
  if (operatorProfileId) {
    query = query.eq('operator_id', operatorProfileId);
  }

  if (status) query = query.eq('status', status);
  if (taxType) query = query.eq('tax_type', taxType);
  if (year) query = query.eq('tax_period_year', parseInt(year, 10));
  if (month) query = query.eq('tax_period_month', parseInt(month, 10));

  const { data: rawItems, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with customer data
  const customerIds = [...new Set((rawItems || []).map(i => i.customer_id).filter(Boolean))];
  let customerMap: Record<string, { id: string; customer_name: string; npwp: string; customer_type: string }> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await admin.from('customer').select('id, customer_name, npwp, customer_type').in('id', customerIds);
    for (const c of customers || []) customerMap[c.id] = c;
  }

  const items = (rawItems || []).map(item => ({
    ...item,
    customer: customerMap[item.customer_id] || null,
  }));

  return NextResponse.json({
    success: true,
    data: {
      items,
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
 * - action: review | request-approval | approve | reject | generate-ebilling |
 *           notify-customer | verify-payment | submit-djp | upload-bpe | complete | fail
 * - ebillingCode: required for generate-ebilling
 * - bpeNumber: required for upload-bpe
 * - bpeDate: required for upload-bpe
 * - notes: optional notes
 * - approvalNotes: optional for approve
 * - rejectedReason: required for reject
 * - failedReason: optional for fail action
 */
export async function PUT(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, role, admin } = auth;

  const body = await request.json();
  const {
    id, action, ebillingCode, bpeNumber, bpeDate,
    notes, approvalNotes, rejectedReason, failedReason,
    targetOperatorId, reassignmentReason,
  } = body;

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

  // Supervisor-only actions
  if (SUPERVISOR_ACTIONS.includes(action) && !SUPERVISOR_ROLES.includes(role)) {
    return NextResponse.json(
      { error: 'This action requires supervisor privileges' },
      { status: 403 }
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
  if (action === 'reject' && !rejectedReason) {
    return NextResponse.json(
      { error: 'rejectedReason is required for reject action' },
      { status: 400 }
    );
  }

  // Get current queue item
  const { data: item, error: fetchError } = await admin
    .from('operator_submission_queue')
    .select('id, status, operator_id, customer_id, tax_type, tax_period_month, tax_period_year, amount')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json(
      { error: 'Queue item not found' },
      { status: 404 }
    );
  }

  // Access control:
  // - Supervisors (LEAD/SUPERVISOR) can act on any queue item, regardless
  //   of whether it is assigned to a specific operator.
  // - Regular operators can only act on items they are assigned to.
  //
  // BUG FIX: the previous version compared `item.operator_id` (a
  // tax_operators.id FK) directly to `user.id` (auth.users.id) — two
  // different tables, so the check was always true and **every** non-
  // supervisor action was rejected. Resolve via the tax_operators row.
  if (!SUPERVISOR_ROLES.includes(role)) {
    const { data: opProfile } = await admin
      .from('tax_operators')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!opProfile || item.operator_id !== opProfile.id) {
      return NextResponse.json(
        { error: 'You are not assigned to this queue item' },
        { status: 403 }
      );
    }
  }

  // Handle reassignment (special action — no status change)
  if (action === 'reassign') {
    if (!targetOperatorId || !reassignmentReason) {
      return NextResponse.json(
        { error: 'targetOperatorId and reassignmentReason are required for reassign' },
        { status: 400 }
      );
    }

    // Validate target operator exists and is active
    const { data: targetOp } = await admin
      .from('tax_operators')
      .select('id, name, max_clients, status')
      .eq('id', targetOperatorId)
      .single();

    if (!targetOp || targetOp.status !== 'active') {
      return NextResponse.json({ error: 'Target operator not found or inactive' }, { status: 400 });
    }

    // Check target operator capacity
    const { count: activeCount } = await admin
      .from('djp_submission_queue')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', targetOperatorId)
      .not('status', 'in', '("COMPLETED","FAILED")');

    if ((activeCount || 0) >= targetOp.max_clients) {
      return NextResponse.json({ error: 'Target operator is at full capacity' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Record reassignment history
    await admin.from('queue_reassignment_history').insert({
      queue_item_id: id,
      from_operator_id: item.operator_id,
      to_operator_id: targetOperatorId,
      reassigned_by: user!.id,
      reason: reassignmentReason,
      status_at_reassignment: item.status,
    });

    // Update queue item
    const { data: updated, error: updateError } = await admin
      .from('djp_submission_queue')
      .update({
        operator_id: targetOperatorId,
        reassigned_from: item.operator_id,
        reassignment_reason: reassignmentReason,
        reassigned_at: now,
        reassigned_by: user!.id,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit log
    await admin.from('audit_log').insert({
      user_id: user!.id,
      action: 'OPERATOR_QUEUE_REASSIGN',
      resource_type: 'operator_submission_queue',
      resource_id: id,
      details: {
        fromOperatorId: item.operator_id,
        toOperatorId: targetOperatorId,
        reason: reassignmentReason,
        status: item.status,
      },
      created_at: now,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Reassigned to operator ${targetOp.name}`,
    });
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
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: transition.to,
    updated_at: now,
    updated_by: user!.id,
  };

  // Action-specific fields
  if (action === 'approve') {
    updatePayload.approved_by = user!.id;
    updatePayload.approved_at = now;
    updatePayload.approval_notes = approvalNotes || null;
    updatePayload.rejected_reason = null; // Clear previous rejection
  }
  if (action === 'reject') {
    updatePayload.rejected_reason = rejectedReason;
    updatePayload.approved_by = null;
    updatePayload.approved_at = null;
    updatePayload.approval_notes = null;
  }
  if (action === 'verify-payment') {
    updatePayload.payment_verified_by = user!.id;
    updatePayload.payment_verified_at = now;
  }

  // DJP submission: queue E_FILING job
  if (action === 'submit-djp') {
    const djpResult = await submitQueueItemToDJP(admin, {
      id,
      customer_id: item.customer_id,
      tax_type: item.tax_type,
      tax_period_month: item.tax_period_month,
      tax_period_year: item.tax_period_year,
      amount: item.amount || 0,
      operator_id: item.operator_id,
    }, user!.id);

    if (!djpResult.success) {
      return NextResponse.json(
        { error: `DJP submission failed: ${djpResult.error}` },
        { status: 500 }
      );
    }

    updatePayload.djp_job_id = djpResult.jobId;
    updatePayload.tax_filing_id = djpResult.taxFilingId;
    updatePayload.submitted_to_djp_at = now;
  }

  if (ebillingCode) updatePayload.ebilling_code = ebillingCode;
  if (bpeNumber) updatePayload.bpe_number = bpeNumber;
  if (bpeDate) updatePayload.bpe_date = bpeDate;
  if (notes) updatePayload.notes = notes;
  if (failedReason) updatePayload.failed_reason = failedReason;

  // Completion timestamp
  if (transition.to === 'COMPLETED' || transition.to === 'FAILED') {
    updatePayload.completed_at = now;
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

  // Auto-Approval: when transitioning to PENDING_APPROVAL, evaluate
  let autoApprovalResult = null;
  if (action === 'request-approval' && transition.to === 'PENDING_APPROVAL') {
    try {
      autoApprovalResult = await evaluateAutoApproval(admin, {
        queueItemId: id,
        customerId: item.customer_id,
        taxType: item.tax_type,
        taxYear: item.tax_period_year,
        taxPeriodMonth: item.tax_period_month,
        amount: item.amount || 0,
      });

      // Save review_summary and auto-approval details regardless of result
      const autoUpdatePayload: Record<string, unknown> = {
        review_summary: autoApprovalResult.reviewSummary,
        auto_approval_score: autoApprovalResult.combinedScore,
        auto_approval_details: {
          scores: autoApprovalResult.scores,
          checks: autoApprovalResult.checks,
          reasons: autoApprovalResult.reasons,
        },
      };

      if (autoApprovalResult.approved) {
        // Auto-approve: skip PENDING_APPROVAL, go straight to APPROVED
        autoUpdatePayload.status = 'APPROVED';
        autoUpdatePayload.auto_approved = true;
        autoUpdatePayload.approved_by = user!.id; // system acting on behalf
        autoUpdatePayload.approved_at = new Date().toISOString();
        autoUpdatePayload.approval_notes = 'Auto-approved by system (all thresholds met)';
      }

      await admin
        .from('djp_submission_queue')
        .update(autoUpdatePayload)
        .eq('id', id);
    } catch (err) {
      // Auto-approval failure should not block the normal flow
      loggers.api.error({ err }, 'Auto-approval evaluation failed');
    }
  }

  // Audit log
  await admin.from('audit_log').insert({
    user_id: user!.id,
    action: `OPERATOR_QUEUE_${action.toUpperCase().replace(/-/g, '_')}`,
    resource_type: 'operator_submission_queue',
    resource_id: id,
    details: {
      previousStatus: item.status,
      newStatus: autoApprovalResult?.approved ? 'APPROVED' : transition.to,
      notes,
      autoApproval: autoApprovalResult ? {
        approved: autoApprovalResult.approved,
        combinedScore: autoApprovalResult.combinedScore,
      } : undefined,
    },
    created_at: now,
  });

  // Send notifications (non-blocking)
  const finalStatus = autoApprovalResult?.approved ? 'APPROVED' : transition.to;

  notifyWorkflowStatusChange(admin, {
    queueItem: {
      id,
      customer_id: item.customer_id,
      operator_id: item.operator_id,
      tax_type: item.tax_type,
      tax_period_month: item.tax_period_month,
      tax_period_year: item.tax_period_year,
      amount: item.amount || 0,
      ebilling_code: updated?.ebilling_code,
      bpe_number: updated?.bpe_number,
    },
    previousStatus: item.status,
    newStatus: finalStatus,
    action,
    actorUserId: user!.id,
    autoApproved: autoApprovalResult?.approved,
  }).catch(err => loggers.api.error({ err }, 'Queue notification failed'));

  return NextResponse.json({
    success: true,
    data: { ...updated, status: finalStatus },
    message: autoApprovalResult?.approved
      ? `Auto-approved (score: ${autoApprovalResult.combinedScore})`
      : `Status updated to ${finalStatus}`,
    autoApproval: autoApprovalResult ? {
      approved: autoApprovalResult.approved,
      combinedScore: autoApprovalResult.combinedScore,
      reasons: autoApprovalResult.reasons,
    } : undefined,
  });
}
