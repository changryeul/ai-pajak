import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(req: RequestWithSession): Promise<Response> {
  const m = (req as unknown as NextRequest).nextUrl.pathname.match(/\/threads\/([^/]+)\/resolve/);
  const id = m?.[1];
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'thread id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('customer_ai_thread')
    .update({ status: 'RESOLVED', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { status: 'RESOLVED' } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handle);
}
