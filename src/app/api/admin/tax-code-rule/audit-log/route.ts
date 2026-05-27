/**
 * GET /api/admin/tax-code-rule/audit-log?limit=10
 *   → 200 { data: AuditRowDTO[] }  (created_at DESC)
 *
 * Read-only timeline of TAX_CODE_RULE_UPDATE audit_log rows.
 * All authenticated roles can read (PLATFORM_ADMIN blocked by middleware).
 * Actor email joined via auth.admin.getUserById per unique actor
 * (signup/route.ts:72 pattern).
 *
 * Legacy "intent-only" rows from before C-T1 (no ruleId/diff in details) are
 * filtered out — only PATCH events with full diff are shown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { loadAuditRows } from '@/lib/tax-code-rule/audit-log';

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL((req as unknown as NextRequest).url);
  const limitParam = Number(url.searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(limitParam) ? limitParam : 10;

  try {
    const dto = await loadAuditRows(limit);
    return NextResponse.json({ data: dto }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    loggers.api.error(
      { err: (error as Error).message, route: '/api/admin/tax-code-rule/audit-log' },
      'tax_code_rule audit-log load failed',
    );
    return NextResponse.json(
      { error: 'Failed to load audit log' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}
