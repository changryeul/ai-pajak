/**
 * POST   /api/consultant-erp/counterparty/:id/candidates
 *   body: { proposedPayload, evidenceSessionId?, evidenceDocumentId? }
 *   → 201 { id }
 *
 * PATCH  /api/consultant-erp/counterparty/:id/candidates
 *   body: { candidateId, action: 'APPROVE' | 'REJECT' }
 *   → 200; on APPROVE, merges proposedPayload into the master row.
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

const createSchema = z.object({
  proposedPayload: z.record(z.string(), z.unknown()),
  evidenceSessionId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID").nullable().optional(),
  evidenceDocumentId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID").nullable().optional(),
});

const patchSchema = z.object({
  candidateId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID"),
  action: z.enum(['APPROVE', 'REJECT']),
});

function getCounterpartyId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/counterparty\/([^/]+)\/candidates/);
  return m?.[1] ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const cid = getCounterpartyId(req as unknown as NextRequest);
  if (!cid) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('counterparty_update_candidate')
    .insert({
      counterparty_id: cid,
      proposed_payload: parsed.data.proposedPayload,
      evidence_session_id: parsed.data.evidenceSessionId ?? null,
      evidence_document_id: parsed.data.evidenceDocumentId ?? null,
      proposed_by: req.session.userId,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: cand } = await admin
    .from('counterparty_update_candidate')
    .select('*')
    .eq('id', parsed.data.candidateId)
    .single();
  if (!cand) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  if (parsed.data.action === 'APPROVE') {
    // Merge proposed_payload onto the master row.
    const payload = cand.proposed_payload as Record<string, unknown>;
    const patch: Record<string, unknown> = { last_verified_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(payload)) {
      const dbKey =
        k === 'pkpStatus' ? 'pkp_status'
        : k === 'suggestedPph' ? 'suggested_pph_type'
        : k === 'suggestedRate' ? 'suggested_tax_rate'
        : k === 'businessDescription' ? 'business_description'
        : k;
      patch[dbKey] = v;
    }
    if (cand.counterparty_id) {
      await admin.from('counterparty_master').update(patch).eq('id', cand.counterparty_id);
    }
  }
  await admin
    .from('counterparty_update_candidate')
    .update({
      status: parsed.data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewed_by: req.session.userId,
    })
    .eq('id', parsed.data.candidateId);
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_COUNTERPARTY_CANDIDATE'),
  )(request as unknown as RequestWithSession, handlePost);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_COUNTERPARTY_CANDIDATE_REVIEW'),
  )(request as unknown as RequestWithSession, handlePatch);
}
