import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/customer/queue
 *
 * Returns the customer's own queue items from djp_submission_queue.
 * Query params: status (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get customer record
    const { data: customer } = await admin
      .from('customer')
      .select('id, full_name, npwp')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    // Build query
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let query = admin
      .from('djp_submission_queue')
      .select('id, tax_type, tax_period_month, tax_period_year, amount, status, ebilling_code, bpe_number, bpe_date, payment_proof_url, payment_amount, payment_date, payment_verified_at, completed_at, notes, created_at, updated_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 });
    }

    // Summary counts
    const all = items || [];
    const summary = {
      total: all.length,
      paymentPending: all.filter(i => i.status === 'PAYMENT_PENDING').length,
      paymentUploaded: all.filter(i => i.status === 'PAYMENT_UPLOADED').length,
      completed: all.filter(i => i.status === 'COMPLETED').length,
      inProgress: all.filter(i => !['COMPLETED', 'FAILED', 'PAYMENT_PENDING'].includes(i.status)).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        customer: { id: customer.id, name: customer.full_name, npwp: customer.npwp },
        items: all,
        summary,
      },
    });
  } catch (error) {
    console.error('Customer queue error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
