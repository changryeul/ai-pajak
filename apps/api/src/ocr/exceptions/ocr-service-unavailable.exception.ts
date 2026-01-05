import { ServiceUnavailableException } from '@nestjs/common';

export class OcrServiceUnavailableException extends ServiceUnavailableException {
  constructor(message = 'OCR service is unavailable') {
    super({
      statusCode: 503,
      message,
      error: 'Service Unavailable',
    });
  }
}
