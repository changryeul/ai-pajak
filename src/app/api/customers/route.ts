import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listCustomers,
  createCustomer,
  ListCustomersParams,
} from '@/lib/services/customer-service';

/**
 * List Customers API
 *
 * Lists customers with pagination and filters.
 * - Consultants see only their assigned customers
 * - Platform admins can see all customers (but not tax data)
 *
 * @route GET /api/customers
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

    // Build params
    const params: ListCustomersParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '20', 10), 100),
      search: searchParams.get('search') || undefined,
      customerType: searchParams.get('customerType') as 'INDIVIDUAL' | 'COMPANY' | undefined,
      sortBy: searchParams.get('sortBy') as 'created_at' | 'full_name' | 'company_name' || 'created_at',
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
    };

    // If consultant, filter by assigned customers
    if (userRole.role === 'CONSULTANT_JTC' || userRole.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (consultant) {
        params.consultantId = consultant.id;
      }
    }

    const result = await listCustomers(params);

    return NextResponse.json({
      success: true,
      data: result.customers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('List customers error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list customers',
      },
      { status: 500 }
    );
  }
}

/**
 * Create Customer API
 *
 * Creates a new customer record.
 * - Only consultants and platform admins can create customers
 *
 * @route POST /api/customers
 */
export async function POST(request: NextRequest) {
  try {
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

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 403 }
      );
    }

    // Only consultants and platform admins can create customers
    const allowedRoles = ['CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'];
    if (!allowedRoles.includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: 'Only consultants and platform admins can create customers' },
        { status: 403 }
      );
    }

    // Validate required fields
    const { full_name, email, customer_type, npwp, company_name, phone, address } = body;

    if (!full_name || !email || !customer_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['full_name', 'email', 'customer_type'],
        },
        { status: 400 }
      );
    }

    if (!['INDIVIDUAL', 'COMPANY'].includes(customer_type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid customer_type. Must be INDIVIDUAL or COMPANY',
        },
        { status: 400 }
      );
    }

    if (customer_type === 'COMPANY' && !company_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'company_name is required for COMPANY type customers',
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingCustomer } = await supabase
      .from('customer')
      .select('id')
      .eq('email', email)
      .single();

    if (existingCustomer) {
      return NextResponse.json(
        {
          success: false,
          error: 'A customer with this email already exists',
        },
        { status: 409 }
      );
    }

    // Create user account first (if not existing)
    // For now, we'll create the customer with the creator's user_id
    // In production, you'd want to invite the customer to create their own account
    const customer = await createCustomer({
      user_id: user.id, // Temporary - should be customer's own user_id
      full_name,
      email,
      customer_type,
      npwp: npwp || null,
      company_name: company_name || null,
      phone: phone || null,
      address: address || null,
    });

    // If consultant created the customer, auto-assign them
    if (userRole.role === 'CONSULTANT_JTC' || userRole.role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (consultant) {
        await supabase.from('customer_consultant').insert({
          customer_id: customer.id,
          consultant_id: consultant.id,
          assigned_by_user_id: user.id,
          is_active: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: customer,
    }, { status: 201 });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer',
      },
      { status: 500 }
    );
  }
}
