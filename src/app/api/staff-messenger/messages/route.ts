/**
 * Supervisor ↔ Operator 1:1 메시지 endpoint.
 *
 *   GET  /api/staff-messenger/messages?counterpartyUserId=...&since=...&limit=...
 *     supervisor 가 호출하면 (supervisor=self, operator=counterparty)
 *     operator   가 호출하면 (operator=self, supervisor=counterparty)
 *     DB RLS 가 본인이 속한 pair 만 통과시킴.
 *
 *   POST /api/staff-messenger/messages   { counterpartyUserId, body, attachmentUrl? }
 *     본인이 sender. supervisor/operator 결정은 role 로.
 *
 * 권한: composeMiddleware(requireAuth + blockPlatformAdmin + requireRole(ops-tier))
 * + withAudit. CUSTOMER 는 절대 도달 못 함.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RequestWithSession, UserRole } from '@/types/auth';
import {
  staffSendSchema,
  staffListQuerySchema,
  isSupervisorRole,
} from '@/lib/messenger/staff-message';

const OPS_ROLES = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

function resolvePair(
  selfUserId: string,
  selfRole: UserRole,
  counterpartyUserId: string,
): { supervisorUserId: string; operatorUserId: string } {
  if (isSupervisorRole(selfRole)) {
    return { supervisorUserId: selfUserId, operatorUserId: counterpartyUserId };
  }
  return { supervisorUserId: counterpartyUserId, operatorUserId: selfUserId };
}

async function handleList(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const parsed = staffListQuerySchema.safeParse({
    counterpartyUserId: url.searchParams.get('counterpartyUserId') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { counterpartyUserId, since, limit } = parsed.data;
  if (counterpartyUserId === req.session.userId) {
    return NextResponse.json(
      { error: 'self-conversation not allowed' },
      { status: 400 },
    );
  }
  const { supervisorUserId, operatorUserId } = resolvePair(
    req.session.userId,
    req.session.role,
    counterpartyUserId,
  );

  const admin = getSupabaseAdmin();
  let query = admin
    .from('staff_internal_message')
    .select('*')
    .eq('supervisor_user_id', supervisorUserId)
    .eq('operator_user_id', operatorUserId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (since) query = query.gt('created_at', since);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { messages: data ?? [] } });
}

async function handleSend(req: RequestWithSession): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = staffSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { counterpartyUserId, body: text, attachmentUrl } = parsed.data;
  if (counterpartyUserId === req.session.userId) {
    return NextResponse.json(
      { error: 'self-conversation not allowed' },
      { status: 400 },
    );
  }

  const { supervisorUserId, operatorUserId } = resolvePair(
    req.session.userId,
    req.session.role,
    counterpartyUserId,
  );

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('staff_internal_message')
    .insert({
      supervisor_user_id: supervisorUserId,
      operator_user_id: operatorUserId,
      sender_user_id: req.session.userId,
      body: text,
      attachment_url: attachmentUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    const isClientError =
      error.code === '23514' /* check */ ||
      error.code === '23503' /* fk */ ||
      error.code === '23502'; /* not null */
    return NextResponse.json(
      { error: 'Failed to send', detail: error.message },
      { status: isClientError ? 400 : 500 },
    );
  }
  if (req.audit) req.audit.action = 'STAFF_MESSAGE_SEND';
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPS_ROLES),
  )(request as RequestWithSession, handleList);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPS_ROLES),
    withAudit('STAFF_MESSAGE_SEND'),
  )(request as RequestWithSession, handleSend);
}
