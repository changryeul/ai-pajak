import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OcrResponse,
  HealthCheckResponse,
  OcrInfoResponse,
} from './types/ocr.types';
import {
  OcrServiceUnavailableException,
  OcrProcessingException,
  OcrTimeoutException,
} from './exceptions';

@Injectable()
export class PaddleOcrClient {
  private readonly logger = new Logger(PaddleOcrClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries = 3;
  private readonly supportedMimeTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ];

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'PADDLEOCR_SERVICE_URL',
      'http://localhost:8080',
    );
    this.timeout = this.configService.get<number>(
      'PADDLEOCR_TIMEOUT_MS',
      30000,
    );
  }

  /**
   * Process a file through PaddleOCR
   * @param file - File buffer to process
   * @param mimeType - MIME type of the file (image/jpeg, image/png, application/pdf)
   * @param filename - Original filename
   * @returns OCR processing result
   * @throws BadRequestException if input validation fails
   */
  async process(
    file: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<OcrResponse> {
    // Input validation
    this.validateProcessInput(file, mimeType, filename);

    const formData = new FormData();
    const blob = new Blob([file], { type: mimeType });
    formData.append('file', blob, filename);

    this.logger.log(`Processing file: ${filename} (${mimeType})`);

    return this.fetchWithRetry(`${this.baseUrl}/ocr/process`, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Check health of PaddleOCR service
   * @returns Health check response
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // Short timeout for health check
      });

      if (!response.ok) {
        return { status: 'unhealthy' };
      }

      return (await response.json()) as HealthCheckResponse;
    } catch (error) {
      this.logger.warn(`Health check failed: ${error}`);
      return { status: 'unhealthy' };
    }
  }

  /**
   * Get PaddleOCR service info
   * @returns Service info including model version
   */
  async getInfo(): Promise<OcrInfoResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new OcrServiceUnavailableException('Failed to get OCR service info');
      }

      return (await response.json()) as OcrInfoResponse;
    } catch (error) {
      if (error instanceof OcrServiceUnavailableException) {
        throw error;
      }
      this.logger.warn(`Failed to get service info: ${error}`);
      throw new OcrServiceUnavailableException('OCR service info unavailable');
    }
  }

  /**
   * Fetch with retry logic using exponential backoff
   * @param url - URL to fetch
   * @param options - Fetch options
   * @param attempt - Current attempt number (1-based)
   * @returns OCR response
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1,
  ): Promise<OcrResponse> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt <= this.maxRetries) {
          this.logger.warn(
            `Server error (${response.status}), retrying... (attempt ${attempt}/${this.maxRetries})`,
          );
          return this.retryWithBackoff(url, options, attempt);
        }
        throw new OcrProcessingException(
          `OCR processing failed with status: ${response.status}`,
        );
      }

      return (await response.json()) as OcrResponse;
    } catch (error) {
      return this.handleFetchError(error, url, options, attempt);
    }
  }

  /**
   * Handle fetch errors with retry logic
   */
  private async handleFetchError(
    error: unknown,
    url: string,
    options: RequestInit,
    attempt: number,
  ): Promise<OcrResponse> {
    // Handle timeout errors (AbortSignal.timeout throws with name 'TimeoutError' or 'AbortError')
    if (this.isTimeoutError(error)) {
      if (attempt <= this.maxRetries) {
        this.logger.warn(
          `Request timed out, retrying... (attempt ${attempt}/${this.maxRetries})`,
        );
        return this.retryWithBackoff(url, options, attempt);
      }
      this.logger.error('OCR request timed out after all retries');
      throw new OcrTimeoutException('OCR request timed out after retries');
    }

    // Handle network errors (fetch throws TypeError for network failures)
    if (this.isNetworkError(error) && attempt <= this.maxRetries) {
      this.logger.warn(
        `Network error, retrying... (attempt ${attempt}/${this.maxRetries})`,
      );
      return this.retryWithBackoff(url, options, attempt);
    }

    // Re-throw known exceptions
    if (
      error instanceof OcrProcessingException ||
      error instanceof OcrTimeoutException ||
      error instanceof OcrServiceUnavailableException
    ) {
      throw error;
    }

    // Unknown error - service unavailable
    this.logger.error(`Unexpected error: ${error}`);
    throw new OcrServiceUnavailableException('PaddleOCR service unavailable');
  }

  /**
   * Retry with exponential backoff
   * @param url - URL to retry
   * @param options - Fetch options
   * @param attempt - Current attempt number
   * @returns OCR response
   */
  private async retryWithBackoff(
    url: string,
    options: RequestInit,
    attempt: number,
  ): Promise<OcrResponse> {
    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
    this.logger.log(`Waiting ${delay}ms before retry...`);
    await this.sleep(delay);
    return this.fetchWithRetry(url, options, attempt + 1);
  }

  /**
   * Check if error is a timeout error from AbortSignal.timeout()
   * Handles both TimeoutError and AbortError (varies by Node.js version)
   */
  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      (error instanceof DOMException && error.name === 'TimeoutError')
    );
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: unknown): boolean {
    return (
      error instanceof TypeError &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch'))
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate process input parameters
   * @throws BadRequestException if validation fails
   */
  private validateProcessInput(
    file: Buffer,
    mimeType: string,
    filename: string,
  ): void {
    if (!file || file.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('Filename is required');
    }

    if (!mimeType || !this.supportedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported MIME type: ${mimeType}. Supported types: ${this.supportedMimeTypes.join(', ')}`,
      );
    }
  }
}
