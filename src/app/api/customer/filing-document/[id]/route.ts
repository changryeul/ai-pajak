import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * GET /api/customer/filing-document/[id]
 *
 * Returns a short-lived signed URL for a tax_document that belongs to the
 * authenticated customer's tax_filing. Used by the 세금보고서 page's
 * preview/download buttons.
 *
 * We issue a 302 to the signed URL so clicking the preview/download button
 * lands directly on the Supabase-hosted file.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: customer } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: doc, error } = await admin
      .from('tax_document')
      .select('file_path, file_name, mime_type, tax_filing_id, tax_filing:tax_filing!tax_filing_id(customer_id)')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const filingCustomerId =
      (doc as unknown as { tax_filing?: { customer_id?: string } })?.tax_filing?.customer_id;
    if (filingCustomerId && filingCustomerId !== customer.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: signed, error: signError } = await admin.storage
      .from('tax-documents')
      .createSignedUrl(doc.file_path as string, 60 * 5);

    if (signError || !signed?.signedUrl) {
      loggers.api.error({ err: signError, id }, 'Failed to sign tax_document URL');
      return NextResponse.json({ error: 'Unable to access document' }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (err) {
    loggers.api.error({ err }, 'filing-document GET error');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
