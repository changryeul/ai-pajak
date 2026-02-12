import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsageMetrics } from '@/lib/billing';

/**
 * GET /api/billing/usage
 *
 * Get current period usage metrics
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
      data: {
        taxFilings: 0,
        documentsProcessed: 0,
        storageUsedMB: 0,
        period: '',
      },
    });
  }

  const usage = await getUsageMetrics(customer.id);

  return NextResponse.json({
    success: true,
    data: usage,
  });
}
