import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const PatchSchema = z.object({
  currentStep: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  signedStatementsUploaded: z.boolean().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
});

async function ensureOwnedSession(sessionId: string, customerId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (error || !data) return null;
  if (data.customer_id !== customerId) return null;
  return data;
}

async function handleGet(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  const sb = getSupabaseAdmin();
  const [{ data: session, error: sErr }, { data: docs }, { data: adj }] = await Promise.all([
    sb.from('tax_closing_session').select('*').eq('id', sessionId).single(),
    sb.from('closing_document').select('*').eq('session_id', sessionId),
    sb.from('closing_adjustment_entry').select('*').eq('session_id', sessionId),
  ]);
  if (sErr) {
    return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    data: { session, documents: docs ?? [], adjustments: adj ?? [] },
  });
}

async function handlePatch(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.currentStep !== undefined) updates.current_step = parsed.data.currentStep;
  if (parsed.data.data !== undefined) updates.data = parsed.data.data;
  if (parsed.data.signedStatementsUploaded !== undefined) {
    updates.signed_statements_uploaded = parsed.data.signedStatementsUploaded;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('tax_closing_session')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();
  if (error) {
    loggers.api.error({ err: error }, 'closing-session patch failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth)(request as RequestWithSession, (r) => handleGet(r, id));
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_SESSION_PATCH'))(
    request as RequestWithSession,
    (r) => handlePatch(r, id)
  );
}
