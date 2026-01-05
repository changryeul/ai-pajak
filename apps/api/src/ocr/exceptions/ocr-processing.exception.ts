import { InternalServerErrorException } from '@nestjs/common';

export class OcrProcessingException extends InternalServerErrorException {
  constructor(message = 'OCR processing failed') {
    super({
      statusCode: 500,
      message,
      error: 'Internal Server Error',
    });
  }
}
