/**
 * OCR Processing Queue
 *
 * Manages async document processing with status tracking
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OCRJobRequest, OCRJobStatus, OCRResult, OCRStatus } from './types';
import { processDocument } from './processor';

/**
 * Queue a document for OCR processing
 */
export async function queueOCRJob(request: OCRJobRequest): Promise<string> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Update document status to PENDING
  await supabase
    .from('document')
    .update({
      ocr_status: 'PENDING',
      ocr_started_at: new Date().toISOString(),
    })
    .eq('id', request.documentId);

  // In a production environment, this would queue to a job processor
  // For now, we process immediately in the background
  processOCRJob(request).catch((error) => {
    console.error('[OCR Queue] Background processing failed:', error);
  });

  return request.documentId;
}

/**
 * Process an OCR job
 */
async function processOCRJob(request: OCRJobRequest): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  try {
    // Update status to PROCESSING
    await supabase
      .from('document')
      .update({ ocr_status: 'PROCESSING' })
      .eq('id', request.documentId);

    // Download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(request.fileUrl);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
    if (request.fileType.includes('png')) {
      mediaType = 'image/png';
    } else if (request.fileType.includes('webp')) {
      mediaType = 'image/webp';
    } else if (request.fileType.includes('gif')) {
      mediaType = 'image/gif';
    }

    // Process with OCR
    const result = await processDocument(
      request.documentId,
      base64,
      mediaType,
      request.expectedCategory
    );

    // Save result to database
    await supabase
      .from('document')
      .update({
        ocr_status: result.status,
        ocr_completed_at: new Date().toISOString(),
        ocr_result: result,
        document_type: result.category !== 'UNKNOWN' ? result.category : undefined,
      })
      .eq('id', request.documentId);

    console.info('[OCR] Processing completed:', {
      documentId: request.documentId,
      category: result.category,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    console.error('[OCR] Processing failed:', error);

    // Update status to FAILED
    await supabase
      .from('document')
      .update({
        ocr_status: 'FAILED',
        ocr_completed_at: new Date().toISOString(),
        ocr_result: {
          documentId: request.documentId,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .eq('id', request.documentId);
  }
}

/**
 * Get OCR job status
 */
export async function getOCRJobStatus(documentId: string): Promise<OCRJobStatus | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('document')
    .select('id, ocr_status, ocr_started_at, ocr_completed_at, ocr_result')
    .eq('id', documentId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    jobId: data.id,
    documentId: data.id,
    status: (data.ocr_status as OCRStatus) || 'PENDING',
    progress: getProgressFromStatus(data.ocr_status as OCRStatus),
    startedAt: data.ocr_started_at,
    completedAt: data.ocr_completed_at,
    result: data.ocr_result as OCRResult | undefined,
  };
}

/**
 * Retry a failed OCR job
 */
export async function retryOCRJob(documentId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Get document info
  const { data: doc, error } = await supabase
    .from('document')
    .select('id, file_path, file_type, document_type')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return false;
  }

  // Queue for reprocessing
  await queueOCRJob({
    documentId: doc.id,
    fileUrl: doc.file_path,
    fileType: doc.file_type,
    expectedCategory: doc.document_type,
  });

  return true;
}

/**
 * Get progress percentage from status
 */
function getProgressFromStatus(status: OCRStatus): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'PROCESSING':
      return 50;
    case 'COMPLETED':
      return 100;
    case 'FAILED':
      return 0;
    default:
      return 0;
  }
}
