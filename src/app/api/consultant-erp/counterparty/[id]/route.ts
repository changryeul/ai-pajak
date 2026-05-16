/**
 * GET   /api/consultant-erp/counterparty/:id
 *   → counterparty + per-field trust rows + recent update candidates
 * PATCH /api/consultant-erp/counterparty/:id
 *   body: same fields as POST. Triggers a soft trust bump on last_verified.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RequestWithSession } from '@/types/auth';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  npwp: z.string().nullable().optional(),
  nib: z.string().nullable().optional(),
  country: z.string().length(2).optional(),
  kbli: z.string().nullable().optional(),
  pkpStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'NON_RESIDENT']).nullable().optional(),
  suggestedPph: z.string().nullable().optional(),
  suggestedRate: z.number().min(0).max(1).nullable().optional(),
  businessDescription: z.string().nullable().optional(),
});

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/counterparty\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: master } = await admin
    .from('counterparty_master')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: trust } = await admin
    .from('counterparty_attribute_trust')
    .select('*')
    .eq('counterparty_id', id);
  const { data: candidates } = await admin
    .from('counterparty_update_candidate')
    .select('*')
    .eq('counterparty_id', id)
    .order('proposed_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ success: true, data: { master, trust, candidates } });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = { last_verified_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) {
    const dbKey =
      k === 'pkpStatus' ? 'pkp_status'
      : k === 'suggestedPph' ? 'suggested_pph_type'
      : k === 'suggestedRate' ? 'suggested_tax_rate'
      : k === 'businessDescription' ? 'business_description'
      : k;
    patch[dbKey] = v;
  }
  const { data, error } = await admin
    .from('counterparty_master')
    .update(patch)
    .eq('id', id)
    .select('id, overall_trust, last_verified_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_COUNTERPARTY_UPDATE'),
  )(request as unknown as RequestWithSession, handlePatch);
}
