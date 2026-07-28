/**
 * GET /api/operator/supervisor/revisions?limit=100
 *   → { rows: RevisionEvent[] }
 *
 * 팀장용 ERP 수정/재상신 이력 (PDF p.10). Returns the most recent N
 * SUBMIT / REJECT / APPROVE / WITHDRAW events across all sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildRevisionEventLog } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 500 ? rawLimit : 100;
  const rows = await buildRevisionEventLog({ limit });
  return NextResponse.json({ success: true, data: { rows } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
