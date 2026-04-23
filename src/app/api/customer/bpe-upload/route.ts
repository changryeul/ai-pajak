import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/customer/bpe-upload
 *
 * Customer uploads BPE (Bukti Penerimaan Elektronik) after receiving it by
 * email from DJP. Transitions queue item DJP_SUBMITTED → BPE_UPLOADED.
 *
 * The operator side has the same transition via /api/operator/queue
 * (action=upload-bpe). Both coexist because DJP emails the BPE directly
 * to the taxpayer, so the customer is often the one who has the file first.
 *
 * Body (JSON):
 * - queueItemId: UUID of the queue item
 * - bpeFileUrl: URL of uploaded BPE PDF (pre-uploaded via /api/documents/upload)
 * - bpeNumber: optional BPE number (customer-entered from email)
 * - bpeDate: optional ISO date (customer-entered; defaults to today)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { queueItemId, bpeFileUrl, bpeNumber, bpeDate } = body as {
      queueItemId?: string;
      bpeFileUrl?: string;
      bpeNumber?: string | null;
      bpeDate?: string | null;
    };

    if (!queueItemId || !bpeFileUrl) {
      return NextResponse.json(
        { error: 'queueItemId and bpeFileUrl are required' },
        { status: 400 },
      );
    }

    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const { data: item, error: fetchError } = await admin
      .from('djp_submission_queue')
      .select('id, status, customer_id')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (item.status !== 'DJP_SUBMITTED') {
      return NextResponse.json(
        { error: `Cannot upload BPE. Current status: ${item.status}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: 'BPE_UPLOADED',
      bpe_file_url: bpeFileUrl,
      updated_at: now,
    };
    if (bpeNumber && bpeNumber.trim()) {
      updatePayload.bpe_number = bpeNumber.trim();
    }
    if (bpeDate && bpeDate.trim()) {
      updatePayload.bpe_date = bpeDate.trim();
    } else {
      updatePayload.bpe_date = now.slice(0, 10);
    }

    const { data: updated, error: updateError } = await admin
      .from('djp_submission_queue')
      .update(updatePayload)
      .eq('id', queueItemId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await admin.from('audit_log').insert({
      customer_id: customer.id,
      actor_user_id: user.id,
      actor_role: 'CUSTOMER',
      activity_type: 'BILLING_CREATE',
      activity_details: {
        scope: 'CUSTOMER_BPE_UPLOAD',
        queueItemId,
        previousStatus: 'DJP_SUBMITTED',
        newStatus: 'BPE_UPLOADED',
        bpeFileUrl,
        bpeNumber: bpeNumber ?? null,
        bpeDate: updatePayload.bpe_date,
      },
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'BPE uploaded successfully',
    });
  } catch (error) {
    loggers.payment.error({ err: error }, 'Customer BPE upload error');
    return NextResponse.json(
      { error: 'Failed to upload BPE' },
      { status: 500 },
    );
  }
}
