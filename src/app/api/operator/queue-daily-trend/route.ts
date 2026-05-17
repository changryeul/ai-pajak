/**
 * GET /api/operator/queue-daily-trend?days=14
 *
 * Aggregates djp_submission_queue rows by `updated_at::date` × `status` over
 * the last N days (default 14, max 60). Each day's bucket lists how many
 * queue items reached/last-touched that status that day. The supervisor
 * dashboard renders this as a stacked bar chart of daily activity.
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       days: Array<{
 *         date: 'YYYY-MM-DD',
 *         byStatus: Record<string, number>,
 *         total: number,
 *       }>,
 *       statuses: string[],
 *     }
 *   }
 *
 * Auth: operator-side. TAX_OPERATOR / TAX_OPERATOR_SUPERVISOR /
 * TAX_OPERATOR_LEAD / TAX_OPERATOR_MASTER allowed. Platform admin blocked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const ALL_STATUSES = [
  'PENDING',
  'DATA_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'EBILLING_GENERATED',
  'PAYMENT_PENDING',
  'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED',
  'DJP_SUBMITTED',
  'BPE_UPLOADED',
  'COMPLETED',
  'FAILED',
] as const;

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const rawDays = parseInt(url.searchParams.get('days') ?? '', 10);
    const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 60 ? rawDays : 14;

    const admin = getSupabaseAdmin();

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    const fromIso = from.toISOString();

    const { data: rows, error } = await admin
      .from('djp_submission_queue')
      .select('status, updated_at')
      .gte('updated_at', fromIso);

    if (error) {
      loggers.api.error({ err: error }, 'queue-daily-trend query failed');
      // Graceful empty so the dashboard doesn't crash on missing table.
      return NextResponse.json({
        success: true,
        data: { days: [], statuses: [] },
      });
    }

    // Pre-fill bucket map so every day appears in the response (even zero).
    const bucket = new Map<string, Record<string, number>>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      bucket.set(dayKey(d), {});
    }

    const seenStatuses = new Set<string>();
    for (const r of rows ?? []) {
      const u = r.updated_at ? new Date(r.updated_at) : null;
      if (!u) continue;
      const key = dayKey(u);
      const entry = bucket.get(key);
      if (!entry) continue; // Out of range.
      const status = String(r.status ?? 'PENDING');
      entry[status] = (entry[status] ?? 0) + 1;
      seenStatuses.add(status);
    }

    const dayList = Array.from(bucket.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, byStatus]) => {
        const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
        return { date, byStatus, total };
      });

    // Order statuses canonically; append any custom statuses seen.
    const statuses = ALL_STATUSES.filter((s) => seenStatuses.has(s));
    for (const s of seenStatuses) {
      if (!ALL_STATUSES.includes(s as (typeof ALL_STATUSES)[number])) {
        (statuses as string[]).push(s);
      }
    }

    return NextResponse.json({
      success: true,
      data: { days: dayList, statuses },
    });
  } catch (err) {
    loggers.api.error({ err }, 'queue-daily-trend crashed');
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
    withAudit('OPERATOR_QUEUE_DAILY_TREND_VIEW'),
  )(request as unknown as RequestWithSession, handleGet);
}
