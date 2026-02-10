import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteFile, StorageBucket } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get Document Details
 *
 * @route GET /api/documents/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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
        tax_filing_id,
        uploaded_by_user_id,
        document_type,
        file_path,
        file_name,
        mime_type,
        file_size_bytes,
        ocr_data,
        uploaded_at,
        created_at
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

    return NextResponse.json({
      success: true,
      data: {
        id: document.id,
        taxFilingId: document.tax_filing_id,
        documentType: document.document_type,
        fileName: document.file_name,
        mimeType: document.mime_type,
        size: document.file_size_bytes,
        ocrData: document.ocr_data,
        uploadedAt: document.uploaded_at || document.created_at,
      },
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document',
      },
      { status: 500 }
    );
  }
}

/**
 * Delete Document
 *
 * @route DELETE /api/documents/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const bucket = (searchParams.get('bucket') as StorageBucket) || 'tax-documents';

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
      .select('id, file_path, uploaded_by_user_id, tax_filing_id')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if user can delete (only uploader or consultant assigned to the filing)
    if (document.uploaded_by_user_id !== user.id) {
      const { data: consultant } = await supabase
        .from('consultant')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!consultant) {
        return NextResponse.json(
          { success: false, error: 'Only the uploader or assigned consultant can delete documents' },
          { status: 403 }
        );
      }

      // Verify consultant is assigned to this filing
      const { data: filing } = await supabase
        .from('tax_filing')
        .select('id')
        .eq('id', document.tax_filing_id)
        .eq('consultant_id', consultant.id)
        .single();

      if (!filing) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Delete from storage
    const deleteResult = await deleteFile(bucket, document.file_path);

    if (!deleteResult.success) {
      console.error('Storage delete failed:', deleteResult.error);
      // Continue to delete database record even if storage delete fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('tax_document')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete document record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 }
    );
  }
}
