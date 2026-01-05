import { FileValidator } from '@nestjs/common';

export interface CustomFileTypeValidatorOptions {
  fileTypes: string[];
}

/**
 * Custom file type validator that accepts multiple MIME types
 * NestJS built-in FileTypeValidator has regex matching issues
 */
export class CustomFileTypeValidator extends FileValidator<CustomFileTypeValidatorOptions> {
  buildErrorMessage(): string {
    return `Validation failed (expected type is one of: ${this.validationOptions.fileTypes.join(', ')})`;
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }
    return this.validationOptions.fileTypes.includes(file.mimetype);
  }
}
