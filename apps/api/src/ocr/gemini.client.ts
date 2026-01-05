import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GeminiFallbackException } from './exceptions';

/**
 * OCR result from Gemini Vision API
 * Note: Gemini does not provide confidence scores, so confidence is null
 */
export interface GeminiOcrResult {
  text: string;
  confidence: null; // Gemini does not provide confidence scores
  bbox: number[][]; // Empty - Gemini does not provide bounding boxes
  page: number;
}

/**
 * Full OCR Response from Gemini Vision API
 */
export interface GeminiOcrResponse {
  success: boolean;
  processing_time_ms: number;
  results: GeminiOcrResult[];
  engine: 'GEMINI';
  model_version: string;
}

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxRetries = 3;
  private readonly supportedMimeTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ];

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not configured. Gemini fallback will not be available.',
      );
      // Initialize with empty key - will fail on actual use
      this.ai = new GoogleGenAI({ apiKey: '' });
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }
    this.model = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-3.0-flash',
    );
    this.timeout = this.configService.get<number>('GEMINI_TIMEOUT_MS', 30000);
  }

  /**
   * Check if Gemini client is properly configured
   * @returns true if API key is configured
   */
  isConfigured(): boolean {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    return !!apiKey;
  }

  /**
   * Validate MIME type for Gemini Vision API
   * @param mimeType - MIME type to validate
   * @returns true if supported
   */
  isSupportedMimeType(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }

  /**
   * Log warning about known limitations for rotated text (AC #6)
   * Gemini 3.0 Flash has known issues with rotated text (90°/180°/270°)
   * @param mimeType - MIME type of the file
   */
  private logRotatedTextWarning(mimeType: string): void {
    // Log warning for all image types as rotation detection requires image analysis
    // PDF files can also contain rotated text/images
    this.logger.warn(
      `[Known Limitation] Gemini fallback triggered for ${mimeType}. ` +
        `Gemini 3.0 Flash has reduced accuracy for rotated text (90°/180°/270°). ` +
        `If OCR results are poor, consider checking for document rotation.`,
    );
  }

  /**
   * Process document with Gemini Vision API for OCR fallback
   * @param fileBuffer - File content as Buffer
   * @param mimeType - MIME type of the file
   * @param originalConfidence - Original PaddleOCR confidence (for logging)
   * @returns OCR response with extracted text
   * @throws GeminiFallbackException if all retries fail
   */
  async processWithVision(
    fileBuffer: Buffer,
    mimeType: string,
    originalConfidence: number,
  ): Promise<GeminiOcrResponse> {
    if (!this.isConfigured()) {
      throw new GeminiFallbackException(
        'Gemini API key is not configured',
        originalConfidence,
      );
    }

    if (!this.isSupportedMimeType(mimeType)) {
      throw new GeminiFallbackException(
        `Unsupported MIME type for Gemini: ${mimeType}`,
        originalConfidence,
      );
    }

    // AC #6: Log warning about rotated text limitation
    this.logRotatedTextWarning(mimeType);

    this.logger.log(
      `Gemini fallback triggered - Original PaddleOCR confidence: ${originalConfidence.toFixed(2)}%`,
    );

    const base64Data = fileBuffer.toString('base64');
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callGeminiWithTimeout(base64Data, mimeType);
        const processingTime = Date.now() - startTime;

        this.logger.log(
          `Gemini OCR completed in ${processingTime}ms (attempt ${attempt})`,
        );

        return this.parseGeminiResponse(response, processingTime);
      } catch (error) {
        const err = error as Error;
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s

        this.logger.warn(
          `Gemini attempt ${attempt}/${this.maxRetries} failed: ${err.message}. ` +
            `${attempt < this.maxRetries ? `Retrying in ${delay}ms...` : 'No more retries.'}`,
        );

        if (attempt === this.maxRetries) {
          throw new GeminiFallbackException(
            `Gemini fallback failed after ${this.maxRetries} attempts: ${err.message}`,
            originalConfidence,
          );
        }

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new GeminiFallbackException(
      'Unexpected error in Gemini fallback',
      originalConfidence,
    );
  }

  /**
   * Call Gemini API with timeout
   * @param base64Data - Base64 encoded file data
   * @param mimeType - MIME type of the file
   * @returns Gemini API response
   */
  private async callGeminiWithTimeout(
    base64Data: string,
    mimeType: string,
  ): Promise<any> {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini request timed out after ${this.timeout}ms`));
      }, this.timeout);
    });

    // IMPORTANT: Research shows simple prompts perform better
    // Detailed prompts can cause model to refuse or degrade performance
    const apiPromise = this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          // Simple prompt - PLANET AI benchmark recommendation
          text: 'Extract all text from this image.',
        },
      ],
    });

    // Race between API call and timeout
    return Promise.race([apiPromise, timeoutPromise]);
  }

  /**
   * Parse Gemini API response into OcrResponse format
   * @param response - Gemini API response
   * @param processingTimeMs - Processing time in milliseconds
   * @returns Parsed OCR response
   */
  private parseGeminiResponse(
    response: any,
    processingTimeMs: number,
  ): GeminiOcrResponse {
    const textContent =
      response.candidates?.[0]?.content?.parts
        ?.filter((part: any) => part.text)
        ?.map((part: any) => part.text)
        ?.join('\n') || '';

    // IMPORTANT: Gemini does not provide confidence scores
    // - confidence: null to indicate "no confidence available"
    // - DB will store confidenceScore as null
    // - UI should display "AI Processed" or "Gemini Processed" instead of percentage
    const results: GeminiOcrResult[] = textContent
      .split('\n')
      .filter((line: string) => line.trim())
      .map((text: string) => ({
        text: text.trim(),
        confidence: null, // Gemini does not provide confidence
        bbox: [], // Gemini does not provide bounding boxes
        page: 1,
      }));

    return {
      success: true,
      processing_time_ms: processingTimeMs,
      results,
      engine: 'GEMINI' as const,
      model_version: this.model,
    };
  }

  /**
   * Sleep utility for exponential backoff
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
