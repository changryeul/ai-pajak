/**
 * GET /api/operator/customer-inbox/threads
 *   → 200 { data: ThreadWithCustomerDTO[] }
 *
 * Operator-tier only. ORDER BY operator_unread_count DESC, last_customer_
 * message_at DESC NULLS LAST. Joins customer name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { ThreadWithCustomerDTO } from '@/types/customer-ai';
import { buildDisplayLabel } from '@/lib/customer-ai/context';

interface RawThread {
  id: string;
  customer_id: string;
  context_kind: 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER';
  context_period: string;
  status: 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
  customer_unread_count: number;
  operator_unread_count: number;
  last_customer_message_at: string | null;
  last_operator_message_at: string | null;
  created_at: string;
  customer?: { id: string; full_name: string | null; company_name: string | null } | null;
}

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('customer_ai_thread')
    .select(`
      *,
      customer:customer_id (id, full_name, company_name)
    `)
    .order('operator_unread_count', { ascending: false })
    .order('last_customer_message_at', { ascending: false, nullsFirst: false })
    .limit(200);

  const dto: ThreadWithCustomerDTO[] = ((data ?? []) as RawThread[]).map((t) => ({
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
    customerId: t.customer_id,
    customerName: t.customer?.company_name || t.customer?.full_name || '고객',
  }));

  return NextResponse.json({ data: dto }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
  )(request as RequestWithSession, handleGet);
}
