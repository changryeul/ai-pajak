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
      data: [],
    });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const invoices = await getInvoices(customer.id, { limit, offset });

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
