/**
 * GET /api/admin/tax-code-rule
 *   → 200 { data: TaxCodeRule[] } (sort_order ASC)
 *
 * All authenticated roles can read (RLS USING (true)).
 * PLATFORM_ADMIN is blocked by blockPlatformAdmin middleware for
 * consistency with hard rule #1 (no tax data for platform admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RequestWithSession } from '@/types/auth';
import type { TaxCodeRule } from '@/types/tax-code-rule';

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tax_code_rule')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { data: (data ?? []) as TaxCodeRule[] },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, handleGet);
}
