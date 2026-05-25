/**
 * GET /api/staff-messenger/threads
 *
 * Supervisor 시점: 산하 operator list + 각 operator 와의 thread summary.
 * Operator 시점: 본인과 대화한 supervisor list.
 *
 * 모든 권한 검사는 composeMiddleware + RLS. CUSTOMER / CONSULTANT_JTC /
 * PLATFORM_ADMIN 은 requireRole 미들웨어가 차단.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { RequestWithSession, UserRole } from '@/types/auth';
import {
  buildSupervisorThreads,
  buildOperatorThreads,
  isSupervisorRole,
} from '@/lib/messenger/staff-message';

const OPS_ROLES = [
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
] as const;

async function handleList(req: RequestWithSession): Promise<Response> {
  const userId = req.session.userId;
  const role = req.session.role;
  if (isSupervisorRole(role)) {
    const threads = await buildSupervisorThreads(userId);
    return NextResponse.json({
      success: true,
      data: { mode: 'SUPERVISOR' as const, threads },
    });
  }
  const threads = await buildOperatorThreads(userId);
  return NextResponse.json({
    success: true,
    data: { mode: 'OPERATOR' as const, threads },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(...OPS_ROLES),
  )(request as RequestWithSession, handleList);
}
