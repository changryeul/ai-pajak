import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInvoices } from '@/lib/billing';

/**
 * GET /api/billing/invoices
 *
 * Get customer invoices
 */
export async function GET(request: NextRequest) {
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
      data: [],
    });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const invoices = await getInvoices(profile.customer_id, { limit, offset });

  return NextResponse.json({
    success: true,
    data: invoices,
    pagination: {
      limit,
      offset,
      hasMore: invoices.length === limit,
    },
  });
}
