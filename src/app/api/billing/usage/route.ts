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
      data: {
        taxFilings: 0,
        documentsProcessed: 0,
        storageUsedMB: 0,
        period: '',
      },
    });
  }

  const usage = await getUsageMetrics(profile.customer_id);

  return NextResponse.json({
    success: true,
    data: usage,
  });
}
