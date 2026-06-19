/**
 * GET /api/operator/spt-masa-requests?status=PENDING&taxType=PPh23&period=YYYY-MM&limit=50
 *
 * Operator view of customer SPT Masa submission requests. status param default
 * is 'PENDING' (검토 대기) — taxType/period are optional filters. Returns row
 * with customer + thread join so the operator can jump directly into the chat
 * thread + see how long the request has been pending.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface RawRow {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period: string;
  status: 'PENDING' | 'PROCESSED' | 'CANCELLED';
  requested_at: string;
  processed_at: string | null;
  filing_id: string | null;
  thread_id: string | null;
}
interface CustomerRow { id: string; full_name: string | null; company_name: string | null; customer_type: string }

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'PENDING';
  const taxType = url.searchParams.get('taxType');
  const period = url.searchParams.get('period');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);

  const admin = getSupabaseAdmin();
  let q = admin
    .from('spt_masa_submission_request')
    .select('id, customer_id, tax_type, tax_period, status, requested_at, processed_at, filing_id, thread_id')
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (status !== 'ALL') q = q.eq('status', status);
  if (taxType) q = q.eq('tax_type', taxType);
  if (period) q = q.eq('tax_period', period);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'query failed', message: error.message }, { status: 500 });
  }
  const list = (rows ?? []) as RawRow[];
  // Enrich with customer name (one round-trip).
  const customerIds = Array.from(new Set(list.map((r) => r.customer_id)));
  let customerMap = new Map<string, CustomerRow>();
  if (customerIds.length) {
    const { data: customers } = await admin
      .from('customer')
      .select('id, full_name, company_name, customer_type')
      .in('id', customerIds);
    customerMap = new Map(((customers ?? []) as CustomerRow[]).map((c) => [c.id, c]));
  }

  const data = list.map((r) => {
    const c = customerMap.get(r.customer_id);
    return {
      id: r.id,
      customerId: r.customer_id,
      customerName: c?.company_name ?? c?.full_name ?? '(unknown)',
      customerType: c?.customer_type ?? null,
      taxType: r.tax_type,
      taxPeriod: r.tax_period,
      status: r.status,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      filingId: r.filing_id,
      threadId: r.thread_id,
      pendingSeconds: r.status === 'PENDING'
        ? Math.floor((Date.now() - new Date(r.requested_at).getTime()) / 1000)
        : null,
    };
  });

  // Also return aggregate counts by status (top-of-page header card).
  const { data: counts } = await admin
    .from('spt_masa_submission_request')
    .select('status', { count: 'exact', head: false });
  const byStatus = { PENDING: 0, PROCESSED: 0, CANCELLED: 0 };
  for (const r of (counts ?? []) as { status: keyof typeof byStatus }[]) {
    if (r.status in byStatus) byStatus[r.status]++;
  }

  return NextResponse.json({ data, counts: byStatus });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}
