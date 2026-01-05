import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrQueueJobData } from '../document/types/document.types';

@Processor('ocr-processing')
export class OcrProcessingProcessor {
  private readonly logger = new Logger(OcrProcessingProcessor.name);

  constructor(private readonly ocrService: OcrService) {}

  /**
   * Handle OCR processing job from queue
   * Uses Gemini fallback when PaddleOCR confidence is below threshold
   * @param job - Bull job with OcrQueueJobData
   */
  @Process('process')
  async handleOcrProcessing(job: Job<OcrQueueJobData>): Promise<void> {
    const { documentId, filePath, mimeType } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting OCR processing for document: ${documentId}`);

    try {
      // Progress: 10% - Starting OCR processing
      await job.progress(10);

      // 1. Process document through OCR with fallback support
      const ocrResult = await this.ocrService.processDocumentWithFallback(
        documentId,
        filePath,
        mimeType,
      );

      // Progress: 70% - OCR completed, saving result
      await job.progress(70);

      // 2. Calculate processing time
      const processingTimeMs = Date.now() - startTime;

      // 3. Log detailed result with fallback information
      if (ocrResult.fallbackUsed) {
        this.logger.log(
          `OCR completed for document ${documentId} in ${processingTimeMs}ms ` +
            `[engine: GEMINI (fallback), original_paddle_confidence: ${ocrResult.originalPaddleConfidence.toFixed(2)}%]`,
        );
      } else if (ocrResult.geminiFailed) {
        this.logger.log(
          `OCR completed for document ${documentId} in ${processingTimeMs}ms ` +
            `[engine: PADDLEOCR (Gemini fallback failed), confidence: ${ocrResult.originalPaddleConfidence.toFixed(2)}%]`,
        );
      } else {
        this.logger.log(
          `OCR completed for document ${documentId} in ${processingTimeMs}ms ` +
            `[engine: PADDLEOCR, confidence: ${ocrResult.originalPaddleConfidence.toFixed(2)}%]`,
        );
      }

      // 4. Save result with fallback info and update status
      await this.ocrService.saveOcrResultWithFallback(
        documentId,
        ocrResult,
        processingTimeMs,
      );

      // Progress: 90% - Result saved, updating status
      await job.progress(90);

      await this.ocrService.updateDocumentStatus(documentId, 'COMPLETED');

      // Progress: 100% - Complete
      await job.progress(100);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `OCR processing failed for document ${documentId}: ${err.message}`,
        err.stack,
      );
      // Re-throw for Bull Queue automatic retry
      throw error;
    }
  }

  /**
   * Handle failed job after all retries exhausted
   * @param job - Failed job
   * @param error - Error that caused the failure
   */
  @OnQueueFailed()
  async handleFailedJob(job: Job<OcrQueueJobData>, error: Error): Promise<void> {
    const { documentId } = job.data;
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts for document ${documentId}`,
      error.stack,
    );

    // Update document status to FAILED after max retries (3 attempts)
    if (job.attemptsMade >= 3) {
      await this.ocrService.updateDocumentStatus(documentId, 'FAILED');
    }
  }
}
