import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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
  documentId: string; // POA document upload
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
  documentId: string;
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
    documentId,
    notes,
  } = body;

  // Validation
  if (!taxPartnerId || !scope || !validFrom || !validTo || !documentId) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: [
          'taxPartnerId',
          'scope',
          'validFrom',
          'validTo',
          'documentId',
        ],
      },
      { status: 400 }
    );
  }

  // Validate dates
  const fromDate = new Date(validFrom);
  const toDate = new Date(validTo);
  const today = new Date();

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
    .select('id, organization_name, license_number, is_active')
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

  // Verify document exists and belongs to customer
  const { data: document, error: documentError } = await supabase
    .from('document')
    .select('id, customer_id, document_type, file_name')
    .eq('id', documentId)
    .eq('customer_id', customer.id)
    .single();

  if (documentError || !document) {
    return NextResponse.json(
      {
        error: 'Document not found',
        message: 'Document must be uploaded before creating POA',
        documentId,
      },
      { status: 404 }
    );
  }

  if (document.document_type !== 'POA_DRAFT') {
    return NextResponse.json(
      {
        error: 'Invalid document type',
        message: 'Document must be of type POA_DRAFT',
        actualType: document.document_type,
      },
      { status: 400 }
    );
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
      custom_scope: scope === 'CUSTOM' ? customScope : null,
      valid_from: validFrom,
      valid_to: validTo,
      status: 'DRAFT',
      document_id: documentId,
      customer_signed_at: null, // Not signed yet
      customer_signature: null,
      partner_signed_at: null,
      partner_signature: null,
      signed_by_advisor_id: null,
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
      documentId,
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
      organizationName: taxPartner.organization_name,
    },
    scope: poa.scope,
    validFrom: poa.valid_from,
    validTo: poa.valid_to,
    documentId,
    createdAt: poa.created_at,
    nextSteps: [
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
    ],
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
