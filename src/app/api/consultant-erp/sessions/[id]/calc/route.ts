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
  // 4-값 분리 (v13 §4): 고객 입력값 / 상담원 처리값. AI 계산값은 엔진 산출,
  // 최종 승인값은 APPROVE 시 스탬프. consultantAmount 를 null 로 보내면
  // 상담원 수정 철회 (AI 값 채택).
  customerInputAmount: z.number().nonnegative().nullable().optional(),
  consultantAmount: z.number().nonnegative().nullable().optional(),
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
  const { kind, input, consultantMemo, customerInputAmount, consultantAmount, save } = parsed.data;

  // Run engine. Each engine has a slightly different input shape, but they all
  // accept Record<string, unknown> so we cast at the boundary.
  const fn = calcEngineByKind[kind as CalcKind];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (fn as (i: any) => ReturnType<typeof fn>)(input);

  if (!save) {
    return NextResponse.json({ success: true, data: { calc: result, saved: false } });
  }

  // amount = 유효값 (상담원 처리값이 있으면 그 값, 없으면 AI 계산값).
  // 재계산 시 approved_amount 는 초기화 — 승인 후 값이 바뀌면 재승인 대상.
  const effectiveAmount = consultantAmount ?? result.amount;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('consultant_session_calc')
    .upsert(
      {
        session_id: sessionId,
        kind,
        amount: effectiveAmount,
        ai_amount: result.amount,
        consultant_amount: consultantAmount ?? null,
        customer_input_amount: customerInputAmount ?? null,
        approved_amount: null,
        approved_at: null,
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

// PATCH — 계산 재실행 없이 4-값 중 상담원 처리값/고객 입력값만 조정 (v13 §4).
// body: { kind, consultantAmount?: number|null, customerInputAmount?: number|null }
// consultantAmount=null → 상담원 수정 철회(AI 값 채택). amount(유효값) 동기화 +
// 값이 바뀌므로 approved_amount 초기화.
const adjustSchema = z.object({
  kind: z.enum(['PPH21_TER', 'WITHHOLDING_SUMMARY', 'CORP_TAX_MONTHLY', 'PPN_NET', 'BANK_RECON']),
  consultantAmount: z.number().nonnegative().nullable().optional(),
  customerInputAmount: z.number().nonnegative().nullable().optional(),
}).refine(d => d.consultantAmount !== undefined || d.customerInputAmount !== undefined, {
  message: 'consultantAmount or customerInputAmount required',
});

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({ userId: req.session.userId, role: req.session.role });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });
  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = adjustSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { kind, consultantAmount, customerInputAmount } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from('consultant_session_calc')
    .select('id, ai_amount, amount')
    .eq('session_id', sessionId)
    .eq('kind', kind)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Calc row not found — run the engine first' }, { status: 404 });

  const patch: Record<string, unknown> = { approved_amount: null, approved_at: null };
  if (consultantAmount !== undefined) {
    patch.consultant_amount = consultantAmount;
    patch.amount = consultantAmount ?? row.ai_amount ?? row.amount;
  }
  if (customerInputAmount !== undefined) patch.customer_input_amount = customerInputAmount;

  const { data, error } = await admin
    .from('consultant_session_calc')
    .update(patch)
    .eq('id', row.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
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

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('CONSULTANT_ERP_CALC_ADJUST'),
  )(request as unknown as RequestWithSession, handlePatch);
}
