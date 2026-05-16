/**
 * GET /api/consultant-erp/sessions/board
 *
 * Returns the consultant's "고객별 업무 현황판" payload:
 *   { stats: { totalCustomers, activeCustomers, uploadedSessions, reviewedSessions },
 *     rows: [{ customerId, customerName, sessionId, status, uploadCount, ... }] }
 */

import { NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { resolveConsultantContext, buildBoardForConsultant } from '@/lib/consultant-erp/session-helpers';
import type { RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) {
    return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });
  }
  const data = await buildBoardForConsultant(ctx);
  return NextResponse.json({ success: true, data });
}

export async function GET(request: Request) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
