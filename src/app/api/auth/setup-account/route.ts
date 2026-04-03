import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/auth/setup-account
 *
 * Called after successful registration to:
 * 1. Create customer record
 * 2. Assign CUSTOMER role
 * 3. Create FREE subscription
 *
 * Idempotent — safe to call multiple times.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';

    // 1. Create customer record (idempotent)
    const { data: existingCustomer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await admin
        .from('customer')
        .insert({
          user_id: user.id,
          customer_type: 'INDIVIDUAL',
          full_name: fullName,
          email,
        })
        .select('id')
        .single();

      if (custError) {
        return NextResponse.json({ error: 'Failed to create customer: ' + custError.message }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // 2. Assign CUSTOMER role (idempotent)
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'CUSTOMER')
      .maybeSingle();

    if (!existingRole) {
      await admin.from('user_roles').insert({
        user_id: user.id,
        role: 'CUSTOMER',
        is_active: true,
      });
    }

    // 3. Create FREE subscription (idempotent)
    const { data: existingSub } = await admin
      .from('subscription')
      .select('id')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .maybeSingle();

    if (!existingSub) {
      const now = new Date();
      const yearEnd = new Date(now.getFullYear(), 11, 31);

      await admin.from('subscription').insert({
        customer_id: customerId,
        plan: 'free',
        billing_cycle: 'ANNUAL',
        price: 0,
        is_active: true,
        current_period_start: now.toISOString(),
        current_period_end: yearEnd.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: { customerId, role: 'CUSTOMER', plan: 'free' },
    });
  } catch {
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
