import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPOA } from '@/lib/services/poa-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get POA Details
 *
 * @route GET /api/poa/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: poaId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const poa = await getPOA(poaId);

    if (!poa) {
      return NextResponse.json(
        { success: false, error: 'POA not found' },
        { status: 404 }
      );
    }

    // Access control
    if (userRole.role === 'CUSTOMER') {
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer || poa.customer_id !== customer.id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    } else if (userRole.role === 'CONSULTANT_JTC' || userRole.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('tax_partner_id')
        .eq('user_id', user.id)
        .single();

      if (!consultant || poa.tax_partner_id !== consultant.tax_partner_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }
    // PLATFORM_ADMIN can view all POAs

    return NextResponse.json({
      success: true,
      data: poa,
    });
  } catch (error) {
    console.error('Get POA error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get POA',
      },
      { status: 500 }
    );
  }
}

/**
 * Update POA (only for DRAFT status)
 *
 * @route PATCH /api/poa/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole || userRole.role !== 'CUSTOMER') {
      return NextResponse.json(
        { success: false, error: 'Only customers can update POA drafts' },
        { status: 403 }
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

    // Verify ownership
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer || poa.customer_id !== customer.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Only drafts can be updated
    if (poa.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Only draft POAs can be updated' },
        { status: 400 }
      );
    }

    // Allowed fields for update
    const allowedFields = ['scope', 'scope_details', 'valid_from', 'valid_to', 'notes'];
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

    // Validate dates if provided
    if (updateData.valid_from && updateData.valid_to) {
      const from = new Date(updateData.valid_from as string);
      const to = new Date(updateData.valid_to as string);
      if (to <= from) {
        return NextResponse.json(
          { success: false, error: 'valid_to must be after valid_from' },
          { status: 400 }
        );
      }
    }

    const { data: updatedPOA, error } = await supabase
      .from('power_of_attorney')
      .update(updateData)
      .eq('id', poaId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update POA: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedPOA,
    });
  } catch (error) {
    console.error('Update POA error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update POA',
      },
      { status: 500 }
    );
  }
}

/**
 * Delete POA (only for DRAFT status)
 *
 * @route DELETE /api/poa/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: poaId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole || userRole.role !== 'CUSTOMER') {
      return NextResponse.json(
        { success: false, error: 'Only customers can delete POA drafts' },
        { status: 403 }
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

    // Verify ownership
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer || poa.customer_id !== customer.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Only drafts can be deleted
    if (poa.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Only draft POAs can be deleted' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('power_of_attorney')
      .delete()
      .eq('id', poaId);

    if (error) {
      throw new Error(`Failed to delete POA: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'POA deleted successfully',
    });
  } catch (error) {
    console.error('Delete POA error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete POA',
      },
      { status: 500 }
    );
  }
}
