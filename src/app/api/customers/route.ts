/**
 * Customers API
 *
 * GET  /api/customers — List customers
 * POST /api/customers — Create a new customer
 *
 * Only accessible by CONSULTANT and TAX_ADVISOR roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession, UserRole } from '@/types/auth';

async function handleGetCustomers(req: RequestWithSession): Promise<Response> {
  try {
    const { userId } = req.session;
    const admin = getSupabaseAdmin();

    // Get the caller's consultant row to determine their tax_partner scope
    const { data: consultant } = await admin
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: 'Consultant not found' },
        { status: 404 }
      );
    }

    // Scope customers by tax_partner: look up all active assignments whose
    // consultant belongs to the caller's tax_partner, then fetch those customers.
    // This mirrors the RLS policy but uses admin client for performance
    // (joining customer_consultant + consultant).
    const { data: assignments, error: assignError } = await admin
      .from('customer_consultant')
      .select('customer_id, consultant:consultant_id(tax_partner_id)')
      .eq('is_active', true);

    if (assignError) {
      loggers.api.error({ err: assignError }, 'Failed to fetch customer assignments');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    // Filter to assignments where the consultant belongs to this user's tax_partner
    const customerIds = (assignments || [])
      .filter((row) => {
        const cons = row.consultant as { tax_partner_id?: string } | { tax_partner_id?: string }[] | null;
        const tp = Array.isArray(cons) ? cons[0]?.tax_partner_id : cons?.tax_partner_id;
        return tp === consultant.tax_partner_id;
      })
      .map((row) => row.customer_id);

    if (customerIds.length === 0) {
      return NextResponse.json({
        success: true,
        customers: [],
        stats: { total: 0, active: 0, activePoa: 0, pendingFilings: 0 },
      });
    }

    const { data: customers, error } = await admin
      .from('customer')
      .select(`
        id,
        full_name,
        company_name,
        email,
        phone,
        npwp,
        customer_type,
        created_at,
        power_of_attorney!customer_id (
          id,
          status
        ),
        tax_filing!customer_id (
          id,
          status
        )
      `)
      .in('id', customerIds)
      .order('created_at', { ascending: false });

    if (error) {
      loggers.api.error({ err: error }, 'Failed to fetch customers');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    // Transform customers with POA status and filing count
    const transformedCustomers = (customers || []).map((customer) => {
      const poas = customer.power_of_attorney || [];
      const filings = customer.tax_filing || [];

      // Determine POA status
      let poaStatus: 'none' | 'pending' | 'active' = 'none';
      const activePoa = poas.find((poa: { status: string }) => poa.status === 'ACTIVE');
      const pendingPoa = poas.find((poa: { status: string }) =>
        ['DRAFT', 'PENDING_SIGNATURE'].includes(poa.status)
      );

      if (activePoa) {
        poaStatus = 'active';
      } else if (pendingPoa) {
        poaStatus = 'pending';
      }

      return {
        id: customer.id,
        full_name: customer.full_name,
        company_name: customer.company_name,
        email: customer.email,
        phone: customer.phone,
        npwp: customer.npwp,
        customer_type: customer.customer_type,
        created_at: customer.created_at,
        poa_status: poaStatus,
        filing_count: filings.length,
      };
    });

    // Calculate stats
    const stats = {
      total: transformedCustomers.length,
      active: transformedCustomers.filter((c) => c.poa_status === 'active').length,
      activePoa: transformedCustomers.filter((c) => c.poa_status === 'active').length,
      pendingFilings: transformedCustomers.reduce((acc, c) => acc + c.filing_count, 0),
    };

    return NextResponse.json({
      success: true,
      customers: transformedCustomers,
      stats,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Error fetching customers');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole('CONSULTANT' as UserRole, 'TAX_ADVISOR' as UserRole)
  )(request as RequestWithSession, handleGetCustomers);
}

/**
 * POST /api/customers — Create a new customer and link it to the caller's consultant.
 *
 * Atomically performs:
 *   1. Insert customer row
 *   2. Insert customer_consultant row (linking new customer to caller's consultant)
 * If step 2 fails, step 1 is rolled back.
 */
async function handleCreateCustomer(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { full_name, company_name, email, phone, npwp, address, customer_type } = body;
    const { userId } = req.session;

    if (!full_name) {
      return NextResponse.json(
        { success: false, error: 'full_name is required' },
        { status: 400 }
      );
    }

    if (!customer_type || !['INDIVIDUAL', 'COMPANY'].includes(customer_type)) {
      return NextResponse.json(
        { success: false, error: 'customer_type must be INDIVIDUAL or COMPANY' },
        { status: 400 }
      );
    }

    if (customer_type === 'COMPANY' && !company_name) {
      return NextResponse.json(
        { success: false, error: 'company_name is required for COMPANY type' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Look up the caller's active consultant row
    const { data: consultant } = await admin
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: '활성 컨설턴트 레코드가 없습니다' },
        { status: 403 }
      );
    }

    // Step 1: insert customer
    const { data: customer, error: insertError } = await admin
      .from('customer')
      .insert({
        full_name,
        company_name: company_name || null,
        email: email || null,
        phone: phone || null,
        npwp: npwp || null,
        address: address || null,
        customer_type,
      })
      .select()
      .single();

    if (insertError || !customer) {
      loggers.api.error({ err: insertError }, 'Failed to insert customer');
      return NextResponse.json(
        { success: false, error: insertError?.message || 'Failed to create customer' },
        { status: 500 }
      );
    }

    // Step 2: link to caller's consultant (best-effort rollback on failure)
    const { error: linkError } = await admin
      .from('customer_consultant')
      .insert({
        customer_id: customer.id,
        consultant_id: consultant.id,
        assigned_by_user_id: userId,
        is_active: true,
      });

    if (linkError) {
      loggers.api.error({ err: linkError, customerId: customer.id }, 'Failed to link customer to consultant, rolling back');
      // Best-effort rollback of the orphan customer
      await admin.from('customer').delete().eq('id', customer.id);
      return NextResponse.json(
        { success: false, error: `고객 등록 실패: ${linkError.message}` },
        { status: 500 }
      );
    }

    loggers.api.info(
      { customerId: customer.id, consultantId: consultant.id, taxPartnerId: consultant.tax_partner_id, customerType: customer_type },
      'Customer created and linked to consultant'
    );

    return NextResponse.json({
      success: true,
      data: customer,
    }, { status: 201 });
  } catch (error) {
    loggers.api.error({ err: error }, 'Create customer error');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole('CONSULTANT' as UserRole, 'TAX_ADVISOR' as UserRole),
    withAudit('CUSTOMER_CREATE')
  )(request as RequestWithSession, handleCreateCustomer);
}
