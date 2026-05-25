/**
 * PATCH /api/operator/messages/:id/read — mark a message read on the operator side.
 *
 * Touches `read_at_by_operator` only. Customer-side read receipt lives on the
 * customer endpoint so neither side can stomp on the other.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RequestWithSession, UserRole } from '@/types/auth';

const OPERATOR_ROLES = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

async function handleMarkRead(req: RequestWithSession, id: string): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('operator_message')
    .update({ read_at_by_operator: new Date().toISOString() })
    .eq('id', id)
    .is('read_at_by_operator', null)
    .select('id, read_at_by_operator')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
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
    requireRole(...OPERATOR_ROLES),
  )(request as RequestWithSession, (req) => handleMarkRead(req, id));
}
