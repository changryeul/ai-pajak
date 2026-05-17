/**
 * GET /api/tax/quarterly-trend?customerId=X&years=2025,2024
 *
 * Aggregates tax_monthly_payment rows into quarter buckets (Q1=1-3,
 * Q2=4-6, Q3=7-9, Q4=10-12) per year per tax_type, so the closing
 * trend panel can show side-by-side year-over-year quarterly bars.
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       years: number[],
 *       taxTypes: string[],
 *       quarters: Array<{
 *         year: number,
 *         quarter: 1|2|3|4,
 *         total: number,
 *         byType: Record<string, number>,
 *       }>,
 *       yoy: Array<{
 *         quarter: 1|2|3|4,
 *         currYear: number,
 *         prevYear: number,
 *         currTotal: number,
 *         prevTotal: number,
 *         deltaPct: number | null,
 *       }> | null,
 *     }
 *   }
 *
 * Auth: customer-side. Customers see their own data; consultants/supervisors
 * may pass ?customerId= explicitly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const ALLOWED_TAX_TYPES = ['PPh21', 'PPh23', 'PPh25', 'PPN', 'PPh_FINAL'] as const;

function quarterOf(month: number): 1 | 2 | 3 | 4 {
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const customerIdParam = url.searchParams.get('customerId');
    const yearsParam = url.searchParams.get('years');

    const admin = getSupabaseAdmin();

    // Resolve customerId (same pattern as closing-filings).
    let customerId = customerIdParam;
    if (req.session.role === 'CUSTOMER') {
      const { data: customer } = await admin
        .from('customer')
        .select('id')
        .eq('user_id', req.session.userId)
        .single();
      if (!customer) {
        return NextResponse.json({
          success: true,
          data: { years: [], taxTypes: [], quarters: [], yoy: null },
        });
      }
      customerId = customer.id;
    }
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    // Default: current year + prior year (typical YoY use case).
    const now = new Date();
    const defaultYears = [now.getFullYear(), now.getFullYear() - 1];
    let years: number[];
    if (yearsParam) {
      years = yearsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100);
      if (years.length === 0) years = defaultYears;
      if (years.length > 5) years = years.slice(0, 5);
    } else {
      years = defaultYears;
    }
    years.sort((a, b) => b - a); // desc

    // Pull monthly payments for those years.
    const { data: payments, error } = await admin
      .from('tax_monthly_payment')
      .select('tax_type, tax_period, tax_year, amount_due, amount_paid')
      .eq('customer_id', customerId)
      .in('tax_year', years);

    if (error) {
      loggers.tax.error({ err: error }, 'quarterly-trend query failed');
      // Graceful: empty payload — table may not exist yet on some envs.
      return NextResponse.json({
        success: true,
        data: { years, taxTypes: [], quarters: [], yoy: null },
      });
    }

    // Aggregate.
    type QKey = `${number}-${1 | 2 | 3 | 4}`;
    const bucket = new Map<QKey, { year: number; quarter: 1 | 2 | 3 | 4; byType: Record<string, number>; total: number }>();
    const seenTypes = new Set<string>();

    for (const p of payments ?? []) {
      // tax_period is YYYY-MM. Use tax_year as the authoritative year, parse month from tax_period.
      const m = typeof p.tax_period === 'string' ? parseInt(p.tax_period.slice(5, 7), 10) : NaN;
      if (!Number.isInteger(m) || m < 1 || m > 12) continue;
      const q = quarterOf(m);
      const key: QKey = `${p.tax_year}-${q}`;
      if (!bucket.has(key)) {
        bucket.set(key, { year: p.tax_year, quarter: q, byType: {}, total: 0 });
      }
      const entry = bucket.get(key)!;
      const tp = String(p.tax_type ?? '').trim() || 'OTHER';
      const amt = Number(p.amount_paid ?? 0) > 0 ? Number(p.amount_paid) : Number(p.amount_due ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      entry.byType[tp] = (entry.byType[tp] ?? 0) + amt;
      entry.total += amt;
      seenTypes.add(tp);
    }

    // Sort: ascending year, then quarter ascending — chart-friendly order.
    const quarters = Array.from(bucket.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter - b.quarter;
    });

    const taxTypes = ALLOWED_TAX_TYPES.filter((t) => seenTypes.has(t));
    // Append any custom tax_type seen but not in canonical list.
    for (const t of seenTypes) {
      if (!taxTypes.includes(t as (typeof ALLOWED_TAX_TYPES)[number])) {
        (taxTypes as string[]).push(t);
      }
    }

    // Build YoY comparison (latest year vs. prior year) per quarter.
    let yoy: Array<{
      quarter: 1 | 2 | 3 | 4;
      currYear: number;
      prevYear: number;
      currTotal: number;
      prevTotal: number;
      deltaPct: number | null;
    }> | null = null;
    if (years.length >= 2) {
      const [latest, prev] = years;
      yoy = ([1, 2, 3, 4] as const).map((q) => {
        const cur = bucket.get(`${latest}-${q}`)?.total ?? 0;
        const pre = bucket.get(`${prev}-${q}`)?.total ?? 0;
        return {
          quarter: q,
          currYear: latest,
          prevYear: prev,
          currTotal: cur,
          prevTotal: pre,
          deltaPct: pre > 0 ? ((cur - pre) / pre) * 100 : null,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: { years, taxTypes, quarters, yoy },
    });
  } catch (err) {
    loggers.api.error({ err }, 'quarterly-trend handler crashed');
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, handleGet);
}
