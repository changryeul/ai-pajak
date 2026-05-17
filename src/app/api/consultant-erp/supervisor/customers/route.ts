/**
 * GET /api/consultant-erp/supervisor/customers
 *   → { rows: CustomerOverviewRow[] }
 *
 * 팀장용 ERP 고객별 진행현황 (PDF p.7). Supervisor-only: returns one
 * row per assigned customer with their latest session + doc-fill +
 * risk-score + deadline. The page sorts these by riskScore desc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import { buildCustomersOverview } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) {
    return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });
  }
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json(
      { error: 'Supervisor only' },
      { status: 403 },
    );
  }
  const rows = await buildCustomersOverview();
  return NextResponse.json({ success: true, data: { rows } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
