import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RequestWithSession } from '@/types/auth';
import { RequestWithPOA } from '@/middleware/requireValidPOA';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { requireValidPOA } from '@/middleware/requireValidPOA';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';

/**
 * CRITICAL ENDPOINT
 *
 * Tax Filing Submission
 *
 * HARD RULES ENFORCED:
 * 1. Only TAX_ADVISOR_JTC can submit tax filings
 * 2. PLATFORM_ADMIN is blocked from accessing tax data
 * 3. Active POA is required
 * 4. All actions are audit logged
 * 5. Legal responsibility traced to Jakarta Tax Consulting
 *
 * This is the ONLY endpoint that submits tax filings to DJP.
 * Platform NEVER files taxes directly.
 *
 * @route POST /api/tax/file
 */

interface TaxFilingRequest {
  customerId: string;
  taxType: 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_MASA' | 'SPT_TAHUNAN';
  taxPeriod: string; // YYYY-MM or YYYY
  taxYear: number;
  taxData: {
    calculatedTax: number;
    taxableIncome?: number;
    deductions?: number;
    credits?: number;
    netTaxDue: number;
    [key: string]: any;
  };
  documentIds: string[]; // Supporting documents
  notes?: string;
}

interface TaxFilingResponse {
  success: boolean;
  taxFilingId: string;
  filingNumber: string;
  status: 'SUBMITTED';
  submittedAt: string;
  submittedBy: {
    userId: string;
    consultantId: string;
    taxPartnerId: string;
    taxPartnerName: string;
  };
  customer: {
    customerId: string;
    customerName: string;
    npwp: string;
  };
  poa: {
    poaId: string;
    poaNumber: string;
  };
  tax: {
    taxType: string;
    taxPeriod: string;
    taxYear: number;
    netTaxDue: number;
  };
  auditTrail: {
    auditLogId: string;
    timestamp: string;
  };
}

async function handler(request: RequestWithPOA): Promise<Response> {
  const { session, poa, body } = request;

  // Parse and validate request body
  const {
    customerId,
    taxType,
    taxPeriod,
    taxYear,
    taxData,
    documentIds,
    notes,
  } = body as TaxFilingRequest;

  // Validation
  if (!customerId || !taxType || !taxPeriod || !taxYear || !taxData) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: [
          'customerId',
          'taxType',
          'taxPeriod',
          'taxYear',
          'taxData',
        ],
      },
      { status: 400 }
    );
  }

  if (!taxData.netTaxDue || taxData.netTaxDue < 0) {
    return NextResponse.json(
      {
        error: 'Invalid tax data',
        message: 'netTaxDue must be a positive number',
      },
      { status: 400 }
    );
  }

  // Get Supabase client
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Get consultant information
  const { data: consultant, error: consultantError } = await supabase
    .from('consultant')
    .select(
      `
      id,
      user_id,
      tax_partner_id,
      tax_partner:tax_partner_id (
        id,
        organization_name,
        license_number
      )
    `
    )
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .single();

  if (consultantError || !consultant) {
    console.error('[TAX_FILING] Consultant not found', {
      userId: session.userId,
      error: consultantError,
    });

    return NextResponse.json(
      {
        error: 'Consultant not found',
        message: 'Active consultant record not found for this user',
      },
      { status: 404 }
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

  // Generate filing number
  const filingNumber = `TAX-${taxYear}-${taxType}-${Date.now()}`;

  // Create tax filing record
  const { data: taxFiling, error: filingError } = await supabase
    .from('tax_filing')
    .insert({
      filing_number: filingNumber,
      customer_id: customerId,
      tax_partner_id: consultant.tax_partner_id,
      consultant_id: consultant.id,
      poa_id: poa.id,
      tax_type: taxType,
      tax_period: taxPeriod,
      tax_year: taxYear,
      tax_data: taxData,
      filing_status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      submitted_by_user_id: session.userId,
      notes,
    })
    .select('id, filing_number, filing_status, submitted_at')
    .single();

  if (filingError) {
    console.error('[TAX_FILING] Failed to create tax filing', {
      error: filingError,
      customerId,
      taxType,
    });

    return NextResponse.json(
      {
        error: 'Tax filing creation failed',
        message: filingError.message,
        detail:
          'Database validation failed. Please check POA status and filing data.',
      },
      { status: 500 }
    );
  }

  // Link supporting documents
  if (documentIds && documentIds.length > 0) {
    const documentLinks = documentIds.map((docId) => ({
      tax_filing_id: taxFiling.id,
      document_id: docId,
      relationship_type: 'SUPPORTING_DOCUMENT',
    }));

    await supabase.from('tax_filing_documents').insert(documentLinks);
  }

  // Create audit log
  const { data: auditLog } = await supabase
    .from('audit_log')
    .insert({
      customer_id: customerId,
      tax_filing_id: taxFiling.id,
      actor_user_id: session.userId,
      actor_organization_id: consultant.tax_partner_id,
      actor_role: session.role,
      activity_type: 'TAX_FILING_SUBMIT',
      tax_type: taxType,
      tax_period: taxPeriod,
      activity_details: {
        filingNumber: taxFiling.filing_number,
        poaId: poa.id,
        poaNumber: poa.poa_number,
        consultantId: consultant.id,
        taxPartnerId: consultant.tax_partner_id,
        netTaxDue: taxData.netTaxDue,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })
    .select('id, created_at')
    .single();

  console.info('[TAX_FILING] Tax filing submitted successfully', {
    taxFilingId: taxFiling.id,
    filingNumber: taxFiling.filing_number,
    customerId,
    taxType,
    consultantId: consultant.id,
    poaId: poa.id,
    auditLogId: auditLog?.id,
  });

  // Prepare response
  const response: TaxFilingResponse = {
    success: true,
    taxFilingId: taxFiling.id,
    filingNumber: taxFiling.filing_number,
    status: 'SUBMITTED',
    submittedAt: taxFiling.submitted_at,
    submittedBy: {
      userId: session.userId,
      consultantId: consultant.id,
      taxPartnerId: consultant.tax_partner_id,
      taxPartnerName: (consultant.tax_partner as any).organization_name,
    },
    customer: {
      customerId: customer.id,
      customerName:
        customer.customer_type === 'INDIVIDUAL'
          ? customer.full_name!
          : customer.company_name!,
      npwp: customer.npwp,
    },
    poa: {
      poaId: poa.id,
      poaNumber: poa.poa_number,
    },
    tax: {
      taxType,
      taxPeriod,
      taxYear,
      netTaxDue: taxData.netTaxDue,
    },
    auditTrail: {
      auditLogId: auditLog?.id || '',
      timestamp: auditLog?.created_at || new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 201 });
}

/**
 * POST /api/tax/file
 *
 * Submit tax filing to DJP
 *
 * MIDDLEWARE STACK (5 layers):
 * 1. requireAuth - Must be logged in
 * 2. blockPlatformAdmin - Platform admin blocked (Hard Rule #1)
 * 3. requireRole - Only TAX_ADVISOR_JTC allowed (Hard Rule #4)
 * 4. requireValidPOA - Active POA required (Hard Rule #6)
 * 5. withAudit - Audit trail created (Hard Rule #5)
 *
 * RLS POLICIES (final enforcement):
 * - tax_filing table RLS blocks unauthorized inserts
 * - validate_tax_filing_poa() trigger validates POA at database level
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_ADVISOR_JTC),
    requireValidPOA(),
    withAudit('TAX_FILING_SUBMIT')
  )(request as RequestWithSession, handler);
}
