/**
 * Shared helper for fetching Tax Code Rule audit timeline rows.
 *
 * Used by:
 *   - GET /api/admin/tax-code-rule/audit-log (route.ts)
 *   - /operator/settings page server component (page.tsx)
 *
 * Both consumers need the same select + email join + legacy intent-row filter
 * + DTO shape (AuditRowDTO with pre-formatted displayTs). Extracted from
 * duplicated logic in those two files (~50 lines each).
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { formatAuditTs } from './format-audit';
import type { AuditRowDTO } from '@/types/tax-code-rule';

interface RawAuditRow {
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

/**
 * Loads up to `limit` (default 10, capped at 50) most-recent TAX_CODE_RULE_UPDATE
 * audit_log rows, joins actor email via auth.admin.getUserById per unique actor,
 * filters out legacy intent-only rows (no ruleId/diff in details), and returns
 * UI-ready AuditRowDTO[] (sorted created_at DESC, displayTs pre-formatted UTC).
 *
 * Returns empty array on DB error (logged by caller if needed).
 */
export async function loadAuditRows(limit = 10): Promise<AuditRowDTO[]> {
  const clamped = Math.min(Math.max(limit, 1), 50);
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('audit_log')
    .select('id, actor_user_id, actor_role, activity_details, created_at')
    .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
    .order('created_at', { ascending: false })
    .limit(clamped);

  const rows = (data ?? []) as RawAuditRow[];

  const userIds = [...new Set(rows.map((r) => r.actor_user_id))];
  const emailById = Object.fromEntries(
    await Promise.all(
      userIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        return [id, u.user?.email ?? null] as const;
      }),
    ),
  );

  return rows
    .filter((r) => r.activity_details?.ruleId && r.activity_details?.diff)
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
}
