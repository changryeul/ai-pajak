import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { advisorSignPOA, getPOA } from '@/lib/services/poa-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Tax Advisor Signs POA
 *
 * @route POST /api/poa/[id]/advisor-sign
 *
 * Workflow Step 4:
 * 1. Customer creates POA (DRAFT)
 * 2. Customer signs POA (DRAFT -> PENDING_SIGNATURE)
 * 3. Tax Advisor reviews POA
 * 4. Tax Advisor signs POA (PENDING_SIGNATURE -> ACTIVE) <-- This endpoint
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

    if (!userRole || userRole.role !== 'TAX_ADVISOR_JTC') {
      return NextResponse.json(
        { success: false, error: 'Only tax advisors can sign as tax partner' },
        { status: 403 }
      );
    }

    // Validate input - signatureUrl is optional (digital signature)
    // If not provided, use placeholder indicating signed via platform
    const signatureUrl = body.signatureUrl || `digital-signature://advisor/${user.id}/${Date.now()}`;

    // Get current POA
    const poa = await getPOA(poaId);

    if (!poa) {
      return NextResponse.json(
        { success: false, error: 'POA not found' },
        { status: 404 }
      );
    }

    // Get consultant info and verify they work for the tax partner
    const { data: consultant } = await supabase
      .from('consultant')
      .select('id, full_name, tax_partner_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!consultant) {
      return NextResponse.json(
        { success: false, error: 'Tax advisor record not found' },
        { status: 404 }
      );
    }

    if (consultant.tax_partner_id !== poa.tax_partner_id) {
      return NextResponse.json(
        { success: false, error: 'You can only sign POAs for your tax partner' },
        { status: 403 }
      );
    }

    // Sign the POA
    const signedPOA = await advisorSignPOA(poaId, {
      signature_url: signatureUrl,
      signed_by_user_id: user.id,
    });

    // Log the activity
    await supabase.from('tax_activity_log').insert({
      customer_id: poa.customer_id,
      actor_user_id: user.id,
      actor_organization_id: consultant.tax_partner_id,
      actor_role: 'TAX_ADVISOR_JTC',
      activity_type: 'POA_ACTIVATED',
      activity_details: {
        poa_id: poaId,
        poa_number: signedPOA.poa_number,
        signer_role: 'TAX_ADVISOR_JTC',
        signer_name: consultant.full_name,
        old_status: 'PENDING_SIGNATURE',
        new_status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: signedPOA.id,
        poaNumber: signedPOA.poa_number,
        previousStatus: 'PENDING_SIGNATURE',
        newStatus: 'ACTIVE',
        signedAt: signedPOA.tax_partner_signed_at,
        signedBy: {
          userId: user.id,
          name: consultant.full_name,
        },
        validFrom: signedPOA.valid_from,
        validTo: signedPOA.valid_to,
        message: 'POA is now active. Tax filing services can now be performed.',
      },
    });
  } catch (error) {
    console.error('Advisor sign POA error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign POA',
      },
      { status: 500 }
    );
  }
}
