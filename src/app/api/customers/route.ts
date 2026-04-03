/**
 * Customers API
 *
 * GET  /api/customers — List customers
 * POST /api/customers — Create a new customer
 *
 * Only accessible by CONSULTANT_JTC and TAX_ADVISOR_JTC roles.
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
    const supabase = await createClient();
    const { userId } = req.session;

    // Get consultant ID
    const { data: consultant } = await supabase
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', userId)
      .single();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: 'Consultant not found' },
        { status: 404 }
      );
    }

    // Get customers with active POA for this consultant's tax partner
    const { data: customers, error } = await supabase
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
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole)
  )(request as RequestWithSession, handleGetCustomers);
}

/**
 * POST /api/customers — Create a new customer
 */
async function handleCreateCustomer(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { full_name, company_name, email, phone, npwp, address, customer_type } = body;

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

    loggers.api.info({ customerId: customer.id, customerType: customer_type }, 'Customer created');

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
    requireRole('CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('CUSTOMER_CREATE')
  )(request as RequestWithSession, handleCreateCustomer);
}
