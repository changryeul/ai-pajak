/**
 * POST /api/consultant-erp/sessions/:id/calc
 *   body: { kind, input, consultantMemo?, save? }
 *   → 200 { calc }
 *
 * Runs the requested calc engine against the supplied input, stores the result
 * (one row per session × kind, upsert), and returns the computed amount + basis.
 *
 * GET /api/consultant-erp/sessions/:id/calc → list all calc rows for the session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  ensureSessionAccess,
  resolveConsultantContext,
} from '@/lib/consultant-erp/session-helpers';
import {
  calcEngineByKind,
  type CalcKind,
} from '@/lib/consultant-erp/calc-engine';
import type { RequestWithSession } from '@/types/auth';

const schema = z.object({
  kind: z.enum([
    'PPH21_TER',
    'WITHHOLDING_SUMMARY',
    'CORP_TAX_MONTHLY',
    'PPN_NET',
    'BANK_RECON',
  ]),
  input: z.record(z.string(), z.unknown()),
  consultantMemo: z.string().max(2000).nullable().optional(),
  save: z.boolean().optional().default(true),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/calc/);
  return m?.[1] ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { kind, input, consultantMemo, save } = parsed.data;

  // Run engine. Each engine has a slightly different input shape, but they all
  // accept Record<string, unknown> so we cast at the boundary.
  const fn = calcEngineByKind[kind as CalcKind];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (fn as (i: any) => ReturnType<typeof fn>)(input);

  if (!save) {
    return NextResponse.json({ success: true, data: { calc: result, saved: false } });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_session_calc')
    .upsert(
      {
        session_id: sessionId,
        kind,
        amount: result.amount,
        basis: result.basis,
        source_summary: result.sourceSummary,
        rationale_summary: result.rationaleSummary,
        confidence: result.confidence,
        consultant_memo: consultantMemo ?? null,
        is_saved: true,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,kind' },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Move session to step 3 if still earlier.
  await admin
    .from('consultant_session')
    .update({ current_step: 3, status: 'REVIEWING' })
    .eq('id', sessionId)
    .lt('current_step', 3);

  return NextResponse.json({ success: true, data: { calc: result, row: data } });
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_session_calc')
    .select('*')
    .eq('session_id', sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_CALC'),
  )(request as unknown as RequestWithSession, handlePost);
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
