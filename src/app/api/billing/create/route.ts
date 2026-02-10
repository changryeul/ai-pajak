import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';

/**
 * CRITICAL ENDPOINT - Billing Transaction Creation
 *
 * HARD RULES ENFORCED:
 * 1. ONLY SYSTEM role can create billing transactions
 * 2. Billing is tied to tax filing (not direct customer payment)
 * 3. Billing authority ≠ Tax filing authority
 * 4. All billing operations are audit logged
 * 5. PLATFORM_ADMIN cannot create billing transactions
 *
 * This endpoint is called by SYSTEM account (billing service) ONLY.
 * Human users (including platform admin) cannot create billing transactions.
 *
 * IMPORTANT: Billing service uses service role key, not user authentication.
 *
 * IDEMPOTENCY:
 * - Uses idempotency_key to prevent duplicate billing creation
 * - Same idempotency_key returns existing transaction (not error)
 * - Prevents double-billing due to network retries or service restarts
 * - Key format: "billing-{taxFilingId}-{timestamp}" or custom
 *
 * @route POST /api/billing/create
 */

interface BillingCreateRequest {
  idempotencyKey: string; // Prevent duplicate billing creation
  customerId: string;
  taxFilingId: string;
  taxPartnerId: string;
  serviceType:
    | 'TAX_FILING'
    | 'TAX_CONSULTATION'
    | 'DOCUMENT_PREPARATION'
    | 'ANNUAL_SUBSCRIPTION'
    | 'OTHER';
  description: string;
  amountBase: number; // Base service fee
  amountTax: number; // VAT (PPN 11%)
  amountTotal: number; // Total amount
  currency: 'IDR';
  billingPeriod?: string; // For subscription billing
  invoiceNumber?: string;
  dueDate: string; // YYYY-MM-DD
  metadata?: {
    [key: string]: unknown;
  };
}

interface BillingCreateResponse {
  success: boolean;
  transactionId: string;
  invoiceNumber: string;
  customer: {
    customerId: string;
  };
  taxPartner: {
    taxPartnerId: string;
  };
  taxFiling?: {
    taxFilingId: string;
    filingNumber: string;
  };
  billing: {
    serviceType: string;
    description: string;
    amountBase: number;
    amountTax: number;
    amountTotal: number;
    currency: string;
    dueDate: string;
  };
  payment: {
    status: 'PENDING';
    paymentUrl?: string;
  };
  createdAt: string;
  createdBy: 'SYSTEM';
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // CRITICAL: Only SYSTEM role can create billing
  if (session.role !== UserRole.SYSTEM) {
    console.error(
      '[BILLING] Unauthorized billing creation attempt',
      {
        userId: session.userId,
        role: session.role,
        timestamp: new Date().toISOString(),
      }
    );

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Only SYSTEM account can create billing transactions',
        detail:
          'Billing operations are restricted to automated billing service only.',
      },
      { status: 403 }
    );
  }

  // Parse request body
  const body = (await request.json()) as BillingCreateRequest;

  const {
    idempotencyKey,
    customerId,
    taxFilingId,
    taxPartnerId,
    serviceType,
    description,
    amountBase,
    amountTax,
    amountTotal,
    currency,
    billingPeriod,
    invoiceNumber,
    dueDate,
    metadata,
  } = body;

  // Validation
  if (
    !idempotencyKey ||
    !customerId ||
    !taxPartnerId ||
    !serviceType ||
    !description ||
    amountBase == null ||
    amountTax == null ||
    amountTotal == null ||
    !currency ||
    !dueDate
  ) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: [
          'idempotencyKey',
          'customerId',
          'taxPartnerId',
          'serviceType',
          'description',
          'amountBase',
          'amountTax',
          'amountTotal',
          'currency',
          'dueDate',
        ],
      },
      { status: 400 }
    );
  }

  // Validate amounts
  if (amountBase < 0 || amountTax < 0 || amountTotal < 0) {
    return NextResponse.json(
      {
        error: 'Invalid amounts',
        message: 'Amounts must be positive numbers',
      },
      { status: 400 }
    );
  }

  // Validate total calculation
  const expectedTotal = amountBase + amountTax;
  if (Math.abs(amountTotal - expectedTotal) > 0.01) {
    return NextResponse.json(
      {
        error: 'Amount mismatch',
        message: 'amountTotal must equal amountBase + amountTax',
        provided: amountTotal,
        expected: expectedTotal,
      },
      { status: 400 }
    );
  }

  // Validate currency
  if (currency !== 'IDR') {
    return NextResponse.json(
      {
        error: 'Invalid currency',
        message: 'Only IDR currency is supported',
        providedCurrency: currency,
      },
      { status: 400 }
    );
  }

  // Get Supabase client with service role key
  // CRITICAL: SYSTEM account uses service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // ← Service role key for SYSTEM
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // IDEMPOTENCY CHECK: Check if transaction with this idempotency key already exists
  const { data: existingTransaction } = await supabase
    .from('billing_transaction')
    .select(
      `
      id,
      invoice_number,
      service_type,
      description,
      amount_base,
      amount_tax,
      amount_total,
      currency,
      payment_status,
      due_date,
      created_at
    `
    )
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (existingTransaction) {
    console.info('[BILLING] Idempotent request - returning existing transaction', {
      idempotencyKey,
      existingTransactionId: existingTransaction.id,
      invoiceNumber: existingTransaction.invoice_number,
    });

    // Return existing transaction (not an error - this is idempotency working correctly)
    const response: BillingCreateResponse = {
      success: true,
      transactionId: existingTransaction.id,
      invoiceNumber: existingTransaction.invoice_number,
      customer: {
        customerId: customerId,
      },
      taxPartner: {
        taxPartnerId: taxPartnerId,
      },
      billing: {
        serviceType: existingTransaction.service_type,
        description: existingTransaction.description,
        amountBase: existingTransaction.amount_base,
        amountTax: existingTransaction.amount_tax,
        amountTotal: existingTransaction.amount_total,
        currency: existingTransaction.currency,
        dueDate: existingTransaction.due_date,
      },
      payment: {
        status: 'PENDING',
      },
      createdAt: existingTransaction.created_at,
      createdBy: 'SYSTEM',
    };

    return NextResponse.json(response, { status: 200 }); // 200 OK (not 201 Created)
  }

  // Verify customer exists
  const { data: customer, error: customerError } = await supabase
    .from('customer')
    .select('id, full_name, company_name, npwp')
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

  // Verify tax partner exists
  const { data: taxPartner, error: taxPartnerError } = await supabase
    .from('tax_partner')
    .select('id, name')
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

  // If tax filing specified, verify it exists
  interface TaxFilingData {
    id: string;
    customer_id: string;
    consultant: {
      tax_partner_id: string;
    };
  }
  let taxFiling: TaxFilingData | null = null;
  if (taxFilingId) {
    const { data: filing, error: filingError } = await supabase
      .from('tax_filing')
      .select('id, customer_id, consultant:consultant_id(tax_partner_id)')
      .eq('id', taxFilingId)
      .single();

    if (filingError || !filing) {
      return NextResponse.json(
        {
          error: 'Tax filing not found',
          taxFilingId,
        },
        { status: 404 }
      );
    }

    // Verify tax filing belongs to customer and tax partner
    if (filing.customer_id !== customerId) {
      return NextResponse.json(
        {
          error: 'Tax filing mismatch',
          message: 'Tax filing does not belong to specified customer',
          taxFilingCustomerId: filing.customer_id,
          providedCustomerId: customerId,
        },
        { status: 400 }
      );
    }

    // Get tax_partner_id through consultant relationship
    const consultantData = filing.consultant as unknown as { tax_partner_id: string } | { tax_partner_id: string }[];
    const taxPartnerIdFromFiling = Array.isArray(consultantData) ? consultantData[0]?.tax_partner_id : consultantData?.tax_partner_id;

    if (taxPartnerIdFromFiling !== taxPartnerId) {
      return NextResponse.json(
        {
          error: 'Tax filing mismatch',
          message: 'Tax filing does not belong to specified tax partner',
          taxFilingTaxPartnerId: taxPartnerIdFromFiling,
          providedTaxPartnerId: taxPartnerId,
        },
        { status: 400 }
      );
    }

    taxFiling = filing as TaxFilingData;
  }

  // Generate invoice number if not provided
  const finalInvoiceNumber =
    invoiceNumber || `INV-${new Date().getFullYear()}-${Date.now()}`;

  // Get platform owner ID (required for billing transaction)
  const { data: platformOwner } = await supabase
    .from('platform_owner')
    .select('id')
    .limit(1)
    .single();

  if (!platformOwner) {
    return NextResponse.json(
      {
        error: 'Platform owner not found',
        message: 'System configuration error',
      },
      { status: 500 }
    );
  }

  // Create billing transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('billing_transaction')
    .insert({
      idempotency_key: idempotencyKey, // Prevent duplicate billing
      customer_id: customerId,
      tax_partner_id: taxPartnerId,
      platform_owner_id: platformOwner.id,
      transaction_type: 'TAX_SERVICE',
      service_type: serviceType,
      description,
      amount_base: amountBase,
      amount_tax: amountTax,
      amount_total: amountTotal,
      platform_fee: 0,
      tax_service_fee: amountTotal,
      currency,
      invoice_number: finalInvoiceNumber,
      payment_status: 'PENDING',
      billing_period: billingPeriod || null,
      due_date: dueDate,
      metadata: taxFilingId ? { ...metadata, taxFilingId } : metadata,
    })
    .select(
      `
      id,
      invoice_number,
      service_type,
      description,
      amount_base,
      amount_tax,
      amount_total,
      currency,
      payment_status,
      due_date,
      created_at
    `
    )
    .single();

  if (transactionError) {
    console.error('[BILLING] Failed to create transaction', {
      error: transactionError,
      customerId,
      taxPartnerId,
    });

    return NextResponse.json(
      {
        error: 'Billing transaction creation failed',
        message: transactionError.message,
      },
      { status: 500 }
    );
  }

  // Create audit log
  // Note: SYSTEM account creates audit log with SYSTEM role
  await supabase.from('audit_log').insert({
    customer_id: customerId,
    actor_user_id: session.userId, // SYSTEM user ID
    actor_organization_id: null, // SYSTEM is not part of organization
    actor_role: 'SYSTEM',
    activity_type: 'BILLING_CREATE',
    activity_details: {
      transactionId: transaction.id,
      invoiceNumber: finalInvoiceNumber,
      serviceType,
      amountTotal,
      taxPartnerId,
      taxFilingId: taxFilingId || null,
    },
    ip_address: request.headers.get('x-forwarded-for') || 'system',
    user_agent: request.headers.get('user-agent') || 'billing-service',
  });

  console.info('[BILLING] Transaction created successfully', {
    transactionId: transaction.id,
    invoiceNumber: finalInvoiceNumber,
    customerId,
    taxPartnerId,
    amountTotal,
    taxFilingId: taxFilingId || null,
  });

  // Prepare response
  const response: BillingCreateResponse = {
    success: true,
    transactionId: transaction.id,
    invoiceNumber: transaction.invoice_number,
    customer: {
      customerId: customer.id,
    },
    taxPartner: {
      taxPartnerId: taxPartner.id,
    },
    billing: {
      serviceType: transaction.service_type,
      description: transaction.description,
      amountBase: transaction.amount_base,
      amountTax: transaction.amount_tax,
      amountTotal: transaction.amount_total,
      currency: transaction.currency,
      dueDate: transaction.due_date,
    },
    payment: {
      status: 'PENDING',
      paymentUrl: undefined, // Payment gateway integration would add URL here
    },
    createdAt: transaction.created_at,
    createdBy: 'SYSTEM',
  };

  // Add tax filing info if present
  if (taxFiling) {
    response.taxFiling = {
      taxFilingId: taxFiling.id,
      filingNumber: taxFiling.filing_number,
    };
  }

  return NextResponse.json(response, { status: 201 });
}

/**
 * POST /api/billing/create
 *
 * Create billing transaction (SYSTEM ONLY)
 *
 * MIDDLEWARE STACK (3 layers):
 * 1. requireAuth - Must be authenticated (service role key)
 * 2. requireRole - Only SYSTEM allowed
 * 3. withAudit - Audit trail created
 *
 * CRITICAL SECURITY:
 * - This endpoint should ONLY be accessible via internal service
 * - NEVER expose to public internet
 * - Use API gateway / internal network routing
 * - Service role key must be protected in secrets vault
 *
 * HARD RULE #2: Billing authority ≠ Tax filing authority
 * - Tax filing: TAX_ADVISOR_JTC
 * - Billing creation: SYSTEM
 * - These are separate operations with separate permissions
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.SYSTEM),
    withAudit('BILLING_CREATE')
  )(request as RequestWithSession, handler);
}
