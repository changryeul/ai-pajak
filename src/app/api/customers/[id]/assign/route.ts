import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { unassignConsultant } from '@/lib/services/customer-service';
import { loggers } from '@/lib/logger';
import { resolveUserRole } from '@/lib/auth/resolve-role';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Assign Consultant to Customer
 *
 * @route POST /api/customers/[id]/assign
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const body = await request.json();
    const { consultantId } = body;

    if (!consultantId) {
      return NextResponse.json(
        { success: false, error: 'consultantId is required' },
        { status: 400 }
      );
    }

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

    // Only TAX_ADVISOR and PLATFORM_ADMIN can assign consultants
    const allowedRoles = ['TAX_ADVISOR', 'TAX_OPERATOR_SUPERVISOR', 'PLATFORM_ADMIN'];
    if (!allowedRoles.includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: 'Only tax advisors and platform admins can assign consultants' },
        { status: 403 }
      );
    }

    // Verify customer + consultant with admin client. Middleware has already
    // confirmed the caller is in allowedRoles (advisor / supervisor / admin),
    // so RLS-scoped reads are unnecessary and would 404 for supervisors on
    // pre-assignment customers (they have no consultant edge to see them yet).
    const admin = getSupabaseAdmin();
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const { data: consultant } = await admin
      .from('consultant')
      .select('id, full_name, is_active')
      .eq('id', consultantId)
      .single();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: 'Consultant not found' },
        { status: 404 }
      );
    }

    if (!consultant.is_active) {
      return NextResponse.json(
        { success: false, error: 'Consultant is not active' },
        { status: 400 }
      );
    }

    // Inline the assignment with the admin client for the same reason as the
    // customer/consultant lookups above. The service helper uses an RLS-scoped
    // client which would fail for supervisors on unassigned customers.
    const { data: existing } = await admin
      .from('customer_consultant')
      .select('id, is_active')
      .eq('customer_id', customerId)
      .eq('consultant_id', consultantId)
      .maybeSingle();

    if (existing?.is_active) {
      return NextResponse.json(
        { success: false, error: 'Consultant is already assigned to this customer' },
        { status: 409 },
      );
    }

    if (existing) {
      const { error: updErr } = await admin
        .from('customer_consultant')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updErr) throw new Error(`Failed to reactivate assignment: ${updErr.message}`);
    } else {
      const { error: insErr } = await admin
        .from('customer_consultant')
        .insert({
          customer_id: customerId,
          consultant_id: consultantId,
          assigned_by_user_id: user.id,
          is_active: true,
        });
      if (insErr) throw new Error(`Failed to assign consultant: ${insErr.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Consultant ${consultant.full_name} assigned successfully`,
      data: {
        customerId,
        consultantId,
        consultantName: consultant.full_name,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Assign consultant error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign consultant',
      },
      { status: 500 }
    );
  }
}

/**
 * Unassign Consultant from Customer
 *
 * @route DELETE /api/customers/[id]/assign
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const { searchParams } = new URL(request.url);
    const consultantId = searchParams.get('consultantId');

    if (!consultantId) {
      return NextResponse.json(
        { success: false, error: 'consultantId query parameter is required' },
        { status: 400 }
      );
    }

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

    // Only TAX_ADVISOR and PLATFORM_ADMIN can unassign consultants
    const allowedRoles = ['TAX_ADVISOR', 'TAX_OPERATOR_SUPERVISOR', 'PLATFORM_ADMIN'];
    if (!allowedRoles.includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: 'Only tax advisors and platform admins can unassign consultants' },
        { status: 403 }
      );
    }

    await unassignConsultant(customerId, consultantId);

    return NextResponse.json({
      success: true,
      message: 'Consultant unassigned successfully',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Unassign consultant error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unassign consultant',
      },
      { status: 500 }
    );
  }
}

/**
 * Get Assigned Consultants for Customer
 *
 * @route GET /api/customers/[id]/assign
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get assignments
    const { data: assignments, error } = await supabase
      .from('customer_consultant')
      .select(`
        id,
        is_active,
        created_at,
        consultant:consultant_id (
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get assignments: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: assignments?.map(a => ({
        id: a.id,
        isActive: a.is_active,
        assignedAt: a.created_at,
        consultant: a.consultant,
      })) || [],
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Get assignments error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assignments',
      },
      { status: 500 }
    );
  }
}
