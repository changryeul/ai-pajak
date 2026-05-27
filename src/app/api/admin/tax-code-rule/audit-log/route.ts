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
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { AuditRowDTO } from '@/types/tax-code-rule';
import { formatAuditTs } from '@/lib/tax-code-rule/format-audit';

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  actor_role: string | null;
  activity_details: {
    ruleId?: string;
    category?: string;
    diff?: Record<string, { before: string; after: string }>;
  };
  created_at: string;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL((req as unknown as NextRequest).url);
  const limitParam = Number(url.searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('audit_log')
    .select('id, actor_user_id, actor_role, activity_details, created_at')
    .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
    .order('created_at', { ascending: false })
    .limit(limit);

  const headers = { 'Cache-Control': 'no-store' };
  if (error) {
    loggers.api.error(
      { err: error.message, route: '/api/admin/tax-code-rule/audit-log', code: error.code },
      'tax_code_rule audit-log select failed',
    );
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500, headers });
  }

  const rows = (data ?? []) as AuditLogRow[];

  // Join actor email via getUserById per unique actor (signup/route.ts:72 pattern).
  const userIds = [...new Set(rows.map((r) => r.actor_user_id))];
  const emailById = Object.fromEntries(
    await Promise.all(
      userIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        return [id, u.user?.email ?? null] as const;
      }),
    ),
  );

  const dto: AuditRowDTO[] = rows
    .filter((r) => r.activity_details?.ruleId && r.activity_details?.diff) // skip legacy intent-only rows
    .map((r) => ({
      id: r.id,
      ruleId: r.activity_details.ruleId!,
      category: r.activity_details.category ?? '',
      actorRole: r.actor_role,
      actorUserId: r.actor_user_id,
      actorEmail: emailById[r.actor_user_id] ?? null,
      createdAt: r.created_at,
      displayTs: formatAuditTs(r.created_at),
      diff: r.activity_details.diff!,
    }));

  return NextResponse.json({ data: dto }, { headers });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}
