/**
 * Customer-facing custom pricing quote endpoint — Phase E
 *
 * Counterpart to /api/admin/master/custom-pricing (master-only). This endpoint
 * lets the customer themselves view their SENT quotes and accept or reject
 * them.
 *
 * GET  /api/billing/custom-pricing
 *   → list SENT and ACCEPTED quotes for the current customer
 *
 * POST /api/billing/custom-pricing
 *   body: { quoteId: string, action: 'accept' | 'reject' }
 *   → on 'accept': flip the quote to ACCEPTED, set accepted_at, and for
 *     CORPORATE_PLAN service_type also create a PENDING_PAYMENT subscription
 *     row that references the quote (graceful-degrade — Midtrans is NOT
 *     called here; the customer hits the payment flow via /pricing later)
 *   → on 'reject': flip to REJECTED
 *
 * Authorization: customer can only act on their own quotes (verified by
 * customer_id == resolveCustomerId(user.id)). Uses the service-role admin
 * client for the actual mutation because the table's RLS policy only grants
 * SELECT to customers, not UPDATE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

interface CustomPricingQuote {
  id: string;
  customer_id: string;
  status: string;
  service_type: string;
  monthly_price_idr: number | null;
  one_time_price_idr: number | null;
  quote_title: string;
  valid_until: string | null;
}

async function resolveCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    loggers.api.info({ userId: user.id }, 'GET /api/billing/custom-pricing');

    const customerId = await resolveCustomerId(supabase, user.id);
    if (!customerId) {
      return NextResponse.json({ success: true, data: { quotes: [] } });
    }

    const admin = getSupabaseAdmin();
    const { data: quotes, error } = await admin
      .from('custom_pricing_quote')
      .select(
        'id, customer_id, quote_title, quote_description, service_type, monthly_price_idr, one_time_price_idr, valid_from, valid_until, status, created_at, sent_at, accepted_at',
      )
      .eq('customer_id', customerId)
      .in('status', ['SENT', 'ACCEPTED'])
      .order('created_at', { ascending: false });

    if (error) {
      loggers.api.error({ err: error, customerId }, 'Failed to list custom pricing quotes for customer');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { quotes: quotes || [] } });
  } catch (err) {
    loggers.api.error({ err }, 'GET /api/billing/custom-pricing error');
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
    const { quoteId, action } = body as { quoteId: string; action: 'accept' | 'reject' };
    loggers.api.info({ userId: user.id, quoteId, action }, 'POST /api/billing/custom-pricing');

    if (!quoteId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'quoteId and action ("accept" | "reject") are required' },
        { status: 400 }
      );
    }

    const customerId = await resolveCustomerId(supabase, user.id);
    if (!customerId) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify the quote belongs to this customer and is in SENT state
    const { data: quote, error: fetchErr } = await admin
      .from('custom_pricing_quote')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle<CustomPricingQuote>();

    if (fetchErr || !quote) {
      return NextResponse.json({ error: '견적을 찾을 수 없습니다' }, { status: 404 });
    }
    if (quote.customer_id !== customerId) {
      loggers.api.warn(
        { userId: user.id, quoteId, ownerCustomerId: quote.customer_id, callerCustomerId: customerId },
        'Cross-customer quote access attempt blocked',
      );
      return NextResponse.json({ error: '본인 견적이 아닙니다' }, { status: 403 });
    }
    if (quote.status !== 'SENT') {
      return NextResponse.json(
        { error: `견적이 ${quote.status} 상태라 ${action} 할 수 없습니다` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      const { error: updErr } = await admin
        .from('custom_pricing_quote')
        .update({ status: 'REJECTED' })
        .eq('id', quoteId);
      if (updErr) {
        loggers.api.error({ err: updErr, quoteId }, 'Failed to reject custom pricing quote');
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: { quoteId, status: 'REJECTED' } });
    }

    // action === 'accept'
    const { error: acceptErr } = await admin
      .from('custom_pricing_quote')
      .update({ status: 'ACCEPTED', accepted_at: now })
      .eq('id', quoteId);
    if (acceptErr) {
      loggers.api.error({ err: acceptErr, quoteId }, 'Failed to accept custom pricing quote');
      return NextResponse.json({ error: acceptErr.message }, { status: 500 });
    }

    // Side-effect: for CORPORATE_PLAN quotes, materialize a PENDING_PAYMENT
    // customer_subscription row referencing this quote. Other service types
    // (TAX_AUDIT, TRANSFER_PRICING, ADVISORY) are followed up offline by the
    // master.
    let subscriptionId: string | null = null;
    if (quote.service_type === 'CORPORATE_PLAN' && quote.monthly_price_idr != null) {
      const { data: sub, error: subErr } = await admin
        .from('customer_subscription')
        .insert({
          customer_id: customerId,
          plan_id: 'CUSTOM',
          plan_name: quote.quote_title,
          price_idr: quote.monthly_price_idr,
          billing_cycle: 'MONTHLY',
          status: 'PENDING_PAYMENT',
          valid_from: now,
          valid_until: quote.valid_until
            ? new Date(quote.valid_until).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          custom_pricing_quote_id: quoteId,
          created_by_user_id: user.id,
        })
        .select('id')
        .single();
      if (subErr) {
        loggers.api.error({ err: subErr, quoteId }, 'Quote accepted but failed to create custom subscription row');
      } else if (sub) {
        subscriptionId = sub.id;
        loggers.api.info({ quoteId, subscriptionId }, 'Custom subscription PENDING_PAYMENT created');
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        quoteId,
        status: 'ACCEPTED',
        subscriptionId,
        nextStep:
          quote.service_type === 'CORPORATE_PLAN'
            ? '/billing 페이지에서 결제를 진행해주세요'
            : 'JTC 마스터가 곧 후속 절차를 안내해드립니다',
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'POST /api/billing/custom-pricing error');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
