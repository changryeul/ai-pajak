import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/entities
 *
 * Lists all customer records owned by the caller (multi-entity portfolio)
 * plus per-entity statistics rich enough to drive the multi-entity
 * dashboard: filings by status, year-to-date tax burden from the
 * operator queue, and the soonest upcoming deadline.
 *
 * Roll-up totals are computed server-side so the client doesn't need to
 * fan out N+M queries.
 */

const THIS_YEAR = new Date().getFullYear();
const TODAY = new Date();
const DEADLINE_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // upcoming within 45 days

interface QueueRow {
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  updated_at: string;
}

// Which queue statuses are still the customer's problem
const OPEN_QUEUE_STATUSES = new Set([
  'PENDING',
  'DATA_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'EBILLING_GENERATED',
  'PAYMENT_PENDING',
]);
const DONE_QUEUE_STATUSES = new Set(['COMPLETED']);

// DJP monthly deadline: 20th of the following month. Annual: end of March.
function deadlineFor(taxType: string, month: number, year: number): Date {
  if (taxType === 'SPT_TAHUNAN') return new Date(year + 1, 2, 31);
  // month is 1-12; deadline is 20th of month+1
  return new Date(year, month, 20);
}

function emptyRollup() {
  return {
    totalEntities: 0,
    totalFilings: 0,
    totalDrafts: 0,
    totalUnderReview: 0,
    totalFiledThisYear: 0,
    totalOverdue: 0,
    totalOpenQueue: 0,
    totalYtdTax: 0,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: entities } = await admin
      .from('customer')
      .select('id, full_name, company_name, npwp, customer_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!entities || entities.length === 0) {
      return NextResponse.json({
        success: true,
        data: { entities: [], totalEntities: 0, rollup: emptyRollup() },
      });
    }

    const entityIds = entities.map((e) => e.id);

    // Pull every filing for these entities in one shot, then bucket client-side.
    const { data: filings } = await admin
      .from('tax_filing')
      .select('id, customer_id, tax_type, tax_period, status, created_at')
      .in('customer_id', entityIds)
      .order('created_at', { ascending: false });

    // Pull queue items (deadlines, YTD tax) likewise
    const { data: queueRows } = await admin
      .from('djp_submission_queue')
      .select('customer_id, tax_type, tax_period_month, tax_period_year, amount, status, updated_at')
      .in('customer_id', entityIds);

    type FilingRow = NonNullable<typeof filings>[number];
    const filingsByEntity = new Map<string, FilingRow[]>();
    (filings || []).forEach((f) => {
      const arr = filingsByEntity.get(f.customer_id) || [];
      arr.push(f);
      filingsByEntity.set(f.customer_id, arr);
    });
    const queueByEntity = new Map<string, QueueRow[]>();
    ((queueRows || []) as QueueRow[]).forEach((q) => {
      const arr = queueByEntity.get(q.customer_id) || [];
      arr.push(q);
      queueByEntity.set(q.customer_id, arr);
    });

    const entitiesWithStats = entities.map((entity) => {
      const fs = filingsByEntity.get(entity.id) || [];
      const qs = queueByEntity.get(entity.id) || [];

      const drafts = fs.filter((f) => f.status === 'DRAFT').length;
      const underReview = fs.filter((f) => f.status === 'UNDER_REVIEW').length;
      const filed = fs.filter((f) => f.status === 'FILED').length;
      const filedThisYear = fs.filter((f) => {
        if (f.status !== 'FILED') return false;
        const y = Number(String(f.tax_period).split('-')[0]);
        return y === THIS_YEAR;
      }).length;

      const openQueue = qs.filter((q) => OPEN_QUEUE_STATUSES.has(q.status));
      const ytdTax = qs
        .filter((q) => DONE_QUEUE_STATUSES.has(q.status) && q.tax_period_year === THIS_YEAR)
        .reduce((s, q) => s + (Number(q.amount) || 0), 0);

      let soonest: { date: Date; taxType: string; amount: number } | null = null;
      for (const q of openQueue) {
        const due = deadlineFor(q.tax_type, q.tax_period_month, q.tax_period_year);
        if (due.getTime() - TODAY.getTime() > DEADLINE_WINDOW_MS) continue;
        if (due.getTime() < TODAY.getTime() - 180 * 24 * 60 * 60 * 1000) continue;
        if (!soonest || due < soonest.date) {
          soonest = { date: due, taxType: q.tax_type, amount: Number(q.amount) || 0 };
        }
      }
      const overdueCount = openQueue.filter(
        (q) => deadlineFor(q.tax_type, q.tax_period_month, q.tax_period_year).getTime() < TODAY.getTime(),
      ).length;

      return {
        ...entity,
        filingCount: fs.length,
        draftCount: drafts,
        underReviewCount: underReview,
        filedCount: filed,
        filedThisYear,
        openQueueCount: openQueue.length,
        overdueCount,
        ytdTax,
        soonestDeadline: soonest
          ? {
              date: soonest.date.toISOString().slice(0, 10),
              taxType: soonest.taxType,
              amount: soonest.amount,
            }
          : null,
      };
    });

    const rollup = entitiesWithStats.reduce(
      (acc, e) => ({
        totalEntities: acc.totalEntities + 1,
        totalFilings: acc.totalFilings + e.filingCount,
        totalDrafts: acc.totalDrafts + e.draftCount,
        totalUnderReview: acc.totalUnderReview + e.underReviewCount,
        totalFiledThisYear: acc.totalFiledThisYear + e.filedThisYear,
        totalOverdue: acc.totalOverdue + e.overdueCount,
        totalOpenQueue: acc.totalOpenQueue + e.openQueueCount,
        totalYtdTax: acc.totalYtdTax + e.ytdTax,
      }),
      emptyRollup(),
    );

    return NextResponse.json({
      success: true,
      data: { entities: entitiesWithStats, totalEntities: entitiesWithStats.length, rollup },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list entities' }, { status: 500 });
  }
}
