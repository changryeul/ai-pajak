/**
 * GET /api/operator/supervisor/legality
 *   → { customers, documents, expiringSoon }
 *
 * 팀장용 ERP 리갈리티 자료 현황 (PDF p.11-15). One summary row per
 * COMPANY customer + the latest version of each of their documents
 * + a list of upcoming expirations (next 90 days).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { buildLegalityOverview } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const data = await buildLegalityOverview();
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
