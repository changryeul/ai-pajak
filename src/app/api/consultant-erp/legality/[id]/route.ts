/**
 * PATCH /api/consultant-erp/legality/:id
 *   body: { validUntil?: string|null, note?: string|null }
 *   → 200 { row }
 *
 * GET   /api/consultant-erp/legality/:id/download   (NOT here)
 *   handled in `download/route.ts` via Supabase signed URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import type { RequestWithSession } from '@/types/auth';

const patchSchema = z.object({
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/legality\/([^/]+)/);
  return m?.[1] ?? null;
}

async function ensureScope(opts: {
  documentId: string;
  taxPartnerId: string;
}): Promise<{ ok: true; customerId: string } | { ok: false; status: number; error: string }> {
  const admin = getSupabaseAdmin();
  const { data: doc } = await admin
    .from('legality_document')
    .select('id, customer_id')
    .eq('id', opts.documentId)
    .maybeSingle();
  if (!doc) return { ok: false, status: 404, error: 'Not found' };
  const { data: ccs } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('customer_id', doc.customer_id)
    .eq('is_active', true);
  if (!ccs || ccs.length === 0) return { ok: false, status: 403, error: 'No active assignment' };
  const consultantIds = ccs.map((c) => c.consultant_id);
  const { data: peers } = await admin
    .from('consultant')
    .select('id')
    .eq('tax_partner_id', opts.taxPartnerId)
    .in('id', consultantIds);
  if (!peers || peers.length === 0)
    return { ok: false, status: 403, error: 'Customer is not in your tax_partner' };
  return { ok: true, customerId: doc.customer_id };
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureScope({ documentId: id, taxPartnerId: ctx.taxPartnerId });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (parsed.data.validUntil !== undefined) patch.valid_until = parsed.data.validUntil;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note;
  const { data, error } = await admin
    .from('legality_document')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_LEGALITY_PATCH'),
  )(request as unknown as RequestWithSession, handlePatch);
}
