import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { listPOAs, POAStatus } from '@/lib/services/poa-service';
import { loggers } from '@/lib/logger';

/**
 * List Power of Attorney Records
 *
 * @route GET /api/poa
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role (robust)
    const role = await resolveUserRole(supabase, user.id);

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    const userRole = { role };

    // Build params based on role
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const status = searchParams.get('status') as POAStatus | undefined;

    let customerId: string | undefined;
    let taxPartnerId: string | undefined;

    // Customers can only see their own POAs
    if (userRole.role === 'CUSTOMER') {
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'Customer record not found' },
          { status: 404 }
        );
      }

      customerId = customer.id;
    }
    // Consultants/Advisors see POAs for their tax partner
    else if (userRole.role === 'CONSULTANT_JTC' || userRole.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('tax_partner_id')
        .eq('user_id', user.id)
        .single();

      if (consultant?.tax_partner_id) {
        taxPartnerId = consultant.tax_partner_id;
      }
    }
    // PLATFORM_ADMIN can see all (but this is for admin overview only)
    // Allow filtering by customer or tax partner from query params
    else if (userRole.role === 'PLATFORM_ADMIN') {
      customerId = searchParams.get('customerId') || undefined;
      taxPartnerId = searchParams.get('taxPartnerId') || undefined;
    }

    const result = await listPOAs({
      page,
      limit,
      customerId,
      taxPartnerId,
      status,
      sortBy: (searchParams.get('sortBy') as 'created_at' | 'valid_from' | 'valid_to') || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    });

    return NextResponse.json({
      success: true,
      data: result.poas,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'List POAs error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list POAs',
      },
      { status: 500 }
    );
  }
}
