/**
 * GET /api/tax/annual-closing/[id]/auto-credits
 *
 * Reads the tax_closing_session row, then aggregates PPh22/23/25/26 credits
 * from monthly source tables. The PPh25 closing wizard's credit step calls
 * this on entry to prefill the four input fields.
 *
 * Behavior:
 *   - UMKM regime returns all zeros + meta.skipped (UMKM = PPh Final 0.5%
 *     only — no credit concept).
 *   - PPH25 regime calls aggregateClosingCredits().
 *   - Ownership: customers see only their own session; consultants/operators
 *     can read any (RBAC handled by middleware).
 *
 * Audit: ANNUAL_CLOSING_AUTO_CREDITS_READ (one row per call).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { aggregateClosingCredits } from '@/lib/tax/annual-aggregator';
import { loggers } from '@/lib/logger';
import { UserRole } from '@/types/auth';
import type { RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession, sessionId: string): Promise<Response> {
  const sb = getSupabaseAdmin();

  // 1. Load the closing session
  const { data: session, error: sErr } = await sb
    .from('tax_closing_session')
    .select('id, customer_id, fiscal_year, closing_type')
    .eq('id', sessionId)
    .maybeSingle();

  if (sErr) {
    loggers.api.error({ err: sErr, sessionId }, 'auto-credits: session lookup failed');
    return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // 2. Customer-side ownership check (operators/consultants bypass).
  if (req.session?.role === UserRole.CUSTOMER) {
    let ownCustomerId = req.session?.customerId;
    if (!ownCustomerId && req.session?.userId) {
      const { data } = await sb
        .from('customer')
        .select('id')
        .eq('user_id', req.session.userId)
        .maybeSingle();
      ownCustomerId = data?.id;
    }
    if (!ownCustomerId || ownCustomerId !== session.customer_id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
  }

  // 3. UMKM regime has no credit concept — early return all zeros.
  if (session.closing_type === 'UMKM') {
    return NextResponse.json({
      success: true,
      data: {
        pph22: 0,
        pph23: 0,
        pph25: 0,
        pph26: 0,
        sources: {
          pph22: { table: 'tax_calculation', rowCount: 0 },
          pph23: { table: 'pph23_transaction', rowCount: 0 },
          pph25: { table: 'tax_monthly_payment', rowCount: 0 },
          pph26: { table: 'pph26_transaction', rowCount: 0 },
        },
        computedAt: new Date().toISOString(),
      },
      meta: { skipped: 'UMKM has no tax credits' },
    });
  }

  // 4. PPH25 regime — call the aggregator wrapper.
  try {
    const credits = await aggregateClosingCredits({
      customerId: session.customer_id,
      fiscalYear: session.fiscal_year,
    });
    return NextResponse.json({
      success: true,
      data: {
        ...credits,
        computedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    loggers.api.error({ err, sessionId }, 'auto-credits: aggregator failed');
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Aggregator failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.CUSTOMER,
      UserRole.CONSULTANT,
      UserRole.TAX_ADVISOR,
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
    withAudit('ANNUAL_CLOSING_AUTO_CREDITS_READ'),
  )(request as RequestWithSession, (r) => handleGet(r, id));
}
