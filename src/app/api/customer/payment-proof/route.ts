import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/customer/payment-proof
 *
 * Customer uploads payment proof for a queue item.
 * Transitions status from PAYMENT_PENDING to PAYMENT_UPLOADED.
 *
 * Body (JSON):
 * - queueItemId: UUID of the queue item
 * - paymentAmount: payment amount
 * - paymentDate: date of payment (YYYY-MM-DD)
 * - paymentProofUrl: URL of uploaded payment proof (pre-uploaded to Supabase Storage)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify customer role
    const admin = getSupabaseAdmin();
    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!roleData || roleData.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Customer access required' }, { status: 403 });
    }

    const body = await request.json();
    const { queueItemId, paymentAmount, paymentDate, paymentProofUrl } = body;

    if (!queueItemId || !paymentProofUrl) {
      return NextResponse.json(
        { error: 'queueItemId and paymentProofUrl are required' },
        { status: 400 }
      );
    }

    // Get customer record for this user
    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    // Get queue item and verify ownership + status
    const { data: item, error: fetchError } = await admin
      .from('djp_submission_queue')
      .select('id, status, customer_id, operator_id')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (item.status !== 'PAYMENT_PENDING') {
      return NextResponse.json(
        { error: `Cannot upload payment proof. Current status: ${item.status}` },
        { status: 400 }
      );
    }

    // Update queue item
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from('djp_submission_queue')
      .update({
        status: 'PAYMENT_UPLOADED',
        payment_proof_url: paymentProofUrl,
        payment_amount: paymentAmount || null,
        payment_date: paymentDate || null,
        updated_at: now,
        updated_by: user.id,
      })
      .eq('id', queueItemId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit log
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'CUSTOMER_PAYMENT_PROOF_UPLOAD',
      resource_type: 'djp_submission_queue',
      resource_id: queueItemId,
      details: {
        previousStatus: 'PAYMENT_PENDING',
        newStatus: 'PAYMENT_UPLOADED',
        paymentAmount,
        paymentDate,
      },
      created_at: now,
    });

    // TODO: Notify operator that payment proof was uploaded

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Payment proof uploaded successfully',
    });
  } catch (error) {
    loggers.payment.error({ err: error }, 'Payment proof upload error');
    return NextResponse.json(
      { error: 'Failed to upload payment proof' },
      { status: 500 }
    );
  }
}
