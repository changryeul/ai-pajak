import { NextRequest, NextResponse } from 'next/server';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
import type { OverrideRuleRow } from '@/lib/tax/tax-resolution-engine';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { TransactionContext } from '@/types';

/**
 * POST /api/tax/resolve
 *
 * Resolves the applicable tax type and rate for a transaction
 * based on vendor profile, service type, qualification, and residency.
 *
 * Returns the resolved tax type, rate, amount, and legal basis
 * with full reasoning for the determination.
 */
async function handleResolve(req: RequestWithSession): Promise<Response> {
  const body = await req.json();

  const {
    grossAmount,
    transactionDate,
    description,
    serviceCategory,
    kbliCode,
    constructionType,
    qualification,
    recipientType,
    recipientNpwp,
    recipientCountry,
    hasCertificateOfDomicile,
    isRelatedParty,
    vendorIsPropertyOwner,
    // Phase 3 fields
    recipientIsEntity,
    shareholdingPct,
    isBeneficialOwner,
    receivesReinvestedDividend,
    hasDgtForm,
    rentalAssetType,
    interestSource,
  } = body as Partial<TransactionContext>;

  // Validate required fields
  if (!grossAmount || grossAmount <= 0) {
    return NextResponse.json(
      { error: 'grossAmount must be a positive number' },
      { status: 400 }
    );
  }
  if (!serviceCategory) {
    return NextResponse.json(
      { error: 'serviceCategory is required', validValues: ['EMPLOYMENT', 'SERVICE', 'RENTAL', 'CONSTRUCTION', 'DIVIDEND', 'INTEREST', 'ROYALTY', 'IMPORT', 'SHIPPING', 'OTHER'] },
      { status: 400 }
    );
  }
  if (!recipientType) {
    return NextResponse.json(
      { error: 'recipientType is required', validValues: ['RESIDENT', 'NON_RESIDENT'] },
      { status: 400 }
    );
  }

  const ctx: TransactionContext = {
    grossAmount,
    transactionDate: transactionDate || new Date().toISOString().split('T')[0],
    description,
    serviceCategory,
    kbliCode,
    constructionType,
    qualification,
    recipientType,
    recipientNpwp,
    recipientCountry,
    hasCertificateOfDomicile,
    isRelatedParty,
    vendorIsPropertyOwner,
    // Phase 3
    recipientIsEntity,
    shareholdingPct,
    isBeneficialOwner,
    receivesReinvestedDividend,
    hasDgtForm,
    rentalAssetType,
    interestSource,
  };

  // Load DB override rules
  let dbRules: OverrideRuleRow[] = [];
  try {
    const { data } = await getSupabaseAdmin()
      .from('tax_override_rule')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    dbRules = (data || []) as OverrideRuleRow[];
  } catch { /* fallback to hardcoded rules */ }

  const resolution = dbRules.length > 0
    ? TaxResolutionEngine.resolveWithOverrides(ctx, dbRules)
    : TaxResolutionEngine.resolve(ctx);

  return NextResponse.json({
    success: true,
    data: {
      input: ctx,
      resolution,
    },
  });
}

// Allow both tax consultants AND platform admin (for rule testing)
// No blockPlatformAdmin — this is a read-only calculation, not tax data access
export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth)(request as RequestWithSession, handleResolve);
}
