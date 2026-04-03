/**
 * DJP Job Queue
 *
 * Handles async processing of DJP API operations
 * Pattern: Following OCR queue pattern
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DJPService } from './djp-service';
import { loggers } from '@/lib/logger';
import { captureJobError } from '@/lib/sentry';
import {
  DJPJobType,
  DJPJobStatus,
  DJPJobPriority,
  DJPJobStatusResponse,
  EFilingRequest,
  EFilingResponse,
  EBillingRequest,
  EBillingResponse,
  NPWPValidationRequest,
  NPWPValidationResponse,
  BPERetrievalRequest,
  BPERetrievalResponse,
  DJPJobRow,
} from './types';

// Admin client for background processing
function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

// ============================================================================
// JOB QUEUE OPERATIONS
// ============================================================================

export interface QueueJobParams {
  type: DJPJobType;
  taxFilingId?: string;
  customerId?: string;
  payload:
    | EFilingRequest
    | EBillingRequest
    | NPWPValidationRequest
    | BPERetrievalRequest;
  priority?: DJPJobPriority;
  maxRetries?: number;
  scheduledAt?: Date;
}

/**
 * Queue a DJP job for processing
 */
export async function queueDJPJob(params: QueueJobParams): Promise<string> {
  const supabase = getAdminClient();
  const jobId = crypto.randomUUID();

  loggers.djp.info({ jobId, type: params.type, taxFilingId: params.taxFilingId }, 'Queuing job');

  // Insert job record
  const { error } = await supabase.from('djp_job').insert({
    id: jobId,
    type: params.type,
    tax_filing_id: params.taxFilingId || null,
    customer_id: params.customerId || null,
    payload: params.payload as unknown as Record<string, unknown>,
    priority: params.priority || 'NORMAL',
    status: 'PENDING' as DJPJobStatus,
    retry_count: 0,
    max_retries: params.maxRetries ?? 3,
    scheduled_at: params.scheduledAt?.toISOString() || null,
  });

  if (error) {
    loggers.djp.error({ jobId, err: error }, 'Failed to queue job');
    throw new Error(`Failed to queue DJP job: ${error.message}`);
  }

  // Update tax_filing status if applicable
  if (params.taxFilingId && params.type === 'E_FILING') {
    await supabase
      .from('tax_filing')
      .update({
        djp_submission_status: 'PENDING',
        djp_job_id: jobId,
      })
      .eq('id', params.taxFilingId);
  }

  // Process immediately in background (non-blocking)
  processDJPJob(jobId).catch((error) => {
    loggers.djp.error({ err: error }, 'Background processing failed');
  });

  return jobId;
}

/**
 * Process a DJP job
 */
async function processDJPJob(jobId: string): Promise<void> {
  const supabase = getAdminClient();

  // Get job details
  const { data: job, error: fetchError } = await supabase
    .from('djp_job')
    .select('*')
    .eq('id', jobId)
    .single<DJPJobRow>();

  if (fetchError || !job) {
    loggers.djp.error({ jobId }, 'Job not found');
    return;
  }

  // Check if scheduled for later
  if (job.scheduled_at && new Date(job.scheduled_at) > new Date()) {
    loggers.djp.info({ jobId, scheduledAt: job.scheduled_at }, 'Job scheduled for later');
    return;
  }

  // Check if already processing or completed
  if (job.status !== 'PENDING') {
    loggers.djp.info({ jobId, status: job.status }, 'Job not pending');
    return;
  }

  // Update status to PROCESSING
  await supabase
    .from('djp_job')
    .update({
      status: 'PROCESSING' as DJPJobStatus,
      started_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  loggers.djp.info({ jobId, type: job.type }, 'Processing job');

  try {
    let result: unknown;

    switch (job.type) {
      case 'E_FILING':
        result = await DJPService.submitFiling(job.payload as unknown as EFilingRequest);
        await handleEFilingResult(supabase, job, result as EFilingResponse);
        break;

      case 'E_BILLING':
        result = await DJPService.generateBilling(
          job.payload as unknown as EBillingRequest
        );
        await handleEBillingResult(supabase, job, result as EBillingResponse);
        break;

      case 'NPWP_VALIDATION':
        result = await DJPService.validateNPWP(
          job.payload as unknown as NPWPValidationRequest
        );
        break;

      case 'BPE_RETRIEVAL':
        result = await DJPService.retrieveBPE(
          job.payload as unknown as BPERetrievalRequest
        );
        await handleBPERetrievalResult(
          supabase,
          job,
          result as BPERetrievalResponse
        );
        break;
    }

    // Update job as completed
    await supabase
      .from('djp_job')
      .update({
        status: 'COMPLETED' as DJPJobStatus,
        result: result as Record<string, unknown>,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    loggers.djp.info({ jobId, type: job.type }, 'Job completed successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Check if should retry
    const newRetryCount = job.retry_count + 1;
    const shouldRetry = newRetryCount < job.max_retries;

    // Calculate next retry time with exponential backoff
    // 1min, 5min, 25min
    const retryDelayMs = Math.pow(5, newRetryCount) * 60 * 1000;

    await supabase
      .from('djp_job')
      .update({
        status: shouldRetry ? ('PENDING' as DJPJobStatus) : ('FAILED' as DJPJobStatus),
        retry_count: newRetryCount,
        error_message: errorMessage,
        completed_at: shouldRetry ? null : new Date().toISOString(),
        scheduled_at: shouldRetry
          ? new Date(Date.now() + retryDelayMs).toISOString()
          : null,
      })
      .eq('id', jobId);

    // Update tax_filing status if e-filing failed permanently
    if (job.tax_filing_id && job.type === 'E_FILING' && !shouldRetry) {
      await supabase
        .from('tax_filing')
        .update({
          djp_submission_status: 'FAILED',
          djp_error_message: errorMessage,
        })
        .eq('id', job.tax_filing_id);
    }

    loggers.djp.error({ jobId, error: errorMessage, willRetry: shouldRetry, retryCount: newRetryCount }, 'Job failed');

    // Report to Sentry
    captureJobError(error, {
      jobType: job.type,
      jobId,
      willRetry: shouldRetry,
      retryCount: newRetryCount,
      extra: { taxFilingId: job.tax_filing_id, customerId: job.customer_id },
    });
  }
}

// ============================================================================
// RESULT HANDLERS
// ============================================================================

/**
 * Handle e-Filing result and update tax_filing record
 */
async function handleEFilingResult(
  supabase: SupabaseClient,
  job: DJPJobRow,
  result: EFilingResponse
): Promise<void> {
  if (!job.tax_filing_id) return;

  const updateData: Record<string, unknown> = {
    djp_submission_status: result.status,
    djp_transaction_id: result.transactionId,
    djp_submitted_at: result.submissionTime?.toISOString?.() || new Date().toISOString(),
  };

  if (result.bpeNumber) {
    updateData.bpe_number = result.bpeNumber;
    updateData.bpe_date = result.bpeDate?.toISOString?.() || null;
    updateData.status = 'FILED';
  }

  if (result.errorCode) {
    updateData.djp_error_code = result.errorCode;
    updateData.djp_error_message = result.errorMessage;
  }

  // Update job with transaction ID
  await supabase
    .from('djp_job')
    .update({ djp_transaction_id: result.transactionId })
    .eq('id', job.id);

  await supabase
    .from('tax_filing')
    .update(updateData)
    .eq('id', job.tax_filing_id);

  loggers.djp.info({ taxFilingId: job.tax_filing_id, status: result.status, bpeNumber: result.bpeNumber }, 'e-Filing result saved');
}

/**
 * Handle e-Billing result
 */
async function handleEBillingResult(
  supabase: SupabaseClient,
  job: DJPJobRow,
  result: EBillingResponse
): Promise<void> {
  if (!result.success || !result.kodeBilling) return;

  const payload = job.payload as unknown as EBillingRequest;

  // Create or update billing record
  await supabase.from('djp_billing').insert({
    customer_id: job.customer_id,
    tax_filing_id: job.tax_filing_id,
    djp_job_id: job.id,
    kode_billing: result.kodeBilling,
    jenis_pajak: payload.jenisPajak,
    jenis_setoran: payload.jenisSetoran,
    masa_pajak: payload.masaPajak,
    tahun_pajak: payload.tahunPajak,
    jumlah_setor: payload.jumlahSetor,
    valid_until: result.validUntil?.toISOString() || null,
    status: 'ACTIVE',
  });

  loggers.djp.info({ kodeBilling: result.kodeBilling }, 'e-Billing record created');
}

/**
 * Handle BPE retrieval result
 */
async function handleBPERetrievalResult(
  supabase: SupabaseClient,
  job: DJPJobRow,
  result: BPERetrievalResponse
): Promise<void> {
  if (!job.tax_filing_id || !result.bpeNumber) return;

  await supabase
    .from('tax_filing')
    .update({
      bpe_number: result.bpeNumber,
      bpe_date: result.bpeDate?.toISOString() || null,
      djp_bpe_pdf: result.pdfBase64 || null,
      djp_submission_status: result.status,
    })
    .eq('id', job.tax_filing_id);

  loggers.djp.info({ taxFilingId: job.tax_filing_id, bpeNumber: result.bpeNumber }, 'BPE saved');
}

// ============================================================================
// STATUS & MANAGEMENT
// ============================================================================

/**
 * Get job status
 */
export async function getDJPJobStatus(
  jobId: string
): Promise<DJPJobStatusResponse | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('djp_job')
    .select('*')
    .eq('id', jobId)
    .single<DJPJobRow>();

  if (error || !data) {
    return null;
  }

  return {
    jobId: data.id,
    status: data.status as DJPJobStatus,
    progress: getProgressFromStatus(data.status as DJPJobStatus),
    result: (data.result as unknown) as
      | EFilingResponse
      | EBillingResponse
      | NPWPValidationResponse
      | BPERetrievalResponse
      | undefined,
    error: data.error_message || undefined,
    startedAt: data.started_at ? new Date(data.started_at) : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
  };
}

/**
 * Retry a failed job
 */
export async function retryDJPJob(jobId: string): Promise<boolean> {
  const supabase = getAdminClient();

  const { data: job, error } = await supabase
    .from('djp_job')
    .select('status, retry_count, max_retries')
    .eq('id', jobId)
    .single<Pick<DJPJobRow, 'status' | 'retry_count' | 'max_retries'>>();

  if (error || !job || job.status !== 'FAILED') {
    return false;
  }

  // Reset for retry
  await supabase
    .from('djp_job')
    .update({
      status: 'PENDING' as DJPJobStatus,
      retry_count: 0,
      error_message: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', jobId);

  loggers.djp.info({ jobId }, 'Job reset for retry');

  // Trigger processing
  processDJPJob(jobId).catch((err) => loggers.djp.error({ err }, 'Job retry processing failed'));

  return true;
}

/**
 * Cancel a pending job
 */
export async function cancelDJPJob(jobId: string): Promise<boolean> {
  const supabase = getAdminClient();

  const { data: job } = await supabase
    .from('djp_job')
    .select('status, tax_filing_id')
    .eq('id', jobId)
    .single<Pick<DJPJobRow, 'status' | 'tax_filing_id'>>();

  if (!job || job.status !== 'PENDING') {
    return false;
  }

  await supabase
    .from('djp_job')
    .update({
      status: 'CANCELLED' as DJPJobStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  // Update tax_filing if applicable
  if (job.tax_filing_id) {
    await supabase
      .from('tax_filing')
      .update({ djp_submission_status: 'CANCELLED' })
      .eq('id', job.tax_filing_id);
  }

  loggers.djp.info({ jobId }, 'Job cancelled');
  return true;
}

/**
 * Process pending jobs (for cron/worker)
 */
export async function processPendingDJPJobs(limit = 10): Promise<number> {
  const supabase = getAdminClient();

  const { data: jobs, error } = await supabase
    .from('djp_job')
    .select('id')
    .eq('status', 'PENDING')
    .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !jobs) {
    loggers.djp.error({ err: error }, 'Failed to fetch pending jobs');
    return 0;
  }

  loggers.djp.info({ count: jobs.length }, 'Processing pending jobs');

  // Process jobs concurrently
  await Promise.allSettled(jobs.map((job) => processDJPJob(job.id)));

  return jobs.length;
}

/**
 * Get progress percentage from status
 */
function getProgressFromStatus(status: DJPJobStatus): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'PROCESSING':
      return 50;
    case 'COMPLETED':
      return 100;
    case 'FAILED':
    case 'CANCELLED':
      return 0;
    default:
      return 0;
  }
}
