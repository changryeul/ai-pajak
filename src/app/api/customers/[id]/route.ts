import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import {
  getCustomer,
  updateCustomer,
  deleteCustomer,
} from '@/lib/services/customer-service';
import { loggers } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get Customer Details
 *
 * @route GET /api/customers/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role (robust: handles multiple rows + fallback to consultant/customer tables)
    const role = await resolveUserRole(supabase, user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const userRole = { role };

    // CRITICAL: Platform admins cannot access customer data (personal data protection)
    if (userRole.role === 'PLATFORM_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'Platform administrators cannot access customer data',
        },
        { status: 403 }
      );
    }

    // Check access
    // Consultants can only view their assigned customers
    if (userRole.role === 'CONSULTANT_JTC' || userRole.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (consultant) {
        const { data: assignment } = await supabase
          .from('customer_consultant')
          .select('id')
          .eq('customer_id', id)
          .eq('consultant_id', consultant.id)
          .eq('is_active', true)
          .single();

        if (!assignment) {
          return NextResponse.json(
            { success: false, error: 'You are not assigned to this customer' },
            { status: 403 }
          );
        }
      }
    } else if (userRole.role === 'CUSTOMER') {
      // Customers can only view their own record
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer || customer.id !== id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const customer = await getCustomer(id);

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Get customer error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer',
      },
      { status: 500 }
    );
  }
}

/**
 * Update Customer
 *
 * @route PATCH /api/customers/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Get user role (robust: handles multiple rows + fallback to consultant/customer tables)
    const role = await resolveUserRole(supabase, user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const userRole = { role };

    // Check access
    const canUpdate = ['CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'];
    if (!canUpdate.includes(userRole.role)) {
      // Customers can update their own record
      if (userRole.role === 'CUSTOMER') {
        const { data: customer } = await supabase
          .from('customer')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!customer || customer.id !== id) {
          return NextResponse.json(
            { success: false, error: 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Validate update data
    const allowedFields = ['full_name', 'company_name', 'email', 'phone', 'address', 'npwp', 'nik'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const customer = await updateCustomer(id, updateData);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Update customer error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer',
      },
      { status: 500 }
    );
  }
}

/**
 * Delete Customer
 *
 * @route DELETE /api/customers/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role (robust: handles multiple rows + fallback to consultant/customer tables)
    const role = await resolveUserRole(supabase, user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const userRole = { role };

    // Only platform admins can delete customers
    if (userRole.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only platform admins can delete customers' },
        { status: 403 }
      );
    }

    await deleteCustomer(id, !hardDelete);

    return NextResponse.json({
      success: true,
      message: hardDelete
        ? 'Customer deleted permanently'
        : 'Customer deactivated successfully',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Delete customer error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete customer',
      },
      { status: 500 }
    );
  }
}
