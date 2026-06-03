/**
 * POST /api/customer-ai/threads/find-or-create
 *   body: { contextKind: ContextKind, contextPeriod: string }
 *   → 200 { data: ThreadDTO }
 *
 * CUSTOMER only. Uses UNIQUE(customer_id, context_kind, context_period)
 * to find existing row first; INSERT if none.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { ContextKind, ThreadDTO } from '@/types/customer-ai';
import { buildDisplayLabel } from '@/lib/customer-ai/context';

const schema = z.object({
  contextKind: z.enum(['PPH21', 'PPH23', 'PPN', 'CLOSING', 'OTHER']),
  contextPeriod: z.string().regex(/^(\d{4}-\d{2}|OTHER)$/, 'period must be YYYY-MM or OTHER'),
});

interface RawThread {
  id: string;
  customer_id: string;
  context_kind: ContextKind;
  context_period: string;
  status: 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
  customer_unread_count: number;
  operator_unread_count: number;
  last_customer_message_at: string | null;
  last_operator_message_at: string | null;
  created_at: string;
}

function toDTO(t: RawThread): ThreadDTO {
  // SECURITY BOUNDARY: explicit whitelist — operator-only fields (e.g. drafts
  // table) MUST NOT leak to the customer. Spread is intentionally avoided.
  // Phase 2.3: legacy auto_draft/auto_draft_at columns dropped; whitelist
  // hardening retained for any future operator-only addition.
  return {
    id: t.id,
    contextKind: t.context_kind,
    contextPeriod: t.context_period,
    status: t.status,
    customerUnreadCount: t.customer_unread_count,
    operatorUnreadCount: t.operator_unread_count,
    lastCustomerMessageAt: t.last_customer_message_at,
    lastOperatorMessageAt: t.last_operator_message_at,
    createdAt: t.created_at,
    displayLabel: buildDisplayLabel(t.customer_id, t.context_kind, t.context_period),
  };
}

async function handle(req: RequestWithSession): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Resolve current customer row
  const { data: cust, error: cErr } = await admin
    .from('customer')
    .select('id')
    .eq('user_id', req.session.userId)
    .maybeSingle();
  if (cErr || !cust) {
    return NextResponse.json({ error: 'customer not found' }, { status: 404 });
  }

  // Find existing
  const { data: existing } = await admin
    .from('customer_ai_thread')
    .select('*')
    .eq('customer_id', cust.id)
    .eq('context_kind', parsed.data.contextKind)
    .eq('context_period', parsed.data.contextPeriod)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: toDTO(existing as RawThread) });
  }

  // Insert new
  const { data: created, error: iErr } = await admin
    .from('customer_ai_thread')
    .insert({
      customer_id: cust.id,
      customer_user_id: req.session.userId,
      context_kind: parsed.data.contextKind,
      context_period: parsed.data.contextPeriod,
    })
    .select('*')
    .single();
  if (iErr || !created) {
    loggers.api.error({ err: iErr?.message, route: 'customer-ai find-or-create' }, 'create thread failed');
    return NextResponse.json({ error: 'failed to create thread' }, { status: 500 });
  }
  return NextResponse.json({ data: toDTO(created as RawThread) });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handle);
}
