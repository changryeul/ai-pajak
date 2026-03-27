import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, StorageBucket, DocumentType } from '@/lib/storage';

/**
 * Document Upload API
 *
 * Allows authenticated users to upload documents to Supabase Storage.
 * Documents are validated for type, size, and security before upload.
 *
 * SECURITY:
 * - Authenticated users only
 * - File type validation (PDF, images, Excel)
 * - File size limits per bucket
 * - Path traversal prevention
 * - Files stored with UUID paths
 *
 * @route POST /api/documents/upload
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as StorageBucket) || 'tax-documents';
    const documentType = (formData.get('documentType') as DocumentType) || 'OTHER';
    const taxFilingId = formData.get('taxFilingId') as string | null;
    const customerId = formData.get('customerId') as string | null;
    const aiClassification = formData.get('aiClassification') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate bucket
    const validBuckets: StorageBucket[] = ['tax-documents', 'poa-documents', 'avatars'];
    if (!validBuckets.includes(bucket)) {
      return NextResponse.json(
        { success: false, error: `Invalid bucket. Must be one of: ${validBuckets.join(', ')}` },
        { status: 400 }
      );
    }

    // Upload file
    const result = await uploadFile(file, user.id, {
      bucket,
      documentType,
      taxFilingId: taxFilingId || undefined,
      customerId: customerId || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Save to document table with AI classification if customerId is provided
    if (customerId && result.data) {
      // Map documentType to document_category enum
      const categoryMap: Record<string, string> = {
        BUKTI_POTONG: 'TAX_REGISTRATION',
        FAKTUR_PAJAK: 'TAX_REGISTRATION',
        LAPORAN_KEUANGAN: 'COMPANY',
        KTP: 'IDENTITY',
        NPWP_CARD: 'IDENTITY',
        TAX_DOCUMENT: 'TAX_REGISTRATION',
        POA_DRAFT: 'POA_DRAFT',
        OTHER: 'OTHER',
      };
      const dbCategory = categoryMap[documentType] || 'OTHER';

      let classificationData = null;
      if (aiClassification) {
        try { classificationData = JSON.parse(aiClassification); } catch { /* ignore */ }
      }

      const { error: docInsertError } = await supabase
        .from('document')
        .insert({
          customer_id: customerId,
          uploaded_by_user_id: user.id,
          document_type: dbCategory,
          file_path: result.data.path,
          file_name: result.data.originalName,
          mime_type: result.data.mimeType,
          file_size_bytes: result.data.size,
          metadata: {
            original_document_type: documentType,
            ai_classification: classificationData,
            storage_bucket: bucket,
          },
        });

      if (docInsertError) {
        console.error('Failed to create document record:', docInsertError);
      }
    }

    // If taxFilingId is provided, create a tax_document record
    if (taxFilingId && result.data) {
      const { error: docError } = await supabase
        .from('tax_document')
        .insert({
          tax_filing_id: taxFilingId,
          uploaded_by_user_id: user.id,
          document_type: documentType,
          file_path: result.data.path,
          file_name: result.data.originalName,
          mime_type: result.data.mimeType,
          file_size_bytes: result.data.size,
        });

      if (docError) {
        console.error('Failed to create tax_document record:', docError);
        // Don't fail the upload, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.data?.id,
        fileName: result.data?.originalName,
        path: result.data?.path,
        mimeType: result.data?.mimeType,
        size: result.data?.size,
        documentType: result.data?.documentType,
        signedUrl: result.signedUrl,
        uploadedAt: result.data?.uploadedAt,
      },
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
