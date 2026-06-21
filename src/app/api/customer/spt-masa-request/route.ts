/**
 * Server-side SPT Masa submission request — CUSTOMER endpoint.
 *
 * GET  /api/customer/spt-masa-request?taxType=PPh23&period=YYYY-MM
 *   → 200 { data: { status, requestedAt, processedAt, filingId } | null }
 *
 * POST /api/customer/spt-masa-request
 *   body: { taxType, period, threadId? }
 *   → 200 { data: { id, status, requestedAt } }
 *   Upsert: 같은 (customer, taxType, period) 가 이미 있으면 PENDING + requestedAt
 *   갱신, CANCELLED 였어도 PENDING 으로 되살림.
 *
 * DELETE /api/customer/spt-masa-request?taxType=...&period=...
 *   → 200 { data: { cancelled: true } } — CUSTOMER 의 "요청 취소".
 *
 * Hard rule: 본인 customer 행에만 접근. PLATFORM_ADMIN 차단.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const VALID_TYPES = ['PPh21', 'PPh23', 'PPh42', 'PPN'] as const;
type ValidType = typeof VALID_TYPES[number];

function parseArgs(url: URL): { taxType: ValidType | null; period: string | null } {
  const taxType = url.searchParams.get('taxType') as ValidType | null;
  const period = url.searchParams.get('period');
  if (!taxType || !VALID_TYPES.includes(taxType)) return { taxType: null, period };
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return { taxType, period: null };
  return { taxType, period };
}

async function getCustomerId(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('customer').select('id').eq('user_id', userId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const rawType = url.searchParams.get('taxType');
  const rawPeriod = url.searchParams.get('period');
  const customerId = await getCustomerId(req.session.userId);
  if (!customerId) return NextResponse.json({ error: 'customer not found' }, { status: 404 });

  // 2026-06-21: 인자 없이 호출 시 customer 의 모든 요청 list — 신고 이력 화면용.
  if (!rawType && !rawPeriod) {
    const { data } = await getSupabaseAdmin()
      .from('spt_masa_submission_request')
      .select('id, tax_type, tax_period, status, requested_at, processed_at, filing_id, thread_id')
      .eq('customer_id', customerId)
      .order('requested_at', { ascending: false });
    return NextResponse.json({ data: data ?? [] });
  }

  const { taxType, period } = parseArgs(url);
  if (!taxType || !period) {
    return NextResponse.json({ error: 'taxType (PPh21|PPh23|PPh42|PPN) and period (YYYY-MM) required' }, { status: 400 });
  }

  const { data } = await getSupabaseAdmin()
    .from('spt_masa_submission_request')
    .select('id, status, requested_at, processed_at, filing_id, thread_id')
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', period)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { taxType?: ValidType; period?: string; threadId?: string };
  if (!body.taxType || !VALID_TYPES.includes(body.taxType)) {
    return NextResponse.json({ error: 'taxType (PPh21|PPh23|PPh42|PPN) required' }, { status: 400 });
  }
  if (!body.period || !/^\d{4}-\d{2}$/.test(body.period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }
  const customerId = await getCustomerId(req.session.userId);
  if (!customerId) return NextResponse.json({ error: 'customer not found' }, { status: 404 });

  const now = new Date().toISOString();
  // Upsert: 동일 (customer, taxType, period) 가 있어도 PENDING 으로 reset + requested_at 갱신.
  const { data, error } = await getSupabaseAdmin()
    .from('spt_masa_submission_request')
    .upsert({
      customer_id: customerId,
      tax_type: body.taxType,
      tax_period: body.period,
      status: 'PENDING',
      requested_at: now,
      requested_by_user_id: req.session.userId,
      thread_id: body.threadId ?? null,
      processed_at: null,
      filing_id: null,
    }, { onConflict: 'customer_id,tax_type,tax_period' })
    .select('id, status, requested_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'upsert failed', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const { taxType, period } = parseArgs(url);
  if (!taxType || !period) {
    return NextResponse.json({ error: 'taxType and period required' }, { status: 400 });
  }
  const customerId = await getCustomerId(req.session.userId);
  if (!customerId) return NextResponse.json({ error: 'customer not found' }, { status: 404 });

  await getSupabaseAdmin()
    .from('spt_masa_submission_request')
    .update({ status: 'CANCELLED' })
    .eq('customer_id', customerId)
    .eq('tax_type', taxType)
    .eq('tax_period', period)
    .eq('status', 'PENDING');

  return NextResponse.json({ data: { cancelled: true } });
}

const stack = composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
);

export async function GET(request: NextRequest) {
  return stack(request as RequestWithSession, handleGet);
}
export async function POST(request: NextRequest) {
  return stack(request as RequestWithSession, handlePost);
}
export async function DELETE(request: NextRequest) {
  return stack(request as RequestWithSession, handleDelete);
}
