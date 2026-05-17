/**
 * GET /api/consultant-erp/supervisor/team-members
 *   → { rows: TeamMemberCard[] }
 *
 * 팀장용 ERP Dashboard 팀원 카드 strip (PDF p.1). Returns one card per
 * active consultant with their workload counts (customers, active
 * tasks, pending approvals, revisions in the last 30 days).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildTeamMemberCards } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const rows = await buildTeamMemberCards();
  return NextResponse.json({ success: true, data: { rows } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
