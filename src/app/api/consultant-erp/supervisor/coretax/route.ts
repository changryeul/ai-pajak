/**
 * GET /api/consultant-erp/supervisor/coretax
 *   → { rows: CoretaxQueueRow[] }
 *
 * 팀장용 ERP Coretax 처리 대기 (PDF p.27).
 *
 * Lists APPROVED/COMPLETED sessions with their current Coretax stage
 *   ID_BILLING_PENDING → NTPN_PENDING → BPE_PENDING → COMPLETED
 * so the supervisor can monitor the post-approval pipeline without
 * editing every record. The actual recording is done by the assigned
 * consultant via /api/consultant-erp/sessions/[id]/coretax-record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildCoretaxQueue } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const rows = await buildCoretaxQueue();
  return NextResponse.json({ success: true, data: { rows } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
