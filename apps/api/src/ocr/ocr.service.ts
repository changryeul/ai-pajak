import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../repository/prisma.service';
import { PaddleOcrClient } from './paddleocr.client';
import { GeminiClient } from './gemini.client';
import { OcrResponse, OcrResultWithFallback } from './types/ocr.types';
import { GeminiFallbackException } from './exceptions';
import { DocumentOcrResultDto, OcrFieldUpdateDto } from './dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly uploadDir: string;
  private readonly fallbackThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddleOcrClient: PaddleOcrClient,
    private readonly geminiClient: GeminiClient,
    private readonly configService: ConfigService,
  ) {
    // Resolve upload directory to absolute path for security validation
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    // Fallback threshold: 0.85 = 85%
    this.fallbackThreshold = this.configService.get<number>(
      'GEMINI_FALLBACK_THRESHOLD',
      0.85,
    );
  }

  /**
   * Validate that file path is within the allowed upload directory
   * Prevents path traversal attacks
   * @param filePath - File path to validate
   * @throws BadRequestException if path is outside upload directory
   */
  private validateFilePath(filePath: string): void {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(this.uploadDir)) {
      this.logger.error(
        `Path traversal attempt detected: ${filePath} resolved to ${resolvedPath}`,
      );
      throw new BadRequestException('Invalid file path');
    }
  }

  /**
   * Validate document ID is a valid numeric string
   * @param documentId - Document ID to validate
   * @throws BadRequestException if ID is not a valid number
   */
  private validateDocumentId(documentId: string): bigint {
    if (!/^\d+$/.test(documentId)) {
      throw new BadRequestException('Invalid document ID format');
    }
    return BigInt(documentId);
  }

  /**
   * Process document through OCR
   * @param documentId - Document ID
   * @param filePath - Path to the file
   * @param mimeType - MIME type of the file
   * @returns OCR processing result
   */
  async processDocument(
    documentId: string,
    filePath: string,
    mimeType: string,
  ): Promise<OcrResponse> {
    this.logger.log(`Processing document ${documentId} from ${filePath}`);

    // Validate file path to prevent path traversal attacks
    this.validateFilePath(filePath);

    // Read file from disk
    const fileBuffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);

    // Call PaddleOCR client
    const result = await this.paddleOcrClient.process(
      fileBuffer,
      mimeType,
      filename,
    );

    return result;
  }

  /**
   * Save OCR result to AIResult table
   * @param documentId - Document ID
   * @param ocrResult - OCR response from PaddleOCR
   * @param processingTimeMs - Processing time in milliseconds
   */
  async saveOcrResult(
    documentId: string,
    ocrResult: OcrResponse,
    processingTimeMs: number,
  ): Promise<void> {
    const validDocumentId = this.validateDocumentId(documentId);

    // Get taxCaseId from document
    const document = await this.prisma.document.findUnique({
      where: { id: validDocumentId },
      select: { taxCaseId: true },
    });

    if (!document?.taxCaseId) {
      this.logger.warn(
        `Document ${documentId} has no associated taxCaseId - OCR result will not be saved to AIResult table. ` +
        `This is expected for standalone document uploads without tax case association.`,
      );
      return;
    }

    // Calculate average confidence
    const avgConfidence = this.calculateAverageConfidence(ocrResult);

    // Save AIResult
    await this.prisma.aIResult.create({
      data: {
        taxCaseId: document.taxCaseId,
        suggestedTax: '', // OCR result is not tax calculation
        confidence: avgConfidence / 100, // Convert to 0-1 scale
        rawResponse: ocrResult as any,
        ocrEngine: 'PADDLEOCR',
        confidenceScore: avgConfidence,
        processingTimeMs,
        fallbackUsed: false,
      },
    });

    this.logger.log(
      `OCR result saved for document ${documentId}, confidence: ${avgConfidence}%`,
    );
  }

  /**
   * Update document status
   * @param documentId - Document ID
   * @param status - New status (COMPLETED or FAILED)
   */
  async updateDocumentStatus(
    documentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    const validDocumentId = this.validateDocumentId(documentId);

    await this.prisma.document.update({
      where: { id: validDocumentId },
      data: { status },
    });

    this.logger.log(`Document ${documentId} status updated to ${status}`);
  }

  /**
   * Calculate average confidence from OCR results
   * @param ocrResult - OCR response
   * @returns Average confidence percentage (0-100), or 0 if no valid confidence values
   */
  calculateAverageConfidence(ocrResult: OcrResponse): number {
    if (!ocrResult.results || ocrResult.results.length === 0) {
      return 0;
    }

    // Filter out null confidence values (Gemini results)
    const validResults = ocrResult.results.filter(
      (result) => result.confidence !== null,
    );

    if (validResults.length === 0) {
      // All results have null confidence (e.g., Gemini)
      return 0;
    }

    const totalConfidence = validResults.reduce(
      (sum, result) => sum + (result.confidence as number),
      0,
    );

    return Math.round((totalConfidence / validResults.length) * 100) / 100;
  }

  /**
   * Process document with Gemini fallback if PaddleOCR confidence is low
   * @param documentId - Document ID
   * @param filePath - Path to the file
   * @param mimeType - MIME type of the file
   * @returns OCR result with fallback information
   */
  async processDocumentWithFallback(
    documentId: string,
    filePath: string,
    mimeType: string,
  ): Promise<OcrResultWithFallback> {
    this.logger.log(
      `Processing document ${documentId} with fallback support`,
    );

    // 1. Try PaddleOCR first
    const paddleResult = await this.processDocument(
      documentId,
      filePath,
      mimeType,
    );
    const avgConfidence = this.calculateAverageConfidence(paddleResult);

    // Convert to percentage for logging (avgConfidence is in 0-1 scale)
    const avgConfidencePercent = avgConfidence * 100;
    const thresholdPercent = this.fallbackThreshold * 100;

    this.logger.log(
      `PaddleOCR result for document ${documentId}: confidence ${avgConfidencePercent.toFixed(2)}%`,
    );

    // 2. Check if fallback is needed (confidence below threshold)
    // Compare in 0-1 scale: avgConfidence vs fallbackThreshold
    if (avgConfidence >= this.fallbackThreshold) {
      // Confidence is good, use PaddleOCR result
      this.logger.log(
        `Document ${documentId}: PaddleOCR confidence ${avgConfidencePercent.toFixed(2)}% >= threshold ${thresholdPercent}%. Using PaddleOCR result.`,
      );
      return {
        ...paddleResult,
        fallbackUsed: false,
        originalPaddleConfidence: avgConfidence,
      };
    }

    // 3. Trigger Gemini fallback
    this.logger.log(
      `Document ${documentId}: Confidence ${avgConfidencePercent.toFixed(2)}% < threshold ${thresholdPercent}%. ` +
        `Triggering Gemini fallback.`,
    );

    // Check if Gemini is configured
    if (!this.geminiClient.isConfigured()) {
      this.logger.warn(
        `Document ${documentId}: Gemini API not configured. Using PaddleOCR result despite low confidence.`,
      );
      return {
        ...paddleResult,
        fallbackUsed: false,
        originalPaddleConfidence: avgConfidence,
        geminiFailed: true,
      };
    }

    try {
      // Read file for Gemini processing
      const fileBuffer = await fs.readFile(filePath);

      // Call Gemini Vision API
      const geminiResult = await this.geminiClient.processWithVision(
        fileBuffer,
        mimeType,
        avgConfidence,
      );

      this.logger.log(
        `Document ${documentId}: Gemini fallback successful. ` +
          `Original PaddleOCR confidence: ${avgConfidencePercent.toFixed(2)}%`,
      );

      // Log for A/B comparison analysis
      this.logFallbackComparison(documentId, paddleResult, geminiResult, avgConfidence);

      return {
        ...geminiResult,
        fallbackUsed: true,
        originalPaddleConfidence: avgConfidence,
      };
    } catch (error) {
      // Gemini failed, fall back to PaddleOCR original result (AC #4)
      const err = error as Error;
      this.logger.error(
        `Document ${documentId}: Gemini fallback failed: ${err.message}. ` +
          `Falling back to PaddleOCR original result.`,
      );

      return {
        ...paddleResult,
        fallbackUsed: false,
        originalPaddleConfidence: avgConfidence,
        geminiFailed: true,
      };
    }
  }

  /**
   * Log fallback comparison for A/B analysis (AC #3)
   * @param documentId - Document ID
   * @param paddleResult - Original PaddleOCR result
   * @param geminiResult - Gemini fallback result
   * @param originalConfidence - Original PaddleOCR confidence
   */
  private logFallbackComparison(
    documentId: string,
    paddleResult: OcrResponse,
    geminiResult: OcrResponse,
    originalConfidence: number,
  ): void {
    const paddleTextLength = paddleResult.results
      .map((r) => r.text)
      .join('')
      .length;
    const geminiTextLength = geminiResult.results
      .map((r) => r.text)
      .join('')
      .length;

    this.logger.log(
      `[A/B Comparison] Document ${documentId}: ` +
        `PaddleOCR (confidence: ${originalConfidence.toFixed(2)}%, chars: ${paddleTextLength}) -> ` +
        `Gemini (chars: ${geminiTextLength}). ` +
        `Text length diff: ${geminiTextLength - paddleTextLength} chars.`,
    );
  }

  /**
   * Save OCR result with fallback support to AIResult table
   * @param documentId - Document ID
   * @param ocrResult - OCR response with fallback info
   * @param processingTimeMs - Processing time in milliseconds
   */
  async saveOcrResultWithFallback(
    documentId: string,
    ocrResult: OcrResultWithFallback,
    processingTimeMs: number,
  ): Promise<void> {
    const validDocumentId = this.validateDocumentId(documentId);

    // Get taxCaseId from document
    const document = await this.prisma.document.findUnique({
      where: { id: validDocumentId },
      select: { taxCaseId: true },
    });

    if (!document?.taxCaseId) {
      this.logger.warn(
        `Document ${documentId} has no associated taxCaseId - OCR result will not be saved to AIResult table.`,
      );
      return;
    }

    // Calculate average confidence (0 for Gemini since it doesn't provide confidence)
    const avgConfidence = this.calculateAverageConfidence(ocrResult);
    const engine = ocrResult.fallbackUsed ? 'GEMINI' : 'PADDLEOCR';

    // For Gemini, confidenceScore is null since it doesn't provide confidence
    const confidenceScore = ocrResult.fallbackUsed ? null : avgConfidence;

    await this.prisma.aIResult.create({
      data: {
        taxCaseId: document.taxCaseId,
        suggestedTax: '', // OCR result is not tax calculation
        // Legacy field (required): Use 0 for Gemini since it doesn't provide confidence
        confidence: ocrResult.fallbackUsed ? 0 : avgConfidence / 100,
        rawResponse: {
          ...ocrResult,
          originalPaddleConfidence: ocrResult.originalPaddleConfidence,
        } as any,
        ocrEngine: engine,
        // Phase 2 field (optional): null for Gemini, actual confidence for PaddleOCR
        confidenceScore,
        processingTimeMs,
        fallbackUsed: ocrResult.fallbackUsed,
      },
    });

    this.logger.log(
      `OCR result saved for document ${documentId} ` +
        `[engine: ${engine}, fallback: ${ocrResult.fallbackUsed}, ` +
        `confidence: ${confidenceScore !== null ? `${confidenceScore.toFixed(2)}%` : 'N/A (Gemini)'}` +
        `${ocrResult.fallbackUsed ? `, original_paddle: ${ocrResult.originalPaddleConfidence.toFixed(2)}%` : ''}]`,
    );
  }

  /**
   * Get OCR result for a document (Story 2-5)
   * @param documentId - Document ID
   * @returns OCR result response with document info and results
   */
  async getOcrResult(documentId: string): Promise<DocumentOcrResultDto> {
    const validDocumentId = this.validateDocumentId(documentId);

    // Get document with OCR result
    const document = await this.prisma.document.findUnique({
      where: { id: validDocumentId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        path: true,
        status: true,
        taxCaseId: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    // Get AIResult for this document's taxCase
    let aiResult = null;
    if (document.taxCaseId) {
      aiResult = await this.prisma.aIResult.findFirst({
        where: { taxCaseId: document.taxCaseId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!aiResult) {
      throw new NotFoundException(`OCR result for document ${documentId} not found`);
    }

    // Parse rawResponse (cast through unknown due to Prisma JsonValue type)
    const rawResponse = aiResult.rawResponse as unknown as OcrResultWithFallback;

    // Build file URL (TODO: Epic 10 - Replace with S3 URL)
    const fileUrl = `/api/documents/${documentId}/file`;

    return {
      documentId: document.id.toString(),
      fileUrl,
      mimeType: document.mimeType,
      status: document.status,
      results: rawResponse.results.map((r) => ({
        text: r.text,
        confidence: r.confidence,
        bbox: r.bbox,
        page: r.page,
      })),
      tables: rawResponse.tables?.map((t) => ({
        page: t.page,
        cells: t.cells.map((c) => ({
          row: c.row,
          col: c.col,
          text: c.text,
          confidence: c.confidence,
        })),
      })),
      engine: rawResponse.engine,
      fallbackUsed: rawResponse.fallbackUsed || false,
      originalConfidence: rawResponse.originalPaddleConfidence,
      processingTimeMs: aiResult.processingTimeMs || 0,
    };
  }

  /**
   * Update a single OCR result field (Story 2-5)
   * @param documentId - Document ID
   * @param fieldIndex - Index of the field to update
   * @param newValue - New value for the field
   */
  async updateOcrField(
    documentId: string,
    fieldIndex: number,
    newValue: string,
  ): Promise<void> {
    const validDocumentId = this.validateDocumentId(documentId);

    // Get document with taxCaseId
    const document = await this.prisma.document.findUnique({
      where: { id: validDocumentId },
      select: { taxCaseId: true },
    });

    if (!document?.taxCaseId) {
      throw new NotFoundException(`Document ${documentId} not found or has no taxCase`);
    }

    // Get latest AIResult
    const aiResult = await this.prisma.aIResult.findFirst({
      where: { taxCaseId: document.taxCaseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!aiResult) {
      throw new NotFoundException(`OCR result for document ${documentId} not found`);
    }

    // Update the field in rawResponse (cast through unknown due to Prisma JsonValue type)
    const rawResponse = aiResult.rawResponse as unknown as OcrResultWithFallback;
    if (fieldIndex < 0 || fieldIndex >= rawResponse.results.length) {
      throw new BadRequestException(`Invalid field index: ${fieldIndex}`);
    }

    rawResponse.results[fieldIndex].text = newValue;

    // Save updated rawResponse
    await this.prisma.aIResult.update({
      where: { id: aiResult.id },
      data: { rawResponse: rawResponse as any },
    });

    this.logger.log(
      `OCR field ${fieldIndex} updated for document ${documentId}: "${newValue.substring(0, 50)}..."`,
    );
  }

  /**
   * Confirm OCR review and update document status to REVIEWED (Story 2-5)
   * Task 2.5: Records modification history (who, when, which fields)
   * @param documentId - Document ID
   * @param updates - List of field updates
   */
  async confirmOcrReview(
    documentId: string,
    updates: OcrFieldUpdateDto[],
  ): Promise<void> {
    const validDocumentId = this.validateDocumentId(documentId);

    // Get document with taxCaseId
    const document = await this.prisma.document.findUnique({
      where: { id: validDocumentId },
      select: { taxCaseId: true, status: true },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    if (!document.taxCaseId) {
      throw new BadRequestException(`Document ${documentId} has no taxCase`);
    }

    // Get latest AIResult
    const aiResult = await this.prisma.aIResult.findFirst({
      where: { taxCaseId: document.taxCaseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!aiResult) {
      throw new NotFoundException(`OCR result for document ${documentId} not found`);
    }

    // Apply all updates (cast through unknown due to Prisma JsonValue type)
    const rawResponse = aiResult.rawResponse as unknown as OcrResultWithFallback;
    const modificationDetails: string[] = [];

    for (const update of updates) {
      if (update.index >= 0 && update.index < rawResponse.results.length) {
        const oldValue = rawResponse.results[update.index].text;
        rawResponse.results[update.index].text = update.newValue;
        modificationDetails.push(
          `Field[${update.index}]: "${oldValue.substring(0, 30)}..." → "${update.newValue.substring(0, 30)}..."`
        );
      }
    }

    // Build audit action string with modification details
    const auditAction = JSON.stringify({
      type: 'OCR_REVIEW_CONFIRMED',
      documentId,
      fieldsModified: updates.length,
      modifications: modificationDetails,
      timestamp: new Date().toISOString(),
      // TODO: Epic 3 - Add userId from JWT token
    });

    // Save updated rawResponse, update document status, and create audit log
    await this.prisma.$transaction([
      this.prisma.aIResult.update({
        where: { id: aiResult.id },
        data: { rawResponse: rawResponse as any },
      }),
      this.prisma.document.update({
        where: { id: validDocumentId },
        data: { status: 'REVIEWED' },
      }),
      // Task 2.5: Record modification history
      this.prisma.auditLog.create({
        data: {
          taxCaseId: document.taxCaseId,
          action: auditAction,
          // actorId: TODO Epic 3 - get from JWT context
        },
      }),
    ]);

    this.logger.log(
      `OCR review confirmed for document ${documentId}: ${updates.length} fields updated, status -> REVIEWED, audit logged`,
    );
  }
}
