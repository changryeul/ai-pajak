import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { customerSignPOA, getPOA } from '@/lib/services/poa-service';
import { loggers } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Customer Signs POA
 *
 * @route POST /api/poa/[id]/customer-sign
 *
 * Workflow Step 2:
 * 1. Customer creates POA (DRAFT)
 * 2. Customer signs POA (DRAFT -> PENDING_SIGNATURE) <-- This endpoint
 * 3. Tax Advisor reviews POA
 * 4. Tax Advisor signs POA (PENDING_SIGNATURE -> ACTIVE)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: poaId } = await params;

    // Parse body (may be empty for simple sign without signature upload)
    let body: { signatureUrl?: string } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is OK
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole || userRole.role !== 'CUSTOMER') {
      return NextResponse.json(
        { success: false, error: 'Only customers can sign as customer' },
        { status: 403 }
      );
    }

    // Validate input - signatureUrl is optional (digital signature)
    // If not provided, use placeholder indicating signed via platform
    const signatureUrl = body.signatureUrl || `digital-signature://customer/${user.id}/${Date.now()}`;

    // Get current POA
    const poa = await getPOA(poaId);

    if (!poa) {
      return NextResponse.json(
        { success: false, error: 'POA not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer || poa.customer_id !== customer.id) {
      return NextResponse.json(
        { success: false, error: 'You can only sign your own POA' },
        { status: 403 }
      );
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    // Sign the POA
    const signedPOA = await customerSignPOA(poaId, {
      signature_url: signatureUrl,
      ip_address: ipAddress,
    });

    // Log the activity
    await supabase.from('tax_activity_log').insert({
      customer_id: customer.id,
      actor_user_id: user.id,
      actor_role: 'CUSTOMER',
      activity_type: 'POA_SIGNED',
      activity_details: {
        poa_id: poaId,
        poa_number: signedPOA.poa_number,
        signer_role: 'CUSTOMER',
        old_status: 'DRAFT',
        new_status: 'PENDING_SIGNATURE',
        ip_address: ipAddress,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: signedPOA.id,
        poaNumber: signedPOA.poa_number,
        previousStatus: 'DRAFT',
        newStatus: 'PENDING_SIGNATURE',
        signedAt: signedPOA.customer_signed_at,
        nextSteps: [
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
        ],
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Customer sign POA error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign POA',
      },
      { status: 500 }
    );
  }
}
