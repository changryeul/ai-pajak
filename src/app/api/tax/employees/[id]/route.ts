import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Single Employee detail endpoint.
 * GET /api/tax/employees/:id  — full row including JSONB sub-records.
 */
async function handleGet(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('employee_payroll')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handleGet(req, ctx),
  );
}
