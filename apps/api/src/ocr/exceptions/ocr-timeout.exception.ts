import { RequestTimeoutException } from '@nestjs/common';

export class OcrTimeoutException extends RequestTimeoutException {
  constructor(message = 'OCR request timed out') {
    super({
      statusCode: 408,
      message,
      error: 'Request Timeout',
    });
  }
}
