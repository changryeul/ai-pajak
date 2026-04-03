/**
 * OCR Processing Queue
 *
 * Manages async document processing with status tracking
 * Uses service role client for background processing
 */

import { createClient } from '@supabase/supabase-js';
import { OCRJobRequest, OCRJobStatus, OCRResult, OCRStatus, DocumentCategory } from './types';
import { processDocument } from './processor';
import { processForm1721A1 } from './form-1721-a1';
import { processPDF } from './pdf-processor';
import { loggers } from '@/lib/logger';

// Create admin client for background processing
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Queue a document for OCR processing
 */
export async function queueOCRJob(request: OCRJobRequest): Promise<string> {
  const supabase = getAdminClient();

  // Update document status to PENDING
  await supabase
    .from('document')
    .update({
      ocr_status: 'PENDING',
      ocr_started_at: new Date().toISOString(),
      ocr_error_message: null,
    })
    .eq('id', request.documentId);

  // In a production environment, this would queue to a job processor
  // For now, we process immediately in the background
  processOCRJob(request).catch((error) => {
    loggers.ocr.error({ err: error }, 'Background processing failed');
  });

  return request.documentId;
}

/**
 * Process an OCR job
 */
async function processOCRJob(request: OCRJobRequest): Promise<void> {
  const supabase = getAdminClient();

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

    // Convert to base64 and get array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine processing method based on file type
    let result: OCRResult;

    if (request.fileType.includes('pdf')) {
      // Use PDF processor
      result = await processPDF(
        request.documentId,
        arrayBuffer,
        request.expectedCategory
      );
    } else {
      // Determine media type for images
      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
      if (request.fileType.includes('png')) {
        mediaType = 'image/png';
      } else if (request.fileType.includes('webp')) {
        mediaType = 'image/webp';
      } else if (request.fileType.includes('gif')) {
        mediaType = 'image/gif';
      }

      // Determine processing method based on expected category
      if (request.expectedCategory === 'BUKTI_POTONG' || isForm1721A1(request.fileUrl)) {
        // Use specialized Form 1721-A1 processor
        result = await processForm1721A1(request.documentId, base64, mediaType);
      } else {
        // Use general document processor
        result = await processDocument(
          request.documentId,
          base64,
          mediaType,
          request.expectedCategory
        );
      }
    }

    // Determine form type if detected as Bukti Potong
    let formType: string | undefined;
    if (result.category === 'BUKTI_POTONG') {
      const extractedData = result.extractedData;
      if (extractedData.withholdingTaxType === 'PPh21') {
        formType = 'FORM_1721_A1';
      } else if (extractedData.withholdingTaxType === 'PPh23') {
        formType = 'FORM_BUPOT_23';
      } else if (extractedData.withholdingTaxType === 'PPh26') {
        formType = 'FORM_BUPOT_26';
      } else if (extractedData.withholdingTaxType === 'PPhFinal') {
        formType = 'FORM_BUPOT_FINAL';
      }
    }

    // Save result to database
    await supabase
      .from('document')
      .update({
        ocr_status: result.status,
        ocr_completed_at: new Date().toISOString(),
        ocr_result: result,
        ocr_confidence: result.confidence,
        document_type: result.category !== 'UNKNOWN' ? result.category : undefined,
        form_type: formType,
      })
      .eq('id', request.documentId);

    loggers.ocr.info({
      documentId: request.documentId,
      category: result.category,
      formType,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
    }, 'Processing completed');
  } catch (error) {
    loggers.ocr.error({ err: error }, 'Processing failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update status to FAILED
    await supabase
      .from('document')
      .update({
        ocr_status: 'FAILED',
        ocr_completed_at: new Date().toISOString(),
        ocr_error_message: errorMessage,
        ocr_result: {
          documentId: request.documentId,
          status: 'FAILED',
          category: 'UNKNOWN',
          confidence: 0,
          extractedData: {},
          rawText: '',
          processingTimeMs: 0,
          errorMessage,
        },
      })
      .eq('id', request.documentId);
  }
}

/**
 * Check if file is likely a Form 1721-A1
 */
function isForm1721A1(fileUrl: string): boolean {
  const lowerUrl = fileUrl.toLowerCase();
  return (
    lowerUrl.includes('1721') ||
    lowerUrl.includes('bukti-potong') ||
    lowerUrl.includes('buktipotong') ||
    lowerUrl.includes('pph21') ||
    lowerUrl.includes('a1')
  );
}

/**
 * Get OCR job status
 */
export async function getOCRJobStatus(documentId: string): Promise<OCRJobStatus | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('document')
    .select('id, ocr_status, ocr_started_at, ocr_completed_at, ocr_result, ocr_confidence')
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
  const supabase = getAdminClient();

  // Get document info
  const { data: doc, error } = await supabase
    .from('document')
    .select('id, file_path, mime_type, document_type')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return false;
  }

  // Queue for reprocessing
  await queueOCRJob({
    documentId: doc.id,
    fileUrl: doc.file_path,
    fileType: doc.mime_type,
    expectedCategory: doc.document_type as DocumentCategory,
  });

  return true;
}

/**
 * Get pending OCR jobs for batch processing
 */
export async function getPendingOCRJobs(limit = 10): Promise<OCRJobRequest[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('document')
    .select('id, file_path, mime_type, document_type')
    .eq('ocr_status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((doc) => ({
    documentId: doc.id,
    fileUrl: doc.file_path,
    fileType: doc.mime_type,
    expectedCategory: doc.document_type as DocumentCategory,
  }));
}

/**
 * Process multiple OCR jobs in batch
 */
export async function processBatchOCRJobs(limit = 5): Promise<number> {
  const jobs = await getPendingOCRJobs(limit);

  if (jobs.length === 0) {
    return 0;
  }

  // Process jobs concurrently
  await Promise.allSettled(jobs.map((job) => processOCRJob(job)));

  return jobs.length;
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
