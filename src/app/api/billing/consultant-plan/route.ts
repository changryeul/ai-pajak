/**
 * External tax consultant subscription API — Phase B-3.3
 *
 * GET  /api/billing/consultant-plan
 *   → current active tier + recommended tier based on managed client count
 * POST /api/billing/consultant-plan
 *   body: { tierId, billingCycle? }
 *   → creates PENDING_PAYMENT subscription row + Midtrans Snap token
 *
 * Caller must be a consultant of an EXTERNAL tax_partner (or representative).
 * JTC internal staff do not use this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import {
  CONSULTANT_TIERS,
  getConsultantTier,
  suggestConsultantTier,
  type ConsultantTierId,
} from '@/config/consultant-pricing';
import { MidtransService } from '@/lib/payment/midtrans';
import { recordAudit } from '@/middleware/audit';

/**
 * Resolve the caller's tax_partner context (only for EXTERNAL consultants).
 * Returns null if the caller is not an external consultant.
 */
async function resolveExternalPartner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<{ partnerId: string; partnerName: string; partnerType: string } | null> {
  const { data: consultant } = await admin
    .from('consultant')
    .select('tax_partner_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!consultant) return null;

  const { data: partner } = await admin
    .from('tax_partner')
    .select('id, name, partner_type')
    .eq('id', consultant.tax_partner_id)
    .maybeSingle();

  if (!partner) return null;
  return { partnerId: partner.id, partnerName: partner.name, partnerType: partner.partner_type };
}

/**
 * Count active managed clients for a tax_partner (via customer_consultant).
 */
async function countManagedClients(
  admin: ReturnType<typeof getSupabaseAdmin>,
  partnerId: string,
): Promise<number> {
  const { count } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant:consultant_id!inner(tax_partner_id)', {
      count: 'exact',
      head: true,
    })
    .eq('is_active', true)
    .eq('consultant.tax_partner_id', partnerId);
  return count || 0;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    loggers.api.info({ userId: user.id }, 'GET /api/billing/consultant-plan');

    const admin = getSupabaseAdmin();
    const partner = await resolveExternalPartner(supabase, admin, user.id);

    if (!partner) {
      return NextResponse.json(
        { error: 'Hanya konsultan kantor pajak yang dapat mengakses' },
        { status: 403 }
      );
    }

    if (partner.partnerType === 'JTC') {
      return NextResponse.json(
        { error: 'Kantor JTC internal tidak memiliki paket mandiri' },
        { status: 403 }
      );
    }

    // Current active subscription
    const { data: activeSub } = await admin
      .from('tax_partner_subscription')
      .select('*')
      .eq('tax_partner_id', partner.partnerId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    // Managed client count
    const clientCount = await countManagedClients(admin, partner.partnerId);
    const recommendation = suggestConsultantTier(clientCount);

    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
        subscription: activeSub || null,
        managedClientCount: clientCount,
        recommendation: {
          tierId: recommendation.tier?.id || null,
          reason: recommendation.reason,
        },
        availableTiers: CONSULTANT_TIERS.map((t) => ({
          id: t.id,
          priceIdr: t.priceIdr,
          billingCycle: t.billingCycle,
          maxClients: t.maxClients,
          featureCount: t.featureCount,
        })),
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/billing/consultant-plan error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { tierId, billingCycle } = body as {
      tierId: ConsultantTierId;
      billingCycle?: 'MONTHLY';
    };
    loggers.api.info({ userId: user.id, tierId, billingCycle }, 'POST /api/billing/consultant-plan');

    if (!tierId) {
      return NextResponse.json({ error: 'tierId is required' }, { status: 400 });
    }

    let tier;
    try {
      tier = getConsultantTier(tierId);
    } catch {
      return NextResponse.json({ error: `Unknown tier: ${tierId}` }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const partner = await resolveExternalPartner(supabase, admin, user.id);

    if (!partner) {
      return NextResponse.json(
        { error: '세무 사무소 컨설턴트만 구독할 수 있습니다' },
        { status: 403 }
      );
    }
    if (partner.partnerType === 'JTC') {
      return NextResponse.json(
        { error: 'JTC 내부 사무소는 자체 요금제를 구독하지 않습니다' },
        { status: 403 }
      );
    }

    // Create pending subscription row
    const { data: subscription, error: subError } = await admin
      .from('tax_partner_subscription')
      .insert({
        tax_partner_id: partner.partnerId,
        tier_id: tier.id,
        tier_name: tier.id,
        price_idr: tier.priceIdr,
        billing_cycle: billingCycle || 'MONTHLY',
        max_clients: tier.maxClients >= 999_999 ? null : tier.maxClients,
        status: 'PENDING_PAYMENT',
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (subError || !subscription) {
      loggers.api.error({ err: subError }, 'Failed to create pending consultant subscription');
      return NextResponse.json(
        { error: subError?.message || 'Failed to create subscription' },
        { status: 500 }
      );
    }

    await recordAudit({
      action: 'BILLING_CREATE',
      actorUserId: user.id,
      actorRole: 'CONSULTANT_JTC',
      details: {
        scope: 'CONSULTANT_TIER_SUBSCRIBE',
        tierId: tier.id,
        priceIdr: tier.priceIdr,
        partnerId: partner.partnerId,
        subscriptionId: subscription.id,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    // Create Midtrans Snap transaction with CONS- prefix.
    // Graceful degrade: Snap failure does NOT cancel the row — it stays
    // PENDING_PAYMENT so the consultant can retry once a payment gateway
    // is available.
    const orderId = `CONS-${tier.id}-${subscription.id.slice(0, 8)}-${Date.now()}`;
    await admin
      .from('tax_partner_subscription')
      .update({ midtrans_order_id: orderId })
      .eq('id', subscription.id);

    let snapToken: string | null = null;
    let redirectUrl: string | null = null;
    let snapError: string | null = null;

    try {
      const snap = await MidtransService.createSnapTransaction({
        orderId,
        grossAmount: tier.priceIdr,
        customerDetails: {
          firstName: partner.partnerName,
          email: user.email || 'noreply@example.com',
        },
        itemDetails: [
          {
            id: tier.id,
            name: `AI Pajak ${tier.id} (Consultant Monthly)`,
            price: tier.priceIdr,
            quantity: 1,
          },
        ],
      });
      snapToken = snap.token;
      redirectUrl = snap.redirect_url;

      loggers.api.info(
        { subscriptionId: subscription.id, orderId, tierId: tier.id, partnerId: partner.partnerId },
        'Consultant subscription payment initiated'
      );
    } catch (payErr) {
      snapError = payErr instanceof Error ? payErr.message : 'Payment gateway error';
      loggers.api.warn(
        { err: payErr, subscriptionId: subscription.id },
        'Midtrans Snap creation failed — consultant subscription kept as PENDING_PAYMENT for manual retry'
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        orderId,
        snapToken,
        redirectUrl,
        snapError,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'POST /api/billing/consultant-plan error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
