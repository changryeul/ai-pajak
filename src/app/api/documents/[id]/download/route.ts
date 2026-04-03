import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDownloadUrl, StorageBucket } from '@/lib/storage';
import { loggers } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get Document Download URL
 *
 * Returns a signed URL for downloading the document.
 * URL expires in 1 hour by default.
 *
 * @route GET /api/documents/[id]/download
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const bucket = (searchParams.get('bucket') as StorageBucket) || 'tax-documents';
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

    // Validate expiresIn (max 7 days)
    const maxExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    const validExpiresIn = Math.min(Math.max(expiresIn, 60), maxExpiry);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('tax_document')
      .select(`
        id,
        file_path,
        file_name,
        mime_type,
        uploaded_by_user_id,
        tax_filing_id
      `)
      .eq('id', id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check access - user must be the uploader or have access to the tax filing
    if (document.uploaded_by_user_id !== user.id) {
      // Check if user has access via tax filing
      const { data: filing } = await supabase
        .from('tax_filing')
        .select('id, customer_id, consultant_id')
        .eq('id', document.tax_filing_id)
        .single();

      if (!filing) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }

      // Get user's customer or consultant record
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { data: consultant } = await supabase
        .from('consultant')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const hasAccess =
        (customer && filing.customer_id === customer.id) ||
        (consultant && filing.consultant_id === consultant.id);

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Get signed download URL
    const result = await getDownloadUrl(bucket, document.file_path, validExpiresIn);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Log download activity (non-blocking)
    try {
      const { data: filingData } = await supabase
        .from('tax_filing')
        .select('customer_id')
        .eq('id', document.tax_filing_id)
        .single();

      await supabase.from('tax_activity_log').insert({
        customer_id: filingData?.customer_id,
        actor_user_id: user.id,
        activity_type: 'DOWNLOAD',
        activity_details: {
          documentId: document.id,
          fileName: document.file_name,
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      });
    } catch (err) {
      loggers.api.error({ err }, 'Failed to log download activity');
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.signedUrl,
        fileName: document.file_name,
        mimeType: document.mime_type,
        expiresIn: validExpiresIn,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Download URL error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL',
      },
      { status: 500 }
    );
  }
}
