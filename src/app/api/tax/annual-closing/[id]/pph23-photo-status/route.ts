/**
 * GET /api/tax/annual-closing/[id]/pph23-photo-status
 *
 * Reads the tax_closing_session row, queries pph23_transaction rows in that
 * fiscal year, computes attached/missing counts, and groups by counterparty
 * (NPWP-preferred, name fallback, 'UNKNOWN' for null). The PPh25 closing
 * wizard's collect step renders a warning panel based on this data so the
 * user can see which PPh23 transactions are missing invoice photo evidence
 * before they finalize the closing.
 *
 * Behavior:
 *   - warning only — closing is allowed even when sales without photos.
 *   - Ownership: customers see only their own session; consultants/operators
 *     can read any (RBAC handled by middleware).
 *   - top 50 counterparties returned (sorted by missing desc) — UI caps render.
 *
 * Audit: ANNUAL_CLOSING_PPH23_PHOTO_STATUS_READ (one row per call).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole } from '@/types/auth';
import type { RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession, sessionId: string): Promise<Response> {
  const sb = getSupabaseAdmin();

  // 1. Load the closing session
  const { data: session, error: sErr } = await sb
    .from('tax_closing_session')
    .select('id, customer_id, fiscal_year')
    .eq('id', sessionId)
    .maybeSingle();

  if (sErr) {
    loggers.api.error({ err: sErr, sessionId }, 'pph23-photo-status: session lookup failed');
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

  // 3. PPh23 transactions in fiscal year (tax_period is YYYY-MM string).
  const periodStart = `${session.fiscal_year}-01`;
  const periodEnd = `${session.fiscal_year}-12`;

  const { data: txs, error: txErr } = await sb
    .from('pph23_transaction')
    .select('id, counterparty_name, counterparty_npwp, gross_amount, tax_amount, invoice_document_id, tax_period')
    .eq('customer_id', session.customer_id)
    .gte('tax_period', periodStart)
    .lte('tax_period', periodEnd);

  if (txErr) {
    loggers.api.error({ err: txErr, sessionId }, 'pph23-photo-status: tx query failed');
    return NextResponse.json({ success: false, error: txErr.message }, { status: 500 });
  }

  const rows = txs ?? [];
  const total = rows.length;
  const attached = rows.filter((r) => r.invoice_document_id != null).length;
  const missing = total - attached;

  // 4. Group by counterparty (NPWP preferred → name → 'UNKNOWN').
  type Group = { name: string; npwp: string | null; total: number; attached: number; missingAmount: number };
  const byCounterparty = new Map<string, Group>();
  for (const r of rows) {
    const key = r.counterparty_npwp ?? r.counterparty_name ?? 'UNKNOWN';
    let g = byCounterparty.get(key);
    if (!g) {
      g = {
        name: r.counterparty_name ?? key,
        npwp: r.counterparty_npwp ?? null,
        total: 0,
        attached: 0,
        missingAmount: 0,
      };
      byCounterparty.set(key, g);
    }
    g.total++;
    if (r.invoice_document_id) g.attached++;
    else g.missingAmount += Number(r.gross_amount ?? 0);
  }

  const counterparties = Array.from(byCounterparty.values())
    .map((g) => ({ ...g, missing: g.total - g.attached }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 50);

  return NextResponse.json({
    success: true,
    data: {
      total,
      attached,
      missing,
      attachedPct: total > 0 ? Math.round((attached / total) * 100) : 100,
      counterparties,
      computedAt: new Date().toISOString(),
    },
  });
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
    withAudit('ANNUAL_CLOSING_PPH23_PHOTO_STATUS_READ'),
  )(request as RequestWithSession, (r) => handleGet(r, id));
}
