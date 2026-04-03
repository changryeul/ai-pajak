import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { RequestWithPOA } from '@/middleware/requireValidPOA';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { requireValidPOA } from '@/middleware/requireValidPOA';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';
import { queueDJPJob } from '@/lib/djp/queue';
import { DJP_API } from '@/config/constants';
import type { EFilingRequest, SPTType } from '@/lib/djp/types';

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
    [key: string]: unknown;
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
  djp?: {
    jobId: string;
    status: 'PENDING';
    message: string;
  };
}

async function handler(request: RequestWithPOA): Promise<Response> {
  const { session, poa, parsedBody } = request;

  // Parse and validate request body
  const {
    customerId,
    taxType,
    taxPeriod,
    taxYear,
    taxData,
    documentIds,
    notes,
  } = parsedBody as unknown as TaxFilingRequest;

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

  // Get Supabase admin client (bypasses RLS)
  // SECURITY: Safe because middleware has already verified:
  // 1. User authentication (requireAuth)
  // 2. Platform admin blocked (blockPlatformAdmin)
  // 3. Role is TAX_ADVISOR_JTC (requireRole)
  // 4. Valid POA exists (requireValidPOA)
  const supabase = createAdminClient();

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
        name,
        tax_license_number
      )
    `
    )
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .single();

  if (consultantError || !consultant) {
    loggers.tax.error({ err: consultantError, userId: session.userId }, 'Consultant not found');

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

  // Generate filing number (for reference, stored in tax_data)
  const filingNumber = `TAX-${taxYear}-${taxType}-${Date.now()}`;

  // Get tax_advisor_id for the consultant
  const { data: taxAdvisor } = await supabase
    .from('tax_advisor')
    .select('id')
    .eq('consultant_id', consultant.id)
    .single();

  // Create tax filing record
  const { data: taxFiling, error: filingError } = await supabase
    .from('tax_filing')
    .insert({
      customer_id: customerId,
      consultant_id: consultant.id,
      tax_advisor_id: taxAdvisor?.id || null,
      tax_type: taxType,
      tax_period: taxPeriod,
      status: 'FILED',
      tax_data: {
        ...taxData,
        filingNumber,
        poaId: poa.id,
        poaNumber: poa.poa_number,
        notes,
      },
      filed_at: new Date().toISOString(),
    })
    .select('id, status, filed_at, tax_data')
    .single();

  if (filingError) {
    loggers.tax.error({ err: filingError, customerId, taxType }, 'Failed to create tax filing');

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
        filingNumber: filingNumber,
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

  loggers.tax.info({ taxFilingId: taxFiling.id, filingNumber, customerId, taxType, consultantId: consultant.id, poaId: poa.id, auditLogId: auditLog?.id }, 'Tax filing submitted successfully');

  // Queue DJP e-Filing submission (async)
  let djpJobId: string | null = null;

  if (DJP_API.ENABLED) {
    try {
      // Map internal tax type to DJP SPT type
      const sptTypeMap: Record<string, SPTType> = {
        PPh21: 'SPT_MASA_PPH21',
        PPh23: 'SPT_MASA_PPH23',
        PPh_FINAL: 'SPT_MASA_PPH4_2',
        PPN: 'SPT_MASA_PPN',
        SPT_MASA: 'SPT_MASA_PPH21', // Default to PPh21 for SPT Masa
        SPT_TAHUNAN: 'SPT_TAHUNAN_1770',
      };

      // Get tax partner info for submittedBy
      const taxPartner = consultant.tax_partner;
      const taxPartnerInfo = Array.isArray(taxPartner)
        ? taxPartner[0]
        : (taxPartner as { name?: string; tax_license_number?: string } | null);

      const eFilingRequest: EFilingRequest = {
        npwp: customer.npwp,
        taxYear: taxYear,
        taxPeriod: taxPeriod,
        sptType: sptTypeMap[taxType] || 'SPT_MASA_PPH21',
        correctionNumber: 0, // Normal submission
        sptData: {
          identitasWP: {
            npwp: customer.npwp,
            nama:
              customer.customer_type === 'INDIVIDUAL'
                ? customer.full_name!
                : customer.company_name!,
            alamat: '', // Will be filled from customer record if available
            kota: '',
            statusWP: customer.customer_type === 'INDIVIDUAL' ? 'OP' : 'BADAN',
          },
          periodeData: {
            tahunPajak: taxYear,
            masaPajak: taxPeriod.split('-')[1] || undefined,
            pembetulanKe: 0,
          },
          detailData: taxData as unknown as EFilingRequest['sptData']['detailData'],
        },
        attachments: documentIds?.map((docId) => ({
          documentType: 'SUPPORTING_DOC',
          fileName: docId,
          fileBase64: '', // Will be filled by queue processor
          mimeType: 'application/pdf',
        })),
        poaNumber: poa.poa_number,
        submittedBy: {
          npwp: '', // Tax consultant NPWP - will be filled from consultant record
          name: taxPartnerInfo?.name || '',
          licenseNumber: taxPartnerInfo?.tax_license_number || '',
        },
      };

      djpJobId = await queueDJPJob({
        type: 'E_FILING',
        taxFilingId: taxFiling.id,
        customerId: customerId,
        payload: eFilingRequest,
        priority: 'NORMAL',
        maxRetries: 3,
      });

      loggers.tax.info({ taxFilingId: taxFiling.id, djpJobId, sptType: sptTypeMap[taxType] }, 'DJP e-Filing job queued');
    } catch (djpError) {
      // Log error but don't fail the request - DJP submission is async
      loggers.tax.error({ err: djpError, taxFilingId: taxFiling.id }, 'Failed to queue DJP job');
    }
  }

  // Prepare response
  const response: TaxFilingResponse = {
    success: true,
    taxFilingId: taxFiling.id,
    filingNumber: filingNumber,
    status: 'SUBMITTED',
    submittedAt: taxFiling.filed_at,
    submittedBy: {
      userId: session.userId,
      consultantId: consultant.id,
      taxPartnerId: consultant.tax_partner_id,
      taxPartnerName: (() => {
        const taxPartner = consultant.tax_partner;
        if (Array.isArray(taxPartner)) {
          return taxPartner[0]?.name || '';
        }
        return (taxPartner as { name?: string })?.name || '';
      })(),
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
    ...(djpJobId && {
      djp: {
        jobId: djpJobId,
        status: 'PENDING' as const,
        message: 'Tax filing queued for DJP submission. Check status via /api/djp/status/{jobId}',
      },
    }),
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
  )(request as RequestWithSession, handler as unknown as (req: RequestWithSession) => Promise<Response>);
}
