import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';

/**
 * Power of Attorney (POA) Creation Endpoint
 *
 * HARD RULES ENFORCED:
 * 1. CUSTOMER creates POA request
 * 2. Document must be uploaded first
 * 3. Initial status is DRAFT (awaiting signatures)
 * 4. TAX_ADVISOR_JTC will review and sign later
 * 5. All actions are audit logged
 *
 * This is Step 1 of POA workflow:
 * 1. Customer creates POA (this endpoint)
 * 2. Customer signs POA
 * 3. Tax Advisor reviews POA
 * 4. Tax Advisor signs POA → Status: ACTIVE
 *
 * @route POST /api/poa/create
 */

interface POACreateRequest {
  taxPartnerId: string; // Jakarta Tax Consulting ID
  scope: 'ALL_TAX_TYPES' | 'PPh21_ONLY' | 'PPh23_ONLY' | 'PPN_ONLY' | 'CUSTOM';
  customScope?: string[]; // If scope = CUSTOM
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  documentUrl: string; // POA document URL (from Supabase Storage)
  notes?: string;
}

interface POACreateResponse {
  success: boolean;
  poaId: string;
  poaNumber: string;
  status: 'DRAFT';
  customer: {
    customerId: string;
    customerName: string;
    npwp: string;
  };
  taxPartner: {
    taxPartnerId: string;
    organizationName: string;
  };
  scope: string;
  validFrom: string;
  validTo: string;
  documentUrl?: string; // Optional for DRAFT status
  createdAt: string;
  nextSteps: {
    step: number;
    action: string;
    description: string;
  }[];
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // Parse request body
  const body = (await request.json()) as POACreateRequest;

  const {
    taxPartnerId,
    scope,
    customScope,
    validFrom,
    validTo,
    documentUrl,
    notes,
  } = body;

  // Validation - documentUrl is optional for DRAFT status (can be added later before signing)
  if (!taxPartnerId || !scope || !validFrom || !validTo) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: [
          'taxPartnerId',
          'scope',
          'validFrom',
          'validTo',
        ],
      },
      { status: 400 }
    );
  }

  // Validate dates
  const fromDate = new Date(validFrom);
  const toDate = new Date(validTo);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json(
      {
        error: 'Invalid date format',
        message: 'validFrom and validTo must be in YYYY-MM-DD format',
      },
      { status: 400 }
    );
  }

  if (toDate <= fromDate) {
    return NextResponse.json(
      {
        error: 'Invalid date range',
        message: 'validTo must be after validFrom',
      },
      { status: 400 }
    );
  }

  // Get Supabase client (supports both cookie-based and token-based auth)
  const supabase = await createClient();

  // Get customer information
  const { data: customer, error: customerError } = await supabase
    .from('customer')
    .select('id, user_id, full_name, company_name, npwp, customer_type')
    .eq('user_id', session.userId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      {
        error: 'Customer not found',
        message: 'Customer record not found for this user',
      },
      { status: 404 }
    );
  }

  // Verify tax partner exists
  const { data: taxPartner, error: taxPartnerError } = await supabase
    .from('tax_partner')
    .select('id, name, tax_license_number, is_active')
    .eq('id', taxPartnerId)
    .single();

  if (taxPartnerError || !taxPartner) {
    return NextResponse.json(
      {
        error: 'Tax partner not found',
        taxPartnerId,
      },
      { status: 404 }
    );
  }

  if (!taxPartner.is_active) {
    return NextResponse.json(
      {
        error: 'Tax partner not active',
        message: 'The selected tax partner is not currently active',
        taxPartnerId,
      },
      { status: 400 }
    );
  }

  // Validate documentUrl format (basic URL validation) - only if provided
  if (documentUrl) {
    try {
      new URL(documentUrl);
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid document URL',
          message: 'documentUrl must be a valid URL',
        },
        { status: 400 }
      );
    }
  }

  // Check for existing active POA with same tax partner
  const { data: existingPOA } = await supabase
    .from('power_of_attorney')
    .select('id, poa_number, status, valid_to')
    .eq('customer_id', customer.id)
    .eq('tax_partner_id', taxPartnerId)
    .in('status', ['ACTIVE', 'PENDING_SIGNATURE'])
    .single();

  if (existingPOA) {
    return NextResponse.json(
      {
        error: 'Active POA exists',
        message:
          'You already have an active or pending POA with this tax partner',
        existingPOA: {
          poaId: existingPOA.id,
          poaNumber: existingPOA.poa_number,
          status: existingPOA.status,
          validTo: existingPOA.valid_to,
        },
        action: 'REVOKE_EXISTING_POA',
      },
      { status: 409 }
    );
  }

  // Generate POA number
  const year = new Date().getFullYear();
  const poaNumber = `POA-${year}-${customer.id.substring(0, 8).toUpperCase()}-${Date.now()}`;

  // Create POA record
  const { data: poa, error: poaError } = await supabase
    .from('power_of_attorney')
    .insert({
      poa_number: poaNumber,
      customer_id: customer.id,
      tax_partner_id: taxPartnerId,
      scope,
      scope_details: scope === 'CUSTOM' ? customScope : null,
      valid_from: validFrom,
      valid_to: validTo,
      status: 'DRAFT',
      document_url: documentUrl || null, // Optional for DRAFT, required before signing
      notes,
    })
    .select(
      `
      id,
      poa_number,
      status,
      scope,
      valid_from,
      valid_to,
      created_at
    `
    )
    .single();

  if (poaError) {
    console.error('[POA_CREATE] Failed to create POA', {
      error: poaError,
      customerId: customer.id,
      taxPartnerId,
    });

    return NextResponse.json(
      {
        error: 'POA creation failed',
        message: poaError.message,
      },
      { status: 500 }
    );
  }

  // Create audit log
  await supabase.from('audit_log').insert({
    customer_id: customer.id,
    actor_user_id: session.userId,
    actor_organization_id: null, // Customer is not part of organization
    actor_role: session.role,
    activity_type: 'POA_CREATE',
    activity_details: {
      poaId: poa.id,
      poaNumber: poa.poa_number,
      taxPartnerId,
      scope,
      validFrom,
      validTo,
      documentUrl,
    },
    ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  });

  console.info('[POA_CREATE] POA created successfully', {
    poaId: poa.id,
    poaNumber: poa.poa_number,
    customerId: customer.id,
    taxPartnerId,
    scope,
  });

  // Build next steps based on whether document is uploaded
  const nextSteps = documentUrl
    ? [
        {
          step: 1,
          action: 'CUSTOMER_SIGN',
          description: 'Customer must sign the POA document',
        },
        {
          step: 2,
          action: 'ADVISOR_REVIEW',
          description: 'Tax Advisor will review the POA',
        },
        {
          step: 3,
          action: 'ADVISOR_SIGN',
          description: 'Tax Advisor will sign to activate POA',
        },
      ]
    : [
        {
          step: 1,
          action: 'UPLOAD_DOCUMENT',
          description: 'Upload the POA document',
        },
        {
          step: 2,
          action: 'CUSTOMER_SIGN',
          description: 'Customer must sign the POA document',
        },
        {
          step: 3,
          action: 'ADVISOR_REVIEW',
          description: 'Tax Advisor will review the POA',
        },
        {
          step: 4,
          action: 'ADVISOR_SIGN',
          description: 'Tax Advisor will sign to activate POA',
        },
      ];

  // Prepare response
  const response: POACreateResponse = {
    success: true,
    poaId: poa.id,
    poaNumber: poa.poa_number,
    status: 'DRAFT',
    customer: {
      customerId: customer.id,
      customerName:
        customer.customer_type === 'INDIVIDUAL'
          ? customer.full_name!
          : customer.company_name!,
      npwp: customer.npwp,
    },
    taxPartner: {
      taxPartnerId: taxPartner.id,
      organizationName: taxPartner.name,
    },
    scope: poa.scope,
    validFrom: poa.valid_from,
    validTo: poa.valid_to,
    documentUrl: documentUrl || undefined,
    createdAt: poa.created_at,
    nextSteps,
  };

  return NextResponse.json(response, { status: 201 });
}

/**
 * POST /api/poa/create
 *
 * Create Power of Attorney request
 *
 * MIDDLEWARE STACK (3 layers):
 * 1. requireAuth - Must be logged in
 * 2. requireRole - Only CUSTOMER allowed
 * 3. withAudit - Audit trail created
 *
 * Note: PLATFORM_ADMIN blocking not needed (POA is not tax data)
 * Platform admins cannot create POA anyway (not customers)
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('POA_CREATE')
  )(request as RequestWithSession, handler);
}
