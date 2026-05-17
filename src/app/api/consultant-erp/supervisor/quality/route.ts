/**
 * GET /api/consultant-erp/supervisor/quality
 *   → { summary, actions, queue }
 *
 * 팀장용 ERP 품질 모니터링 (PDF p.21-25). Distribution of counterparty
 * trust scores + 4-step action funnel + priority queue (lowest trust
 * first, max 50 rows) with each row's field-level evidence trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildQualityMonitor } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const data = await buildQualityMonitor();
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
