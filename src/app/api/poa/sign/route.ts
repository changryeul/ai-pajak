import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';

/**
 * Power of Attorney (POA) Signing Endpoint
 *
 * HARD RULES ENFORCED:
 * 1. CUSTOMER signs first (status: DRAFT → PENDING_SIGNATURE)
 * 2. TAX_ADVISOR_JTC signs second (status: PENDING_SIGNATURE → ACTIVE)
 * 3. Only assigned tax advisor can sign for tax partner
 * 4. POA becomes ACTIVE only after both signatures
 * 5. All signing actions are audit logged
 *
 * This is Step 2/4 of POA workflow:
 * 1. Customer creates POA
 * 2. Customer signs POA (this endpoint, role: CUSTOMER)
 * 3. Tax Advisor reviews POA
 * 4. Tax Advisor signs POA (this endpoint, role: TAX_ADVISOR_JTC)
 *
 * @route POST /api/poa/sign
 */

interface POASignRequest {
  poaId: string;
  signatureData: string; // Base64 signature image or digital signature token
  signatureMethod: 'DIGITAL' | 'ELECTRONIC' | 'WET_SCAN';
}

interface POASignResponse {
  success: boolean;
  poaId: string;
  poaNumber: string;
  previousStatus: string;
  newStatus: string;
  signer: {
    role: string;
    userId: string;
    signerName: string;
  };
  signedAt: string;
  poa: {
    customer: {
      customerId: string;
      customerName: string;
      npwp: string | null;
      signedAt: string | null;
    };
    taxPartner: {
      taxPartnerId: string;
      organizationName: string;
      signedAt: string | null;
      signedByAdvisorId: string | null;
    };
    scope: string;
    validFrom: string;
    validTo: string;
  };
  nextSteps?: {
    step: number;
    action: string;
    description: string;
  }[];
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // Parse request body
  const body = (await request.json()) as POASignRequest;

  const { poaId, signatureData, signatureMethod } = body;

  // Validation
  if (!poaId || !signatureData || !signatureMethod) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: ['poaId', 'signatureData', 'signatureMethod'],
      },
      { status: 400 }
    );
  }

  // Get Supabase client (supports both cookie-based and token-based auth)
  const supabase = await createClient();

  // Get POA with related data
  const { data: poa, error: poaError } = await supabase
    .from('power_of_attorney')
    .select(
      `
      id,
      poa_number,
      customer_id,
      tax_partner_id,
      scope,
      valid_from,
      valid_to,
      status,
      customer_signed_at,
      customer_signature_url,
      tax_partner_signed_at,
      tax_partner_signature_url,
      tax_partner_signed_by_user_id,
      customer:customer_id (
        id,
        user_id,
        full_name,
        company_name,
        npwp,
        customer_type
      ),
      tax_partner:tax_partner_id (
        id,
        name,
        tax_license_number
      )
    `
    )
    .eq('id', poaId)
    .single();

  if (poaError || !poa) {
    return NextResponse.json(
      {
        error: 'POA not found',
        poaId,
      },
      { status: 404 }
    );
  }

  const previousStatus = poa.status;
  let newStatus = poa.status;
  let signerName = '';

  // Define types for POA data
  interface CustomerData {
    id: string;
    user_id: string;
    full_name: string;
    company_name: string | null;
    npwp: string | null;
    customer_type: 'INDIVIDUAL' | 'COMPANY';
  }
  interface TaxPartnerData {
    id: string;
    name: string;
    tax_license_number: string;
  }

  // Handle CUSTOMER signing
  if (session.role === UserRole.CUSTOMER) {
    // Verify customer owns this POA
    const customerData = poa.customer as CustomerData | CustomerData[];
    const customer = Array.isArray(customerData) ? customerData[0] : customerData;
    if (customer.user_id !== session.userId) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You can only sign your own POA',
          poaId,
        },
        { status: 403 }
      );
    }

    // Check POA status
    if (poa.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: 'Invalid POA status',
          message: `POA must be in DRAFT status for customer to sign (current: ${poa.status})`,
          currentStatus: poa.status,
        },
        { status: 400 }
      );
    }

    // Check if already signed
    if (poa.customer_signed_at) {
      return NextResponse.json(
        {
          error: 'Already signed',
          message: 'You have already signed this POA',
          signedAt: poa.customer_signed_at,
        },
        { status: 400 }
      );
    }

    // Update POA with customer signature
    const { error: updateError } = await supabase
      .from('power_of_attorney')
      .update({
        customer_signed_at: new Date().toISOString(),
        customer_signature_url: signatureData,
        status: 'PENDING_SIGNATURE', // Waiting for tax advisor signature
        updated_at: new Date().toISOString(),
      })
      .eq('id', poaId);

    if (updateError) {
      console.error('[POA_SIGN] Failed to update POA', {
        error: updateError,
        poaId,
      });

      return NextResponse.json(
        {
          error: 'Signature failed',
          message: updateError.message,
        },
        { status: 500 }
      );
    }

    newStatus = 'PENDING_SIGNATURE';
    signerName =
      customer.customer_type === 'INDIVIDUAL'
        ? customer.full_name
        : customer.company_name || customer.full_name;
  }
  // Handle TAX_ADVISOR_JTC signing
  else if (session.role === UserRole.TAX_ADVISOR_JTC) {
    // Get tax advisor information
    const { data: advisor, error: advisorError } = await supabase
      .from('consultant')
      .select('id, full_name, tax_partner_id')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (advisorError || !advisor) {
      return NextResponse.json(
        {
          error: 'Tax advisor not found',
          message: 'Active tax advisor record not found for this user',
        },
        { status: 404 }
      );
    }

    // Verify advisor works for the tax partner
    if (advisor.tax_partner_id !== poa.tax_partner_id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You can only sign POA for your tax partner',
          yourTaxPartnerId: advisor.tax_partner_id,
          poaTaxPartnerId: poa.tax_partner_id,
        },
        { status: 403 }
      );
    }

    // Check POA status
    if (poa.status !== 'PENDING_SIGNATURE') {
      return NextResponse.json(
        {
          error: 'Invalid POA status',
          message: `POA must be in PENDING_SIGNATURE status for advisor to sign (current: ${poa.status})`,
          currentStatus: poa.status,
        },
        { status: 400 }
      );
    }

    // Check if customer has signed
    if (!poa.customer_signed_at) {
      return NextResponse.json(
        {
          error: 'Customer signature required',
          message: 'Customer must sign POA before tax advisor can sign',
        },
        { status: 400 }
      );
    }

    // Check if already signed
    if (poa.tax_partner_signed_at) {
      return NextResponse.json(
        {
          error: 'Already signed',
          message: 'Tax partner has already signed this POA',
          signedAt: poa.tax_partner_signed_at,
          signedBy: poa.tax_partner_signed_by_user_id,
        },
        { status: 400 }
      );
    }

    // Update POA with tax partner signature
    // Note: We need user ID, not consultant ID for tax_partner_signed_by_user_id
    const { error: updateError } = await supabase
      .from('power_of_attorney')
      .update({
        tax_partner_signed_at: new Date().toISOString(),
        tax_partner_signature_url: signatureData,
        tax_partner_signed_by_user_id: session.userId, // User ID, not consultant ID
        status: 'ACTIVE', // POA is now active!
        updated_at: new Date().toISOString(),
      })
      .eq('id', poaId);

    if (updateError) {
      console.error('[POA_SIGN] Failed to update POA', {
        error: updateError,
        poaId,
      });

      return NextResponse.json(
        {
          error: 'Signature failed',
          message: updateError.message,
        },
        { status: 500 }
      );
    }

    newStatus = 'ACTIVE';
    signerName = advisor.full_name;
  } else {
    return NextResponse.json(
      {
        error: 'Unauthorized role',
        message: 'Only CUSTOMER or TAX_ADVISOR_JTC can sign POA',
        yourRole: session.role,
      },
      { status: 403 }
    );
  }

  // Get updated POA data
  const { data: updatedPOA } = await supabase
    .from('power_of_attorney')
    .select(
      `
      customer_signed_at,
      tax_partner_signed_at,
      tax_partner_signed_by_user_id
    `
    )
    .eq('id', poaId)
    .single();

  // Create audit log
  await supabase.from('audit_log').insert({
    customer_id: poa.customer_id,
    actor_user_id: session.userId,
    actor_organization_id:
      session.role === UserRole.TAX_ADVISOR_JTC ? poa.tax_partner_id : null,
    actor_role: session.role,
    activity_type: 'POA_SIGN',
    activity_details: {
      poaId,
      poaNumber: poa.poa_number,
      signerRole: session.role,
      previousStatus,
      newStatus,
      signatureMethod,
    },
    ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  });

  console.info('[POA_SIGN] POA signed successfully', {
    poaId,
    poaNumber: poa.poa_number,
    signerRole: session.role,
    previousStatus,
    newStatus,
  });

  // Prepare response
  const customerData = poa.customer as CustomerData | CustomerData[];
  const customer = Array.isArray(customerData) ? customerData[0] : customerData;
  const taxPartnerData = poa.tax_partner as TaxPartnerData | TaxPartnerData[];
  const taxPartner = Array.isArray(taxPartnerData) ? taxPartnerData[0] : taxPartnerData;

  const response: POASignResponse = {
    success: true,
    poaId: poa.id,
    poaNumber: poa.poa_number,
    previousStatus,
    newStatus,
    signer: {
      role: session.role,
      userId: session.userId,
      signerName,
    },
    signedAt: new Date().toISOString(),
    poa: {
      customer: {
        customerId: customer.id,
        customerName:
          customer.customer_type === 'INDIVIDUAL'
            ? customer.full_name
            : customer.company_name || customer.full_name,
        npwp: customer.npwp,
        signedAt: updatedPOA?.customer_signed_at || null,
      },
      taxPartner: {
        taxPartnerId: taxPartner.id,
        organizationName: taxPartner.name,
        signedAt: updatedPOA?.tax_partner_signed_at || null,
        signedByAdvisorId: updatedPOA?.tax_partner_signed_by_user_id || null,
      },
      scope: poa.scope,
      validFrom: poa.valid_from,
      validTo: poa.valid_to,
    },
  };

  // Add next steps if not yet active
  if (newStatus === 'PENDING_SIGNATURE') {
    response.nextSteps = [
      {
        step: 1,
        action: 'ADVISOR_REVIEW',
        description: 'Tax Advisor will review the POA',
      },
      {
        step: 2,
        action: 'ADVISOR_SIGN',
        description: 'Tax Advisor will sign to activate POA',
      },
    ];
  }

  return NextResponse.json(response, { status: 200 });
}

/**
 * POST /api/poa/sign
 *
 * Sign Power of Attorney
 *
 * MIDDLEWARE STACK (3 layers):
 * 1. requireAuth - Must be logged in
 * 2. requireRole - CUSTOMER or TAX_ADVISOR_JTC allowed
 * 3. withAudit - Audit trail created
 *
 * Note: Same endpoint handles both customer and tax advisor signatures
 * Logic inside handler determines which signature to apply based on role
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER, UserRole.TAX_ADVISOR_JTC),
    withAudit('POA_SIGN')
  )(request as RequestWithSession, handler);
}
