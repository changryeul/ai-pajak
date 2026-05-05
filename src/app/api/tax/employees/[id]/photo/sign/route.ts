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
 * GET /api/tax/employees/:id/photo/sign
 * Returns a freshly-signed URL for the employee's stored photo, or null if
 * the employee has no photo or stores a legacy data: URL inline.
 */
async function handleGet(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: emp } = await admin
    .from('employee_payroll')
    .select('photo_url')
    .eq('id', id)
    .maybeSingle();
  const stored = emp?.photo_url;
  if (!stored) return NextResponse.json({ success: true, data: { signedUrl: null } });
  if (stored.startsWith('data:') || stored.startsWith('http')) {
    // Legacy data URL or pre-signed CDN URL — return as-is.
    return NextResponse.json({ success: true, data: { signedUrl: stored } });
  }
  const { data: signed } = await admin.storage
    .from('employee-photos')
    .createSignedUrl(stored, 60 * 60 * 24);
  return NextResponse.json({ success: true, data: { signedUrl: signed?.signedUrl ?? null } });
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handleGet(req, ctx),
  );
}
