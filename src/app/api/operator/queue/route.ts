import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateAutoApproval } from '@/lib/ai/auto-approval-engine';
import { notifyWorkflowStatusChange } from '@/lib/notifications/operator-workflow-notifications';
import { loggers } from '@/lib/logger';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

// Coretax era (2026-07): 납부 = 신고. 고객이 ID Billing 을 납부하면 NTPN 이
// Coretax 안에서 자동 생성되고 별도 신고 절차가 없다. 따라서 구방식의
// PAYMENT_UPLOADED → PAYMENT_VERIFIED → DJP_SUBMITTED → BPE_UPLOADED 4개
// 상태와 해당 operator 액션은 제거됐다. PAYMENT_PENDING(고객 전송·납부대기)이
// 당분간의 실질 종료 상태이며, COMPLETED 전이는 향후 Coretax API 연동 시
// NTPN 자동 수집이 호출하는 것을 전제로 남겨둔다 (operator UI 버튼 없음).
type QueueStatus =
  | 'PENDING'
  | 'PENDING_DOCS'
  | 'DATA_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EBILLING_GENERATED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'FAILED';

const STATUS_TRANSITIONS: Record<string, { from: QueueStatus | QueueStatus[] | 'any'; to: QueueStatus }> = {
  // PENDING_DOCS ↔ DATA_REVIEW: 자료요청 후 고객이 보완하면 검토 재개.
  'review':            { from: ['PENDING', 'PENDING_DOCS'], to: 'DATA_REVIEW' },
  'request-approval':  { from: 'DATA_REVIEW',        to: 'PENDING_APPROVAL' },
  'approve':           { from: 'PENDING_APPROVAL',   to: 'APPROVED' },
  'reject':            { from: 'PENDING_APPROVAL',   to: 'DATA_REVIEW' },
  'generate-ebilling': { from: 'APPROVED',           to: 'EBILLING_GENERATED' },
  'notify-customer':   { from: 'EBILLING_GENERATED', to: 'PAYMENT_PENDING' },
  'complete':          { from: 'PAYMENT_PENDING',    to: 'COMPLETED' },
  'fail':              { from: 'any',                 to: 'FAILED' },
};

const SUPERVISOR_ACTIONS = ['approve', 'reject', 'reassign'];

const VALID_TAX_TYPES = ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL', 'PPh4_2', 'PPh15', 'PPh22', 'PPh26', 'SPT_TAHUNAN'];

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
  // kind=closing → 결산만 (closing_session_id IS NOT NULL)
  // kind=monthly → 월신고만 (closing_session_id IS NULL)
  // 미지정/all  → 전체
  const kind = searchParams.get('kind');
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
      closing_session_id,
      created_at, updated_at, operator_id
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Supervisors see all items; operators see their own PLUS unassigned
  // (operator_id IS NULL) items — auto-created queue rows for customers with
  // no active assignment must not silently disappear from every workqueue.
  if (operatorProfileId) {
    query = query.or(`operator_id.eq.${operatorProfileId},operator_id.is.null`);
  }

  if (status) query = query.eq('status', status);
  if (taxType) query = query.eq('tax_type', taxType);
  if (year) query = query.eq('tax_period_year', parseInt(year, 10));
  if (month) query = query.eq('tax_period_month', parseInt(month, 10));
  if (kind === 'closing') query = query.not('closing_session_id', 'is', null);
  else if (kind === 'monthly') query = query.is('closing_session_id', null);

  const { data: rawItems, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with customer data. NOTE: customer has no customer_name column —
  // COMPANY uses company_name, INDIVIDUAL uses full_name. Keep the response
  // field name customer_name (frontend contract).
  const customerIds = [...new Set((rawItems || []).map(i => i.customer_id).filter(Boolean))];
  const customerMap: Record<string, { id: string; customer_name: string; npwp: string | null; customer_type: string }> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await admin
      .from('customer').select('id, full_name, company_name, npwp, customer_type').in('id', customerIds);
    for (const c of customers || []) {
      customerMap[c.id] = {
        id: c.id,
        customer_name: (c.customer_type === 'COMPANY' ? c.company_name : c.full_name) || c.full_name || c.company_name || '—',
        npwp: c.npwp ?? null,
        customer_type: c.customer_type,
      };
    }
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
 *           notify-customer | complete | fail
 *   (complete 는 향후 Coretax 연동의 NTPN 자동수집 전용 — operator UI 에는 없음)
 * - ebillingCode: required for generate-ebilling
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
    id, action, ebillingCode,
    notes, approvalNotes, rejectedReason, failedReason,
    targetOperatorId, reassignmentReason,
  } = body;

  if (!id || !action) {
    return NextResponse.json(
      { error: 'id and action are required' },
      { status: 400 }
    );
  }

  // `reassign` is a special action with no status transition — it is handled
  // separately below, so it is allowed past the transition guard.
  const transition = STATUS_TRANSITIONS[action];
  if (!transition && action !== 'reassign') {
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
  // An unassigned item (operator_id NULL) is claimed by the first operator
  // who acts on it — mirrors the GET visibility rule above.
  let claimOperatorId: string | null = null;
  if (!SUPERVISOR_ROLES.includes(role)) {
    const { data: opProfile } = await admin
      .from('tax_operators')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!opProfile || (item.operator_id !== null && item.operator_id !== opProfile.id)) {
      return NextResponse.json(
        { error: 'You are not assigned to this queue item' },
        { status: 403 }
      );
    }
    if (item.operator_id === null) claimOperatorId = opProfile.id;
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

  // Build update payload. Note: djp_submission_queue has no `updated_by`
  // column — only `updated_at`. Per-action audit fields (approved_by,
  // payment_verified_by) are set below where they exist.
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: transition.to,
    updated_at: now,
  };
  if (claimOperatorId) updatePayload.operator_id = claimOperatorId;

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
  if (ebillingCode) updatePayload.ebilling_code = ebillingCode;
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

/**
 * POST /api/operator/queue
 *
 * Quick-create a djp_submission_queue row for (customerId, taxType, month, year).
 * Idempotent: if a row already exists for that unique tuple, return it
 * (created:false) instead of erroring.
 */
export async function POST(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json();
  const { customerId, taxType, month, year } = body as {
    customerId?: string; taxType?: string; month?: number; year?: number;
  };
  if (!customerId || !taxType || !month || !year) {
    return NextResponse.json({ error: 'customerId, taxType, month, year are required' }, { status: 400 });
  }

  // Lightweight input validation to prevent junk rows.
  if (!VALID_TAX_TYPES.includes(taxType)) {
    return NextResponse.json({ error: 'invalid taxType' }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'invalid period' }, { status: 400 });
  }

  // existing?
  const { data: existing } = await admin
    .from('djp_submission_queue')
    .select('*')
    .eq('customer_id', customerId).eq('tax_type', taxType)
    .eq('tax_period_month', month).eq('tax_period_year', year)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: true, data: existing, created: false });

  const { data: opProfile } = await admin
    .from('tax_operators').select('id').eq('user_id', user!.id).maybeSingle();

  const { data: created, error } = await admin
    .from('djp_submission_queue')
    .insert({
      customer_id: customerId, tax_type: taxType,
      tax_period_month: month, tax_period_year: year,
      operator_id: opProfile?.id ?? null, status: 'PENDING',
    })
    .select('*').single();
  if (error) {
    // Concurrent insert lost the race on UNIQUE(customer_id,tax_type,month,year).
    // Re-select the winning row and return it idempotently (200, created:false).
    if (error.code === '23505') {
      const { data: raced } = await admin
        .from('djp_submission_queue')
        .select('*')
        .eq('customer_id', customerId).eq('tax_type', taxType)
        .eq('tax_period_month', month).eq('tax_period_year', year)
        .maybeSingle();
      if (raced) return NextResponse.json({ success: true, data: raced, created: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: created, created: true });
}
