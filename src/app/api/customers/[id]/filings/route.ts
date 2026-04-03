import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCustomerFilings } from '@/lib/services/customer-service';
import { loggers } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get Customer Tax Filings
 *
 * @route GET /api/customers/[id]/filings
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const status = searchParams.get('status') || undefined;
    const taxType = searchParams.get('taxType') || undefined;

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

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    // PLATFORM_ADMIN cannot access tax filing data (Hard Rule #1)
    if (userRole.role === 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Platform admins cannot access tax filing data' },
        { status: 403 }
      );
    }

    // Check access
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
          .eq('customer_id', customerId)
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
      // Customers can only view their own filings
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer || customer.id !== customerId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const result = await getCustomerFilings(customerId, {
      page,
      limit,
      status,
      taxType,
    });

    return NextResponse.json({
      success: true,
      data: result.filings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Get customer filings error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer filings',
      },
      { status: 500 }
    );
  }
}
