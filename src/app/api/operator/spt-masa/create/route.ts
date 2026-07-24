/**
 * POST /api/operator/spt-masa/create
 *
 * Operator-initiated SPT Masa creation. The TAX_OPERATOR receives a customer
 * request in the AI chat inbox and can process it inline with one click.
 * Body: `{ customerId, taxType: 'PPh21'|'PPh23'|'PPN', period: 'YYYY-MM' }`
 *
 * Filing actor (product-identity 결정 ①): if the customer has an assigned
 * EXTERNAL consultant (active `customer_consultant`), that consultant is
 * recorded on `tax_filing.consultant_id`. For JTC operator-managed customers
 * there is no consultant (JTC 실무 = TAX_OPERATOR), so `consultant_id` is left
 * NULL (nullable since migration 20251223000029) and the OPERATOR is the actor,
 * recorded via the standard audit log (`withAudit('OPERATOR_CREATE_SPT_MASA')`)
 * and the response `actor.initiatorUserId`. HARD RULE #3 is preserved: the
 * operator is a JTC filing actor, never PLATFORM_ADMIN (blockPlatformAdmin gate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { SPTMasaCalculator } from '@/lib/tax';

interface Body {
  customerId?: string;
  taxType?: 'PPh21' | 'PPh23' | 'PPh42' | 'PPN';
  period?: string;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { customerId, taxType, period } = body;
  if (!customerId || !taxType || !period) {
    return NextResponse.json({ error: 'customerId, taxType, period required' }, { status: 400 });
  }
  if (!['PPh21', 'PPh23', 'PPh42', 'PPN'].includes(taxType)) {
    return NextResponse.json({ error: 'taxType must be PPh21, PPh23, PPh42, or PPN' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Resolve the consultant who will be recorded as the filing actor.
  // 1) Customer's assigned consultant (`customer_consultant`).
  let consultantId: string | null = null;
  let consultantName: string | null = null;
  {
    const { data: assignmentRow } = await admin
      .from('customer_consultant')
      .select('consultant_id')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const assignedId = (assignmentRow as { consultant_id: string } | null)?.consultant_id;
    if (assignedId) {
      const { data: c } = await admin
        .from('consultant')
        .select('id, full_name, is_active')
        .eq('id', assignedId)
        .eq('is_active', true)
        .maybeSingle();
      const cc = c as { id: string; full_name: string } | null;
      if (cc) { consultantId = cc.id; consultantName = cc.full_name; }
    }
  }
  // 2) (결정 ①) JTC operator-managed customers have no assigned consultant.
  //    Leave consultantId = null → the OPERATOR is the filing actor (recorded on
  //    the audit row + response actor below). No JTC-consultant fallback, no 500.

  // Verify the customer exists.
  const { data: customer } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp')
    .eq('id', customerId)
    .single();
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Compute SPT Masa (reuse the calculator the consultant endpoint uses).
  let sptMasaResult;
  try {
    if (taxType === 'PPh21') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh21Masa({ month: period, customerId });
    } else if (taxType === 'PPh23') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh23Masa({ month: period, customerId });
    } else if (taxType === 'PPh42') {
      sptMasaResult = await SPTMasaCalculator.calculatePPh42Masa({ month: period, customerId });
    } else {
      sptMasaResult = await SPTMasaCalculator.calculatePPNMasa({ month: period, customerId });
    }
  } catch (err) {
    loggers.tax.error({ err, customerId, taxType, period }, 'operator SPT Masa calc failed');
    return NextResponse.json({ error: 'SPT Masa calculation failed', message: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }

  // Insert/update the tax_filing row using the resolved consultant as the actor.
  const { data: existing } = await admin
    .from('tax_filing')
    .select('id')
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', period)
    .eq('status', 'DRAFT')
    .maybeSingle();

  let filingId: string | null = null;
  if (existing) {
    const { data: upd, error } = await admin
      .from('tax_filing')
      .update({
        consultant_id: consultantId,
        tax_data: { spt_masa_result: sptMasaResult },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: 'update failed', message: error.message }, { status: 500 });
    }
    filingId = upd?.id ?? null;
  } else {
    const { data: ins, error } = await admin
      .from('tax_filing')
      .insert({
        customer_id: customerId,
        consultant_id: consultantId,
        tax_type: taxType,
        tax_period: period,
        status: 'DRAFT',
        tax_data: { spt_masa_result: sptMasaResult },
      })
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: 'insert failed', message: error.message }, { status: 500 });
    }
    filingId = ins?.id ?? null;
  }

  // Mark any pending spt_masa_submission_request row as PROCESSED so the
  // customer page banner flips from 🟡 검토 중 → 🟢 완료 on next load.
  // No-op if the row doesn't exist or the table hasn't been migrated yet
  // (best-effort — operator action still succeeded).
  await admin
    .from('spt_masa_submission_request')
    .update({
      status: 'PROCESSED',
      processed_at: new Date().toISOString(),
      filing_id: filingId,
    })
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', period)
    .eq('status', 'PENDING');

  return NextResponse.json({
    success: true,
    filingId,
    customerId,
    taxType,
    period,
    actor: { consultantId, consultantName, initiatedBy: req.session.role, initiatorUserId: req.session.userId },
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
    // Reuse existing enum — operator-initiated filing still semantically a "filing submit" event.
    // The session.role on the audit row distinguishes operator vs consultant initiator.
    withAudit('TAX_FILING_SUBMIT'),
  )(request as RequestWithSession, handle);
}
