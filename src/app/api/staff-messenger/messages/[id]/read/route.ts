/**
 * PATCH /api/staff-messenger/messages/:id/read
 *
 * Self-side read marker: supervisor 가 호출하면 read_at_by_supervisor 만,
 * operator 가 호출하면 read_at_by_operator 만 touch. 양쪽이 서로의 마커
 * 를 덮어쓰지 못한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RequestWithSession, UserRole } from '@/types/auth';
import { isSupervisorRole } from '@/lib/messenger/staff-message';

const OPS_ROLES = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

async function handleMarkRead(
  req: RequestWithSession,
  id: string,
): Promise<Response> {
  const admin = getSupabaseAdmin();
  const column = isSupervisorRole(req.session.role)
    ? 'read_at_by_supervisor'
    : 'read_at_by_operator';

  const { data, error } = await admin
    .from('staff_internal_message')
    .update({ [column]: new Date().toISOString() })
    .eq('id', id)
    .is(column, null)
    .select(`id, ${column}`)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPS_ROLES),
  )(request as RequestWithSession, (req) => handleMarkRead(req, id));
}
