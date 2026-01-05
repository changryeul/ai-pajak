import { BadRequestException } from '@nestjs/common';

/**
 * Custom file validation exceptions for the Document module.
 *
 * Note: For controller-level validation, NestJS built-in ParseFilePipe with
 * MaxFileSizeValidator and FileTypeValidator are used.
 *
 * These custom exceptions are useful for:
 * - Service-level validation (e.g., re-validating files after processing)
 * - Custom validation logic beyond MIME type/size checks
 * - Consistent error messaging across the application
 */

export class InvalidFileException extends BadRequestException {
  constructor(message: string) {
    super({
      statusCode: 400,
      error: 'Invalid File',
      message,
    });
  }
}

export class InvalidFileTypeException extends InvalidFileException {
  constructor(mimeType: string, allowedTypes: readonly string[]) {
    super(
      `Invalid file type: ${mimeType}. Allowed types: ${allowedTypes.join(', ')}`,
    );
  }
}

export class FileTooLargeException extends InvalidFileException {
  constructor(size: number, maxSize: number) {
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    super(`File size (${sizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`);
  }
}

/**
 * Utility function to validate file at service level
 */
export function validateFile(
  file: { mimetype: string; size: number },
  allowedTypes: readonly string[],
  maxSize: number,
): void {
  if (!allowedTypes.includes(file.mimetype as typeof allowedTypes[number])) {
    throw new InvalidFileTypeException(file.mimetype, allowedTypes);
  }
  if (file.size > maxSize) {
    throw new FileTooLargeException(file.size, maxSize);
  }
}
