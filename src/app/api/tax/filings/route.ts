import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';

interface CreateFilingRequest {
  customerId: string;
  taxType: 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_MASA' | 'SPT_TAHUNAN';
  taxPeriod: string;
  taxYear: number;
  status?: 'DRAFT' | 'UNDER_REVIEW';
  taxData: {
    calculatedTax?: number;
    taxableIncome?: number;
    grossIncome?: number;
    deductions?: number;
    netTaxDue?: number;
    incomeData?: Record<string, unknown>;
    deductionData?: Record<string, unknown>;
    notes?: string;
    [key: string]: unknown;
  };
  documentIds?: string[];
}

/**
 * POST - Create a new tax filing (draft or under review)
 *
 * Allowed roles:
 * - CUSTOMER: Can create drafts and request review for their own filings
 * - CONSULTANT_JTC/TAX_ADVISOR_JTC: Can create filings for any customer
 */
async function handleCreateFiling(request: RequestWithSession): Promise<Response> {
  const { session } = request;
  const body = (await request.json()) as CreateFilingRequest;

  const {
    customerId,
    taxType,
    taxPeriod,
    taxYear,
    status = 'DRAFT',
    taxData,
    documentIds,
  } = body;

  // Validation
  if (!customerId || !taxType || !taxPeriod || !taxYear) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: ['customerId', 'taxType', 'taxPeriod', 'taxYear'],
      },
      { status: 400 }
    );
  }

  let consultantId: string | null = null;

  // Handle based on user role
  if (session.role === 'CUSTOMER') {
    // Customers can only create filings for themselves
    const { data: customerRecord } = await getSupabaseAdmin()
      .from('customer')
      .select('id')
      .eq('user_id', session.userId)
      .single();

    if (!customerRecord || customerRecord.id !== customerId) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'You can only create filings for your own account',
        },
        { status: 403 }
      );
    }

    // For customer-created filings, consultant_id will be null until assigned
    consultantId = null;
  } else {
    // Consultants/Tax Advisors - get their consultant record
    const { data: consultant, error: consultantError } = await getSupabaseAdmin()
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (consultantError || !consultant) {
      return NextResponse.json(
        {
          error: 'Consultant not found',
          message: 'You must be an active consultant to create filings',
        },
        { status: 403 }
      );
    }

    consultantId = consultant.id;
  }

  // Verify customer exists
  const { data: customer, error: customerError } = await getSupabaseAdmin()
    .from('customer')
    .select('id, full_name')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: 'Customer not found', customerId },
      { status: 404 }
    );
  }

  // Check for existing draft for same customer/type/period
  const { data: existingFiling } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('id')
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', taxPeriod)
    .eq('status', 'DRAFT')
    .single();

  if (existingFiling) {
    // Update existing draft instead of creating new one
    const { data: updatedFiling, error: updateError } = await getSupabaseAdmin()
      .from('tax_filing')
      .update({
        tax_data: taxData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingFiling.id)
      .select('id, status, created_at, updated_at')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update draft', message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      filingId: updatedFiling.id,
      status: updatedFiling.status,
      isUpdate: true,
      updatedAt: updatedFiling.updated_at,
    });
  }

  // Create new filing
  const { data: newFiling, error: createError } = await getSupabaseAdmin()
    .from('tax_filing')
    .insert({
      customer_id: customerId,
      consultant_id: consultantId, // null for customer-created filings
      tax_type: taxType,
      tax_period: taxPeriod,
      status: status,
      tax_data: taxData,
    })
    .select('id, status, created_at')
    .single();

  if (createError) {
    console.error('[TAX_FILINGS] Create failed:', createError);
    return NextResponse.json(
      { error: 'Failed to create filing', message: createError.message },
      { status: 500 }
    );
  }

  // Link documents if provided
  if (documentIds && documentIds.length > 0) {
    const links = documentIds.map((docId) => ({
      tax_filing_id: newFiling.id,
      document_id: docId,
      relationship_type: 'SUPPORTING_DOCUMENT',
    }));

    await getSupabaseAdmin().from('tax_filing_documents').insert(links);
  }

  return NextResponse.json(
    {
      success: true,
      filingId: newFiling.id,
      status: newFiling.status,
      isUpdate: false,
      createdAt: newFiling.created_at,
    },
    { status: 201 }
  );
}

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
    let query = getSupabaseAdmin()
      .from('tax_filing')
      .select(`
        id,
        tax_type,
        tax_period,
        status,
        tax_data,
        filed_at,
        created_at,
        customer:customer!inner(
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
      const { data: customerRecord } = await getSupabaseAdmin()
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (customerRecord) {
        query = query.eq('customer_id', customerRecord.id);
      } else {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    } else if (role === 'CONSULTANT_JTC') {
      // Consultants can see filings for their assigned customers
      const { data: assignedCustomers } = await getSupabaseAdmin()
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
    type TaxData = { grossIncome?: number; taxDue?: number; calculatedTax?: number; netTaxDue?: number; [key: string]: unknown };
    const filings = data?.map((filing) => {
      // Handle both single object and array from Supabase join
      const customerData = filing.customer as unknown;
      const customer = Array.isArray(customerData) ? customerData[0] as CustomerData | undefined : customerData as CustomerData | null;

      // Extract data from tax_data JSONB
      const taxData = (filing.tax_data || {}) as TaxData;

      // Extract year from tax_period (format: YYYY-MM)
      const taxYear = filing.tax_period ? parseInt(filing.tax_period.split('-')[0]) : null;

      return {
        id: filing.id,
        taxType: filing.tax_type,
        taxYear,
        taxPeriod: filing.tax_period,
        status: filing.status,
        totalIncome: taxData.grossIncome || 0,
        taxDue: taxData.taxDue || taxData.calculatedTax || taxData.netTaxDue || 0,
        dueDate: null,
        submittedAt: filing.filed_at,
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
    blockPlatformAdmin,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('TAX_FILING_VIEW')
  )(request as RequestWithSession, handleGetFilings);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('TAX_FILING_CREATE')
  )(request as RequestWithSession, handleCreateFiling);
}
