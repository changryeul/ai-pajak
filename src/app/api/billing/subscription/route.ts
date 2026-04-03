import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscription, createSubscription, cancelSubscription } from '@/lib/billing';
import type { SubscriptionPlan, BillingCycle } from '@/lib/billing/types';
import { loggers } from '@/lib/logger';

/**
 * GET /api/billing/subscription
 *
 * Get current subscription
 */
export async function GET() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get customer ID from customer table
  const { data: customer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!customer?.id) {
    return NextResponse.json({
      success: true,
      data: null,
    });
  }

  const subscription = await getSubscription(customer.id);

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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
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
  const { data: existingCustomer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', user.id)
    .single();

  let customerId = existingCustomer?.id;

  if (!customerId) {
    // Create customer record with required fields
    const { data: customer, error: customerError } = await supabase
      .from('customer')
      .insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
        email: user.email || '',
        customer_type: 'INDIVIDUAL', // Default to individual
      })
      .select()
      .single();

    if (customerError) {
      loggers.billing.error({ err: customerError }, 'Failed to create customer');
      return NextResponse.json(
        { error: 'Failed to create customer', details: customerError.message },
        { status: 500 }
      );
    }

    customerId = customer.id;
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const immediately = searchParams.get('immediately') === 'true';

  // Get customer's subscription
  const { data: customer } = await supabase
    .from('customer')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!customer?.id) {
    return NextResponse.json(
      { error: 'No subscription found' },
      { status: 404 }
    );
  }

  const subscription = await getSubscription(customer.id);
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
