import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/billing/usage-billing
 *
 * Usage-based billing: tracks API calls, documents processed, AI features used.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Count usage metrics
    const { count: docCount } = await getSupabaseAdmin()
      .from('document')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer?.id);

    const { count: filingCount } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer?.id);

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Define plan limits
    const plans = {
      free: { docs: 5, filings: 2, aiCalls: 10, price: 0 },
      basic: { docs: 50, filings: 20, aiCalls: 100, price: 199_000 },
      pro: { docs: -1, filings: -1, aiCalls: -1, price: 499_000 }, // unlimited
    };

    const currentPlan = 'free'; // Would come from subscription table
    const limits = plans[currentPlan];

    return NextResponse.json({
      success: true,
      data: {
        currentPlan,
        billingPeriod: currentMonth,
        usage: {
          documents: { used: docCount || 0, limit: limits.docs, label: 'Dokumen' },
          filings: { used: filingCount || 0, limit: limits.filings, label: 'Pelaporan' },
          aiCalls: { used: 0, limit: limits.aiCalls, label: 'AI Calls' },
        },
        plans,
        nextBillingDate: `${currentMonth}-01`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
