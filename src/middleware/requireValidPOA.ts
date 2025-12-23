import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RequestWithSession } from '@/types/auth';

/**
 * CRITICAL MIDDLEWARE
 *
 * Require Valid Power of Attorney (POA)
 *
 * Validates that customer has active POA with tax partner
 * before allowing tax filing operations.
 *
 * This is the PRIMARY POA check - executed BEFORE handler.
 *
 * HARD RULE #6: Tax filing requires active POA
 *
 * Validation Levels:
 * 1. Middleware (this) - PRIMARY CHECK ✓
 * 2. Handler - Business logic validation
 * 3. Database trigger - Final enforcement
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return composeMiddleware(
 *     requireAuth,
 *     blockPlatformAdmin,
 *     requireRole(UserRole.TAX_ADVISOR_JTC),
 *     requireValidPOA(),  // ← Validates POA before handler
 *     withAudit('TAX_FILING_SUBMIT')
 *   )(request, handler);
 * }
 */
export function requireValidPOA() {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    // Parse request body
    let body: any;
    try {
      const text = await request.text();
      body = JSON.parse(text);

      // Re-attach body to request for handler
      Object.defineProperty(request, 'body', {
        value: body,
        writable: false,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { customerId, taxType } = body;

    if (!customerId || !taxType) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          requiredFields: ['customerId', 'taxType'],
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

    // Get consultant's tax partner
    const { data: consultant, error: consultantError } = await supabase
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (consultantError || !consultant) {
      console.error('[POA] Consultant not found', {
        userId: session.userId,
        error: consultantError,
      });

      return NextResponse.json(
        {
          error: 'Consultant not found',
          message: 'User is not registered as an active consultant',
        },
        { status: 404 }
      );
    }

    // Check for active POA
    const today = new Date().toISOString().split('T')[0];

    const { data: poa, error: poaError } = await supabase
      .from('power_of_attorney')
      .select('id, poa_number, scope, valid_from, valid_to, status')
      .eq('customer_id', customerId)
      .eq('tax_partner_id', consultant.tax_partner_id)
      .eq('status', 'ACTIVE')
      .lte('valid_from', today)
      .gte('valid_to', today)
      .single();

    if (poaError || !poa) {
      console.warn('[POA] No active POA found', {
        customerId,
        taxPartnerId: consultant.tax_partner_id,
        taxType,
        error: poaError?.message,
      });

      return NextResponse.json(
        {
          error: 'No active Power of Attorney',
          message:
            'Customer must authorize Jakarta Tax Consulting via Power of Attorney before tax filing.',
          details: {
            customerId,
            taxPartnerId: consultant.tax_partner_id,
            taxType,
            requiredStatus: 'ACTIVE',
            requiredValidDate: today,
          },
          action: 'CREATE_POA',
          helpUrl: '/help/power-of-attorney',
        },
        { status: 400 }
      );
    }

    // Validate POA scope
    const validScopes = ['ALL_TAX_TYPES', `${taxType}_ONLY`, 'CUSTOM'];

    if (!validScopes.includes(poa.scope)) {
      console.warn('[POA] POA scope mismatch', {
        poaId: poa.id,
        poaScope: poa.scope,
        requiredScope: taxType,
      });

      return NextResponse.json(
        {
          error: 'POA scope mismatch',
          message: `Power of Attorney does not cover ${taxType}`,
          details: {
            poaNumber: poa.poa_number,
            poaScope: poa.scope,
            requiredScope: taxType,
            validScopes,
          },
          action: 'UPDATE_POA',
          helpUrl: '/help/power-of-attorney-scope',
        },
        { status: 400 }
      );
    }

    // Attach POA to request for handler use
    Object.defineProperty(request, 'poa', {
      value: poa,
      writable: false,
    });

    console.info('[POA] Validation successful', {
      poaId: poa.id,
      poaNumber: poa.poa_number,
      customerId,
      taxType,
      scope: poa.scope,
    });

    // Continue to handler
    return handler(request);
  };
}

/**
 * Extended request type with POA
 */
export interface RequestWithPOA extends RequestWithSession {
  poa: {
    id: string;
    poa_number: string;
    scope: string;
    valid_from: string;
    valid_to: string;
    status: string;
  };
  body: any;
}
