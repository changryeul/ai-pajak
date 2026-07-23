import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

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
 * GET /api/operator/approval-rules
 * Returns the active approval rule with auto-approval statistics.
 */
export async function GET() {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { admin } = auth;

  const { data: rule, error } = await admin
    .from('approval_rules')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }

  // Get auto-approval statistics
  const { count: totalItems } = await admin
    .from('djp_submission_queue')
    .select('id', { count: 'exact', head: true })
    .in('status', ['APPROVED', 'PENDING_APPROVAL', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'COMPLETED']);

  const { count: autoApprovedCount } = await admin
    .from('djp_submission_queue')
    .select('id', { count: 'exact', head: true })
    .eq('auto_approved', true);

  const { count: pendingApproval } = await admin
    .from('djp_submission_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING_APPROVAL');

  return NextResponse.json({
    success: true,
    data: {
      rule: rule || null,
      statistics: {
        totalProcessed: totalItems || 0,
        autoApproved: autoApprovedCount || 0,
        pendingManualReview: pendingApproval || 0,
        autoApprovalRate: (totalItems || 0) > 0
          ? Math.round(((autoApprovedCount || 0) / (totalItems || 1)) * 100)
          : 0,
      },
    },
  });
}

/**
 * PUT /api/operator/approval-rules
 * Update the active approval rule thresholds.
 */
export async function PUT(request: NextRequest) {
  const auth = await getSupervisorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json();
  const {
    minOcrConfidence,
    maxRiskScore,
    minComplianceScore,
    minValidationScore,
    minTrustScore,
    maxAutoApproveAmount,
    isActive,
  } = body;

  // Get current rule
  const { data: current } = await admin
    .from('approval_rules')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  const updatePayload: Record<string, unknown> = {};
  if (minOcrConfidence !== undefined) updatePayload.min_ocr_confidence = minOcrConfidence;
  if (maxRiskScore !== undefined) updatePayload.max_risk_score = maxRiskScore;
  if (minComplianceScore !== undefined) updatePayload.min_compliance_score = minComplianceScore;
  if (minValidationScore !== undefined) updatePayload.min_validation_score = minValidationScore;
  if (minTrustScore !== undefined) updatePayload.min_trust_score = minTrustScore;
  if (maxAutoApproveAmount !== undefined) updatePayload.max_auto_approve_amount = maxAutoApproveAmount;
  if (isActive !== undefined) updatePayload.is_active = isActive;

  if (current) {
    const { data, error } = await admin
      .from('approval_rules')
      .update(updatePayload)
      .eq('id', current.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } else {
    // Create new rule
    const { data, error } = await admin
      .from('approval_rules')
      .insert({
        name: 'default',
        is_active: true,
        created_by: user!.id,
        ...updatePayload,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }
}
