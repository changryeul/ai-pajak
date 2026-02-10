import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscription, createSubscription, cancelSubscription } from '@/lib/billing';
import type { SubscriptionPlan, BillingCycle } from '@/lib/billing/types';

/**
 * GET /api/billing/subscription
 *
 * Get current subscription
 */
export async function GET() {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get customer ID from user profile
  const { data: profile } = await supabase
    .from('user_profile')
    .select('customer_id')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.customer_id) {
    return NextResponse.json({
      success: true,
      data: null,
    });
  }

  const subscription = await getSubscription(profile.customer_id);

  return NextResponse.json({
    success: true,
    data: subscription,
  });
}

/**
 * POST /api/billing/subscription
 *
 * Create new subscription
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { plan, billingCycle } = body as {
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
  };

  if (!plan || !billingCycle) {
    return NextResponse.json(
      { error: 'Plan and billing cycle are required' },
      { status: 400 }
    );
  }

  // Get or create customer
  const { data: profile } = await supabase
    .from('user_profile')
    .select('customer_id')
    .eq('user_id', session.user.id)
    .single();

  let customerId = profile?.customer_id;

  if (!customerId) {
    // Create customer record
    const { data: customer, error: customerError } = await supabase
      .from('customer')
      .insert({
        user_id: session.user.id,
        full_name: session.user.user_metadata?.full_name || session.user.email,
        email: session.user.email,
      })
      .select()
      .single();

    if (customerError) {
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      );
    }

    customerId = customer.id;

    // Update user profile
    await supabase
      .from('user_profile')
      .update({ customer_id: customerId })
      .eq('user_id', session.user.id);
  }

  const subscription = await createSubscription({
    customerId,
    plan,
    billingCycle,
  });

  if (!subscription) {
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: subscription,
  });
}

/**
 * DELETE /api/billing/subscription
 *
 * Cancel subscription
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const immediately = searchParams.get('immediately') === 'true';

  // Get customer's subscription
  const { data: profile } = await supabase
    .from('user_profile')
    .select('customer_id')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.customer_id) {
    return NextResponse.json(
      { error: 'No subscription found' },
      { status: 404 }
    );
  }

  const subscription = await getSubscription(profile.customer_id);
  if (!subscription) {
    return NextResponse.json(
      { error: 'No subscription found' },
      { status: 404 }
    );
  }

  const success = await cancelSubscription(subscription.id, immediately);
  if (!success) {
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: immediately
      ? 'Subscription canceled immediately'
      : 'Subscription will be canceled at the end of the billing period',
  });
}
