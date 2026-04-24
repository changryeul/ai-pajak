import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * POST /api/customer/filing-bpe-upload
 *
 * Customer uploads BPE (Bukti Penerimaan Elektronik) for an ANNUAL
 * SPT filing. DJP emails the BPE PDF to the taxpayer after acceptance,
 * so the customer typically has the file before the consultant.
 *
 * Body (multipart/form-data):
 *   - filingId: UUID of the tax_filing row
 *   - file: BPE PDF (uploaded directly)
 *   - bpeNumber (optional): BPE reference number from the DJP email
 *
 * Stores the file as a tax_document with document_type='BPE' linked to
 * the filing, and optionally updates tax_filing.bpe_number.
 *
 * Distinct from /api/customer/bpe-upload which targets monthly
 * djp_submission_queue items (PPh 21/23, PPN, etc.). Keynote slide-19/20:
 * the 세금보고서 page must always show a BPE upload slot so the customer
 * can provide the file even before any consultant action.
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

    const form = await request.formData();
    const filingId = String(form.get('filingId') || '');
    const bpeNumber = String(form.get('bpeNumber') || '').trim();
    const file = form.get('file');

    if (!filingId || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'filingId and file are required' },
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

    const { data: filing, error: filingError } = await admin
      .from('tax_filing')
      .select('id, customer_id, tax_type, tax_period')
      .eq('id', filingId)
      .single();

    if (filingError || !filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }
    if (filing.customer_id !== customer.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Upload file to tax-documents bucket.
    const fileExt = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const storagePath = `customer/${customer.id}/${filing.tax_period}/bpe-${filing.id}.${fileExt}`;
    const { error: uploadError } = await admin.storage
      .from('tax-documents')
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      loggers.api.error({ err: uploadError, filingId }, 'BPE storage upload failed');
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
    }

    // Replace any previous BPE row for this filing (allow re-upload).
    await admin
      .from('tax_document')
      .delete()
      .eq('tax_filing_id', filingId)
      .eq('document_type', 'BPE');

    const { data: taxDoc, error: docError } = await admin
      .from('tax_document')
      .insert({
        tax_filing_id: filingId,
        uploaded_by_user_id: user.id,
        document_type: 'BPE',
        file_path: storagePath,
        file_name: file.name,
        mime_type: file.type || 'application/pdf',
        file_size_bytes: file.size,
      })
      .select('*')
      .single();

    if (docError) {
      loggers.api.error({ err: docError, filingId }, 'BPE tax_document insert failed');
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    if (bpeNumber) {
      await admin
        .from('tax_filing')
        .update({ bpe_number: bpeNumber, updated_at: new Date().toISOString() })
        .eq('id', filingId);
    }

    await admin.from('audit_log').insert({
      customer_id: customer.id,
      actor_user_id: user.id,
      actor_role: 'CUSTOMER',
      activity_type: 'BILLING_CREATE',
      activity_details: {
        scope: 'CUSTOMER_FILING_BPE_UPLOAD',
        filingId,
        taxDocumentId: taxDoc.id,
        bpeNumber: bpeNumber || null,
      },
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: taxDoc,
      message: 'BPE uploaded successfully',
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Customer filing-BPE upload error');
    return NextResponse.json({ error: 'Failed to upload BPE' }, { status: 500 });
  }
}
