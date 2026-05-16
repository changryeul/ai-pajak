/**
 * GET  /api/consultant-erp/counterparty?q=&country=
 *   → 200 { rows }
 *
 * POST /api/consultant-erp/counterparty
 *   body: { npwp?, nib?, name, country?, kbli?, pkpStatus?, suggestedPph?,
 *           suggestedRate?, businessDescription?, aliases? }
 *   → 201 { id }
 *
 * Cross-tenant: any consultant/supervisor can read; writes require an active
 * consultant row (enforced by RLS migration 20260516000001).
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
import { searchCounterparties } from '@/lib/consultant-erp/counterparty-matcher';
import type { RequestWithSession } from '@/types/auth';

const createSchema = z.object({
  npwp: z.string().nullable().optional(),
  nib: z.string().nullable().optional(),
  name: z.string().min(1),
  country: z.string().length(2).default('ID'),
  kbli: z.string().nullable().optional(),
  pkpStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'NON_RESIDENT']).nullable().optional(),
  suggestedPph: z.string().nullable().optional(),
  suggestedRate: z.number().min(0).max(1).nullable().optional(),
  businessDescription: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
});

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const country = url.searchParams.get('country');
  const rows = await searchCounterparties({ q, country });
  return NextResponse.json({ success: true, data: { rows } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('counterparty_master')
    .insert({
      npwp: parsed.data.npwp ?? null,
      nib: parsed.data.nib ?? null,
      name: parsed.data.name,
      country: parsed.data.country,
      kbli: parsed.data.kbli ?? null,
      pkp_status: parsed.data.pkpStatus ?? null,
      suggested_pph_type: parsed.data.suggestedPph ?? null,
      suggested_tax_rate: parsed.data.suggestedRate ?? null,
      business_description: parsed.data.businessDescription ?? null,
      aliases: parsed.data.aliases ?? null,
      overall_trust: 60,
      registered_by: ctx.consultantId,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'NPWP already registered' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { id: data.id } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_COUNTERPARTY_CREATE'),
  )(request as unknown as RequestWithSession, handlePost);
}
