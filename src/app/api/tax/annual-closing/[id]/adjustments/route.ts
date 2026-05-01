import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const EntrySchema = z.object({
  direction: z.enum(['POSITIVE', 'NEGATIVE']),
  itemCode: z.string().min(1).max(64),
  amount: z.number().nonnegative(),
  capPct: z.number().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

const PutSchema = z.object({
  entries: z.array(EntrySchema).max(64),
});

async function ensureOwnedSession(sessionId: string, customerId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('tax_closing_session')
    .select('id, customer_id')
    .eq('id', sessionId)
    .single();
  if (!data || data.customer_id !== customerId) return null;
  return data;
}

async function handlePut(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  // Replace-all: simpler than diff and adjustment count is small.
  const { error: delErr } = await sb
    .from('closing_adjustment_entry')
    .delete()
    .eq('session_id', sessionId);
  if (delErr) {
    loggers.api.error({ err: delErr }, 'closing adjustment clear failed');
    return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
  }

  if (parsed.data.entries.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const rows = parsed.data.entries.map((e) => ({
    session_id: sessionId,
    direction: e.direction,
    item_code: e.itemCode,
    amount: e.amount,
    cap_pct: e.capPct ?? null,
    note: e.note ?? null,
  }));

  const { data, error } = await sb.from('closing_adjustment_entry').insert(rows).select();
  if (error) {
    loggers.api.error({ err: error }, 'closing adjustment insert failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_ADJUSTMENTS_PUT'))(
    request as RequestWithSession,
    (r) => handlePut(r, id)
  );
}
