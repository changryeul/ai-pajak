import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleGetFilings(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const taxType = url.searchParams.get('taxType');
  const status = url.searchParams.get('status');
  const customerId = url.searchParams.get('customerId');
  const search = url.searchParams.get('search');

  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('tax_filings')
      .select(`
        id,
        tax_type,
        tax_year,
        tax_period,
        status,
        total_income,
        tax_due,
        due_date,
        submitted_at,
        created_at,
        customer:customers!inner(
          id,
          full_name,
          company_name,
          npwp
        )
      `, { count: 'exact' });

    // Role-based filtering
    const { role, userId } = req.session;

    if (role === 'CUSTOMER') {
      // Customers can only see their own filings
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customer) {
        query = query.eq('customer_id', customer.id);
      } else {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    } else if (role === 'CONSULTANT_JTC') {
      // Consultants can see filings for their assigned customers
      const { data: assignedCustomers } = await supabaseAdmin
        .from('customer_consultant')
        .select('customer_id')
        .eq('consultant_id', userId)
        .eq('is_active', true);

      const customerIds = assignedCustomers?.map((c) => c.customer_id) || [];
      if (customerIds.length > 0) {
        query = query.in('customer_id', customerIds);
      } else {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    }
    // TAX_ADVISOR_JTC and PLATFORM_ADMIN can see all filings

    // Apply filters
    if (taxType) {
      query = query.eq('tax_type', taxType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (search) {
      query = query.or(`customer.full_name.ilike.%${search}%,customer.npwp.ilike.%${search}%`);
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching filings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch filings' },
        { status: 500 }
      );
    }

    // Transform data
    type CustomerData = { id: string; full_name: string; company_name: string | null; npwp: string | null };
    const filings = data?.map((filing) => {
      // Handle both single object and array from Supabase join
      const customerData = filing.customer as unknown;
      const customer = Array.isArray(customerData) ? customerData[0] as CustomerData | undefined : customerData as CustomerData | null;

      return {
        id: filing.id,
        taxType: filing.tax_type,
        taxYear: filing.tax_year,
        taxPeriod: filing.tax_period,
        status: filing.status,
        totalIncome: filing.total_income,
        taxDue: filing.tax_due,
        dueDate: filing.due_date,
        submittedAt: filing.submitted_at,
        createdAt: filing.created_at,
        customer: customer ? {
          id: customer.id,
          fullName: customer.full_name,
          companyName: customer.company_name,
          npwp: customer.npwp,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: filings,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in get filings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole, 'PLATFORM_ADMIN' as UserRole),
    withAudit('TAX_FILING_VIEW')
  )(request as RequestWithSession, handleGetFilings);
}
