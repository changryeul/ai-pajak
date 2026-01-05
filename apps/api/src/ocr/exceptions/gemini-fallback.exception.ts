import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when Gemini fallback fails after all retries
 */
export class GeminiFallbackException extends HttpException {
  constructor(
    message: string,
    public readonly originalPaddleConfidence: number,
  ) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        error: 'Gemini Fallback Failed',
        details: {
          originalPaddleConfidence,
          fallbackAttempted: true,
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
