/**
 * GET /api/id-billing/board
 *
 * ID Billing 발행 보드 (v19 §4).
 * 발행대상(승인완료 + 미발행, 회사별 카드 데이터) + 발행완료 리스트.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireBillingIssuer } from '@/middleware/requireBillingIssuer';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildBillingBoard, resolveIssuerScope } from '@/lib/id-billing/board-data';
import type { RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }
  const board = await buildBillingBoard(admin, scope);
  return NextResponse.json({ success: true, data: { ...board, isOperator: scope.isOperator } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireBillingIssuer,
  )(request as RequestWithSession, handleGet);
}
