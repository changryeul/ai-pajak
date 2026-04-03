import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';
import { SPTMasaCalculator } from '@/lib/tax';

/**
 * SPT Masa (Monthly Tax Return) Endpoint
 *
 * HARD RULES ENFORCED:
 * 1. CONSULTANT_JTC and TAX_ADVISOR_JTC can create SPT Masa
 * 2. PLATFORM_ADMIN is blocked from accessing tax data
 * 3. All SPT Masa creations are audit logged
 * 4. SPT Masa does NOT submit to DJP (DRAFT status only)
 *
 * This endpoint creates monthly tax return summaries for:
 * - PPh21 (Individual income tax withholding)
 * - PPh23 (Withholding tax on services)
 * - PPN (Value Added Tax)
 *
 * @route POST /api/tax/spt-masa
 */

interface SPTMasaRequest {
  customerId: string;
  taxType: 'PPh21' | 'PPh23' | 'PPN';
  period: string; // 'YYYY-MM'
}

interface SPTMasaResponse {
  success: boolean;
  filingId: string;
  customer: {
    customerId: string;
    customerName: string;
    npwp: string;
  };
  sptMasa: {
    taxType: string;
    period: string;
    totalGrossIncome: number;
    totalTaxWithheld: number;
    totalNetPayable: number;
    itemCount: number;
    submissionDeadline: string;
    isOverdue: boolean;
  };
  breakdown: Record<string, unknown>;
  createdAt: string;
  createdBy: {
    userId: string;
    consultantId: string;
    consultantName: string;
  };
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // Parse request body
  const body = (await request.json()) as SPTMasaRequest;
  const { customerId, taxType, period } = body;

  // Validation
  if (!customerId || !taxType || !period) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: ['customerId', 'taxType', 'period'],
      },
      { status: 400 }
    );
  }

  // Validate period format (YYYY-MM)
  if (!SPTMasaCalculator.isValidPeriod(period)) {
    return NextResponse.json(
      {
        error: 'Invalid period format',
        message: 'Period must be in YYYY-MM format (e.g., 2025-01)',
      },
      { status: 400 }
    );
  }

  // Validate tax type
  if (!['PPh21', 'PPh23', 'PPN'].includes(taxType)) {
    return NextResponse.json(
      {
        error: 'Invalid tax type',
        message: 'Tax type must be PPh21, PPh23, or PPN',
      },
      { status: 400 }
    );
  }

  // Get Supabase client
  const supabase = await createClient();

  // Get consultant information
  const { data: consultant, error: consultantError } = await supabase
    .from('consultant')
    .select(
      `
      id,
      user_id,
      full_name,
      tax_partner_id
    `
    )
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .single();

  if (consultantError || !consultant) {
    return NextResponse.json(
      {
        error: 'Consultant not found',
        message: 'Active consultant record not found for this user',
      },
      { status: 404 }
    );
  }

  // Verify consultant can access this customer
  const { data: assignment, error: assignmentError } = await supabase
    .from('customer_consultant')
    .select('id')
    .eq('customer_id', customerId)
    .eq('consultant_id', consultant.id)
    .eq('is_active', true)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You are not assigned to this customer',
        customerId,
      },
      { status: 403 }
    );
  }

  // Get customer information
  const { data: customer, error: customerError } = await supabase
    .from('customer')
    .select('id, full_name, company_name, npwp, customer_type')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      {
        error: 'Customer not found',
        customerId,
      },
      { status: 404 }
    );
  }

  // Calculate SPT Masa
  let sptMasaResult;
  try {
    if (taxType === 'PPh21') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh21Masa({
        month: period,
        customerId,
      });
    } else if (taxType === 'PPh23') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh23Masa({
        month: period,
        customerId,
      });
    } else if (taxType === 'PPN') {
      sptMasaResult = await SPTMasaCalculator.calculatePPNMasa({
        month: period,
        customerId,
      });
    } else {
      return NextResponse.json(
        {
          error: 'Invalid tax type',
          message: 'Tax type must be PPh21, PPh23, or PPN',
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggers.tax.error({ err: error, customerId, taxType, period }, 'SPT Masa calculation error');
    return NextResponse.json(
      {
        error: 'SPT Masa calculation failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }

  // Check if there's already a filing for this period and tax type
  const { data: existingFiling } = await supabase
    .from('tax_filing')
    .select('id')
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', period)
    .eq('status', 'DRAFT')
    .single();

  let filing;
  if (existingFiling) {
    // Update existing draft
    const { data: updatedFiling, error: updateError } = await supabase
      .from('tax_filing')
      .update({
        consultant_id: consultant.id,
        tax_data: {
          spt_masa_result: sptMasaResult,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingFiling.id)
      .select('id, created_at')
      .single();

    if (updateError) {
      loggers.tax.error({ err: updateError }, 'Failed to update SPT Masa filing');
      return NextResponse.json(
        {
          error: 'Failed to update SPT Masa filing',
          message: updateError.message,
        },
        { status: 500 }
      );
    }

    filing = updatedFiling;
  } else {
    // Create new filing
    const { data: newFiling, error: filingError } = await supabase
      .from('tax_filing')
      .insert({
        customer_id: customerId,
        consultant_id: consultant.id,
        tax_type: taxType,
        tax_period: period,
        status: 'DRAFT',
        tax_data: {
          spt_masa_result: sptMasaResult,
        },
      })
      .select('id, created_at')
      .single();

    if (filingError) {
      loggers.tax.error({ err: filingError }, 'Failed to create SPT Masa filing');
      return NextResponse.json(
        {
          error: 'Failed to create SPT Masa filing',
          message: filingError.message,
        },
        { status: 500 }
      );
    }

    filing = newFiling;
  }

  // Create audit log
  await supabase.from('audit_log').insert({
    customer_id: customerId,
    actor_user_id: session.userId,
    actor_organization_id: consultant.tax_partner_id,
    actor_role: session.role,
    activity_type: 'SPT_MASA_CREATE',
    tax_type: taxType,
    tax_period: period,
    activity_details: {
      filingId: filing.id,
      totalGrossIncome: sptMasaResult.total_gross_income,
      totalTaxWithheld: sptMasaResult.total_tax_withheld,
      totalNetPayable: sptMasaResult.total_net_payable,
      itemCount: sptMasaResult.item_count,
    },
    ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  });

  loggers.tax.info({ filingId: filing.id, customerId, taxType, period, totalNetPayable: sptMasaResult.total_net_payable, consultantId: consultant.id }, 'SPT Masa created');

  // Check if overdue
  const isOverdue = SPTMasaCalculator.isOverdue(period, taxType);

  // Prepare response
  const response: SPTMasaResponse = {
    success: true,
    filingId: filing.id,
    customer: {
      customerId: customer.id,
      customerName:
        customer.customer_type === 'INDIVIDUAL'
          ? customer.full_name!
          : customer.company_name!,
      npwp: customer.npwp,
    },
    sptMasa: {
      taxType,
      period,
      totalGrossIncome: sptMasaResult.total_gross_income,
      totalTaxWithheld: sptMasaResult.total_tax_withheld,
      totalNetPayable: sptMasaResult.total_net_payable,
      itemCount: sptMasaResult.item_count,
      submissionDeadline: sptMasaResult.submission_deadline.toISOString(),
      isOverdue,
    },
    breakdown: sptMasaResult.breakdown as Record<string, unknown>,
    createdAt: filing.created_at,
    createdBy: {
      userId: session.userId,
      consultantId: consultant.id,
      consultantName: consultant.full_name,
    },
  };

  return NextResponse.json(response);
}

/**
 * POST /api/tax/spt-masa
 *
 * Create monthly tax return summary (SPT Masa)
 *
 * MIDDLEWARE STACK (4 layers):
 * 1. requireAuth - Must be logged in
 * 2. blockPlatformAdmin - Platform admin blocked (Hard Rule #1)
 * 3. requireRole - CONSULTANT_JTC or TAX_ADVISOR_JTC allowed
 * 4. withAudit - Audit trail created (Hard Rule #5)
 *
 * Note: SPT Masa is DRAFT only - actual submission requires TAX_ADVISOR_JTC via /api/tax/file
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
    withAudit('SPT_MASA_CREATE')
  )(request as RequestWithSession, handler);
}
