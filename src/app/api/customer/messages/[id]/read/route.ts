/**
 * PATCH /api/customer/messages/:id/read — customer-side read receipt.
 * Touches `read_at_by_customer` only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RequestWithSession, UserRole } from '@/types/auth';

async function handleMarkRead(req: RequestWithSession, id: string): Promise<Response> {
  // Resolve the customer row first so we can scope the update.
  const { data: cust } = await getSupabaseAdmin()
    .from('customer')
    .select('id')
    .eq('user_id', req.session.userId)
    .maybeSingle();
  if (!cust) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('operator_message')
    .update({ read_at_by_customer: new Date().toISOString() })
    .eq('id', id)
    .eq('customer_id', cust.id)
    .eq('channel', 'CUSTOMER')
    .is('read_at_by_customer', null)
    .select('id, read_at_by_customer')
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
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, (req) => handleMarkRead(req, id));
}
