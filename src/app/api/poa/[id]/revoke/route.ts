import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokePOA, rejectPOA, getPOA } from '@/lib/services/poa-service';
import { loggers } from '@/lib/logger';
import { resolveUserRole } from '@/lib/auth/resolve-role';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Revoke or Reject POA
 *
 * @route POST /api/poa/[id]/revoke
 *
 * - Customers can revoke their own ACTIVE POAs
 * - Tax Advisors can reject PENDING_SIGNATURE POAs
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: poaId } = await params;
    const body = await request.json();

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role (robust: handles multiple rows + fallback)
    const role = await resolveUserRole(supabase, user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const userRole = { role };

    // Validate input
    const { reason } = body;
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Get current POA
    const poa = await getPOA(poaId);

    if (!poa) {
      return NextResponse.json(
        { success: false, error: 'POA not found' },
        { status: 404 }
      );
    }

    let result;
    let activityType: string;

    // Customer revoking their own active POA
    if (userRole.role === 'CUSTOMER') {
      // Verify ownership
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer || poa.customer_id !== customer.id) {
        return NextResponse.json(
          { success: false, error: 'You can only revoke your own POA' },
          { status: 403 }
        );
      }

      if (poa.status !== 'ACTIVE') {
        return NextResponse.json(
          { success: false, error: 'Only active POAs can be revoked by customers' },
          { status: 400 }
        );
      }

      result = await revokePOA(poaId, {
        revoked_by_user_id: user.id,
        revocation_reason: reason,
      });
      activityType = 'POA_REVOKED';

      // Log the activity
      await supabase.from('tax_activity_log').insert({
        customer_id: customer.id,
        actor_user_id: user.id,
        actor_role: 'CUSTOMER',
        activity_type: activityType,
        activity_details: {
          poa_id: poaId,
          poa_number: result.poa_number,
          old_status: 'ACTIVE',
          new_status: 'REVOKED',
          reason,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          poaNumber: result.poa_number,
          previousStatus: 'ACTIVE',
          newStatus: 'REVOKED',
          revokedAt: result.revoked_at,
          reason,
          message: 'POA has been revoked. Tax partner can no longer file taxes on your behalf.',
        },
      });
    }

    // Tax Advisor rejecting a pending POA
    if (userRole.role === 'TAX_ADVISOR_JTC') {
      // Verify they work for the tax partner
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id, full_name, tax_partner_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!consultant) {
        return NextResponse.json(
          { success: false, error: 'Tax advisor record not found' },
          { status: 404 }
        );
      }

      if (consultant.tax_partner_id !== poa.tax_partner_id) {
        return NextResponse.json(
          { success: false, error: 'You can only reject POAs for your tax partner' },
          { status: 403 }
        );
      }

      if (poa.status !== 'PENDING_SIGNATURE') {
        return NextResponse.json(
          { success: false, error: 'Only pending POAs can be rejected' },
          { status: 400 }
        );
      }

      result = await rejectPOA(poaId, user.id, reason);
      activityType = 'POA_REVOKED'; // Using same activity type for rejection

      // Log the activity
      await supabase.from('tax_activity_log').insert({
        customer_id: poa.customer_id,
        actor_user_id: user.id,
        actor_organization_id: consultant.tax_partner_id,
        actor_role: 'TAX_ADVISOR_JTC',
        activity_type: activityType,
        activity_details: {
          poa_id: poaId,
          poa_number: result.poa_number,
          old_status: 'PENDING_SIGNATURE',
          new_status: 'REJECTED',
          reason,
          rejected_by: consultant.full_name,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          poaNumber: result.poa_number,
          previousStatus: 'PENDING_SIGNATURE',
          newStatus: 'REJECTED',
          rejectedAt: result.revoked_at,
          rejectedBy: {
            userId: user.id,
            name: consultant.full_name,
          },
          reason,
          message: 'POA has been rejected. Customer will be notified.',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Only customers and tax advisors can revoke/reject POAs' },
      { status: 403 }
    );
  } catch (error) {
    loggers.api.error({ err: error }, 'Revoke POA error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke POA',
      },
      { status: 500 }
    );
  }
}
