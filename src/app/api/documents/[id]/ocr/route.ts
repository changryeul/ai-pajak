import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queueOCRJob, getOCRJobStatus, retryOCRJob } from '@/lib/ocr';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]/ocr
 *
 * Get OCR processing status for a document
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id: documentId } = await context.params;

  const status = await getOCRJobStatus(documentId);

  if (!status) {
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: status,
  });
}

/**
 * POST /api/documents/[id]/ocr
 *
 * Start or retry OCR processing for a document
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: documentId } = await context.params;

  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get document info from tax_document table
  const { data: taxDocument, error } = await supabase
    .from('tax_document')
    .select('id, file_path, mime_type, document_type, ocr_data')
    .eq('id', documentId)
    .single();

  if (error || !taxDocument) {
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    );
  }

  // Check OCR status from ocr_data field
  const ocrData = taxDocument.ocr_data as { status?: string } | null;
  const ocrStatus = ocrData?.status;

  // Check if already processing
  if (ocrStatus === 'PROCESSING') {
    return NextResponse.json(
      { error: 'OCR is already in progress' },
      { status: 400 }
    );
  }

  // Check if it's a file type that can be processed
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!supportedTypes.includes(taxDocument.mime_type)) {
    return NextResponse.json(
      {
        error: 'Unsupported file type',
        message: 'Only images (JPEG, PNG, WebP, GIF) and PDFs can be processed',
      },
      { status: 400 }
    );
  }

  // Parse request body for options
  let expectedCategory;
  try {
    const body = await request.json();
    expectedCategory = body.expectedCategory;
  } catch {
    // Body is optional
  }

  // Queue or retry OCR job
  if (ocrStatus === 'FAILED') {
    await retryOCRJob(documentId);
  } else {
    await queueOCRJob({
      documentId,
      fileUrl: taxDocument.file_path,
      fileType: taxDocument.mime_type,
      expectedCategory: expectedCategory || taxDocument.document_type,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'OCR processing started',
    documentId,
  });
}
