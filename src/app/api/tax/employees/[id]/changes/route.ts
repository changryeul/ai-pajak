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
 * GET /api/tax/employees/:id/changes
 *
 * Returns the field-level change history for an employee, ordered newest
 * first. The Employee Master detail screen renders this once and groups by
 * `section` for each panel ("기본정보 변경 이력", "고용정보 변경 이력", …).
 */
async function handleGet(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('employee_change_log')
    .select('id, section, field, old_value, new_value, changed_by_label, changed_at')
    .eq('employee_id', id)
    .order('changed_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handleGet(req, ctx),
  );
}
