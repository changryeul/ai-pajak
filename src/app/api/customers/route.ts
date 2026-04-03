/**
 * Customers API
 *
 * GET /api/customers
 *
 * Returns the list of customers for the authenticated consultant/tax advisor.
 * Only accessible by CONSULTANT_JTC and TAX_ADVISOR_JTC roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
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
