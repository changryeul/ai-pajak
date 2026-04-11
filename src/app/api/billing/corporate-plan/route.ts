/**
 * Corporate plan subscription API — Phase K-2.2
 *
 * GET  /api/billing/corporate-plan
 *   → current active corporate subscription + recommended plan based on usage
 * POST /api/billing/corporate-plan
 *   body: { planId, billingCycle? }
 *   → creates a PENDING_PAYMENT subscription row, returns Midtrans snap token
 *     for the frontend to redirect the user to payment
 *
 * This endpoint is specific to COMPANY customers using the Phase K-1
 * CORPORATE_PLANS (UMKM / BASIC / PRO). Individual (개인) customers pay
 * per SPT filing through the legacy /api/billing/subscription endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import {
  CORPORATE_PLANS,
  getCorporatePlan,
  type CorporatePlanId,
} from '@/config/corporate-pricing';
import { getPeakUsage } from '@/lib/billing/usage-query';
import { suggestPlanForCustomer } from '@/lib/billing/plan-recommender';
import { MidtransService } from '@/lib/payment/midtrans';

async function resolveCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('customer')
    .select('id, customer_type')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data || data.customer_type !== 'COMPANY') return null;
  return data.id;
}

/**
 * GET — current subscription + recommended plan + usage snapshot + available plans
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customerId = await resolveCustomerId(supabase, user.id);
    if (!customerId) {
      return NextResponse.json(
        { error: '법인 고객만 구독 플랜을 볼 수 있습니다' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: activeSub } = await admin
      .from('customer_subscription')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    // Usage snapshot (3-month rolling peak to avoid bouncing plans on spikes)
    const usage = await getPeakUsage(customerId, 3);
    const recommendation = suggestPlanForCustomer(usage);

    return NextResponse.json({
      success: true,
      data: {
        subscription: activeSub || null,
        usage,
        recommendation: {
          planId: recommendation.plan?.id || null,
          planName: recommendation.plan?.name || null,
          reason: recommendation.reason,
          exceedsAllPlans: recommendation.exceedsAllPlans,
          exceedingDimensions: recommendation.exceedingDimensions,
        },
        availablePlans: CORPORATE_PLANS.map((p) => ({
          id: p.id,
          name: p.name,
          priceIdr: p.priceIdr,
          billingCycle: p.billingCycle,
          limits: p.limits,
          description: p.description,
          features: p.features,
        })),
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/billing/corporate-plan error');
    return NextResponse.json(
      { error: '구독 정보를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST — start plan change (create PENDING_PAYMENT row + Midtrans snap token)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { planId, billingCycle } = body as {
      planId: CorporatePlanId;
      billingCycle?: 'MONTHLY';
    };

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    let plan;
    try {
      plan = getCorporatePlan(planId);
    } catch {
      return NextResponse.json(
        { error: `Unknown plan: ${planId}` },
        { status: 400 }
      );
    }

    const customerId = await resolveCustomerId(supabase, user.id);
    if (!customerId) {
      return NextResponse.json(
        { error: '법인 고객만 구독할 수 있습니다' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('company_name, full_name, email, phone')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Create pending subscription row (activated by webhook on payment success)
    const { data: subscription, error: subError } = await admin
      .from('customer_subscription')
      .insert({
        customer_id: customerId,
        plan_id: plan.id,
        plan_name: plan.name,
        price_idr: plan.priceIdr,
        billing_cycle: billingCycle || 'MONTHLY',
        status: 'PENDING_PAYMENT',
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (subError || !subscription) {
      loggers.api.error({ err: subError }, 'Failed to create pending corporate subscription');
      return NextResponse.json(
        { error: subError?.message || 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Create Midtrans Snap transaction
    const orderId = `CORP-${plan.id}-${subscription.id.slice(0, 8)}-${Date.now()}`;

    try {
      const snap = await MidtransService.createSnapTransaction({
        orderId,
        grossAmount: plan.priceIdr,
        customerDetails: {
          firstName: customer.company_name || customer.full_name || 'Customer',
          email: customer.email || user.email || 'noreply@example.com',
          phone: customer.phone || undefined,
        },
        itemDetails: [
          {
            id: plan.id,
            name: `AI Pajak ${plan.name} (월 구독)`,
            price: plan.priceIdr,
            quantity: 1,
          },
        ],
      });

      await admin
        .from('customer_subscription')
        .update({ midtrans_order_id: orderId })
        .eq('id', subscription.id);

      loggers.api.info(
        { subscriptionId: subscription.id, orderId, planId: plan.id, customerId },
        'Corporate subscription payment initiated'
      );

      return NextResponse.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          orderId,
          snapToken: snap.token,
          redirectUrl: snap.redirect_url,
        },
      });
    } catch (payErr) {
      // Rollback: mark subscription as canceled
      loggers.api.error({ err: payErr, subscriptionId: subscription.id }, 'Midtrans error, canceling subscription');
      await admin
        .from('customer_subscription')
        .update({ status: 'CANCELED' })
        .eq('id', subscription.id);
      return NextResponse.json(
        { error: '결제 페이지 생성 실패. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }
  } catch (err) {
    loggers.api.error({ err }, 'POST /api/billing/corporate-plan error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
