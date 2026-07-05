import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { RequestWithSession } from '@/types/auth';
import { loggers } from '@/lib/logger';

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
 *     requireRole(UserRole.TAX_ADVISOR),
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
    interface RequestBody {
      customerId?: string;
      taxType?: string;
      [key: string]: unknown;
    }
    let body: RequestBody;
    try {
      const text = await request.text();
      body = JSON.parse(text) as RequestBody;

      // Re-attach body to request for handler
      Object.defineProperty(request, 'parsedBody', {
        value: body,
        writable: false,
      });
    } catch {
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

    // Get Supabase admin client (bypasses RLS)
    // SECURITY: Safe because:
    // 1. User authentication verified by requireAuth middleware
    // 2. User role verified by requireRole middleware
    // 3. We only query consultant/POA data, not performing mutations
    const supabase = createAdminClient();

    // Get consultant's tax partner
    const { data: consultant, error: consultantError } = await supabase
      .from('consultant')
      .select('id, tax_partner_id')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (consultantError || !consultant) {
      loggers.api.error({
        userId: session.userId,
        err: consultantError,
      }, 'POA consultant not found');

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

    const { data: poas, error: poaError } = await supabase
      .from('power_of_attorney')
      .select('id, poa_number, scope, valid_from, valid_to, status')
      .eq('customer_id', customerId)
      .eq('tax_partner_id', consultant.tax_partner_id)
      .eq('status', 'ACTIVE')
      .lte('valid_from', today)
      .gte('valid_to', today)
      .limit(1);

    // Get the first matching POA (multiple active POAs may exist)
    const poa = poas?.[0];

    if (poaError || !poa) {
      loggers.api.warn({
        customerId,
        taxPartnerId: consultant.tax_partner_id,
        taxType,
        err: poaError,
      }, 'No active POA found');

      return NextResponse.json(
        {
          error: 'No active Power of Attorney',
          message:
            'Customer must authorize the tax consulting firm via Power of Attorney before tax filing.',
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
      loggers.api.warn({
        poaId: poa.id,
        poaScope: poa.scope,
        requiredScope: taxType,
      }, 'POA scope mismatch');

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

    loggers.api.info({
      poaId: poa.id,
      poaNumber: poa.poa_number,
      customerId,
      taxType,
      scope: poa.scope,
    }, 'POA validation successful');

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
  parsedBody: Record<string, unknown>;
}
