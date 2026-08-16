/**
 * 수정요청 #63 — PPN 환급신청(Restitusi) 저장.
 *
 * POST: CUSTOMER 가 부가세 페이지의 "PPN 환급신청" 모달에서 제출 → PENDING 신청 저장.
 * GET:  본인의 환급신청 목록.
 *
 * 기존엔 모달이 UI 로만 동작해 신청이 어디에도 안 남았음. 이 endpoint 로 저장하면
 * 운영팀 워크큐(부가세 패널)에서 노출된다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  refundAmount: z.number().nonnegative().default(0),
  refundReason: z.string().max(1000).optional(),
});

async function resolveCustomerId(userId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().from('customer').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }
  const customerId = await resolveCustomerId(req.session.userId);
  if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { taxPeriod, refundAmount, refundReason } = parsed.data;
  // (customer, period) 당 1건 — 재신청 시 UPSERT(PENDING 로 복원).
  const { data, error } = await admin
    .from('ppn_refund_request')
    .upsert({
      customer_id: customerId,
      tax_period: taxPeriod,
      refund_amount: refundAmount,
      refund_reason: refundReason ?? null,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
      requested_by_user_id: req.session.userId,
      processed_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_id,tax_period' })
    .select('id, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const customerId = await resolveCustomerId(req.session.userId);
  if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  const { data } = await getSupabaseAdmin()
    .from('ppn_refund_request')
    .select('id, tax_period, refund_amount, refund_reason, status, requested_at')
    .eq('customer_id', customerId)
    .order('requested_at', { ascending: false });
  return NextResponse.json({ success: true, data: { requests: data ?? [] } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, withAudit('PPN_REFUND_REQUEST'))(
    request as RequestWithSession, handlePost);
}
export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}
