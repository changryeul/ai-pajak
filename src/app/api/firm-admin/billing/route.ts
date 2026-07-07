import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireFirmAdmin, RequestWithFirmAdmin } from '@/middleware/requireFirmAdmin';
import { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CONSULTANT_TIERS, suggestConsultantTier } from '@/config/consultant-pricing';
import { loggers } from '@/lib/logger';

/**
 * FIRM_ADMIN 청구·구독 조회 (P6 follow-up, 2026-07-07)
 *
 * GET → { success, data: { partnerName, subscription, history, managedClientCount,
 *          recommendation, availableTiers } }
 *
 * 구독 신청/변경 (POST) 은 기존 `/api/billing/consultant-plan` 를 그대로 사용
 * — FIRM_ADMIN 도 consultant row 가 있어 resolveExternalPartner 를 통과한다.
 * 이 endpoint 는 이력 (history) 을 포함한 firm-admin 전용 read 뷰.
 */

async function handleBillingView(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const admin = getSupabaseAdmin();

  const [{ data: partner }, { data: subs, error: sErr }, { data: consultants }] =
    await Promise.all([
      admin.from('tax_partner').select('name').eq('id', firmTaxPartnerId).single(),
      admin
        .from('tax_partner_subscription')
        .select(
          'id, tier_id, tier_name, price_idr, billing_cycle, max_clients, status, valid_from, valid_until, midtrans_order_id, paid_at, created_at',
        )
        .eq('tax_partner_id', firmTaxPartnerId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin.from('consultant').select('id').eq('tax_partner_id', firmTaxPartnerId),
    ]);
  if (sErr) {
    loggers.api.error({ err: sErr }, 'firm-admin billing query failed');
    return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 });
  }

  const consultantIds = (consultants ?? []).map((c) => c.id);
  let managedClientCount = 0;
  if (consultantIds.length > 0) {
    const { count } = await admin
      .from('customer_consultant')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .in('consultant_id', consultantIds);
    managedClientCount = count ?? 0;
  }

  const history = subs ?? [];
  const subscription = history.find((s) => s.status === 'ACTIVE') ?? null;

  return NextResponse.json({
    success: true,
    data: {
      partnerName: partner?.name ?? null,
      subscription,
      history,
      managedClientCount,
      recommendation: suggestConsultantTier(managedClientCount),
      availableTiers: CONSULTANT_TIERS,
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, requireFirmAdmin)(
    request as RequestWithSession,
    handleBillingView,
  );
}
