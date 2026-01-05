import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OcrResultResponseDto as OcrResultItemDto, TableResultDto } from './ocr-response.dto';

/**
 * Response DTO for GET /ocr/documents/:id/result (Story 2-5)
 * Contains document info + OCR results for the review UI
 */
export class DocumentOcrResultDto {
  @ApiProperty({ description: 'Document ID' })
  documentId!: string;

  @ApiProperty({ description: 'Original file URL' })
  fileUrl!: string;

  @ApiProperty({ description: 'MIME type of the document' })
  mimeType!: string;

  @ApiProperty({ description: 'Document status' })
  status!: string;

  @ApiProperty({ description: 'OCR results', type: [OcrResultItemDto] })
  results!: OcrResultItemDto[];

  @ApiPropertyOptional({ description: 'Table results', type: [TableResultDto] })
  tables?: TableResultDto[];

  @ApiProperty({ description: 'OCR engine used (PADDLEOCR or GEMINI)' })
  engine!: string;

  @ApiProperty({ description: 'Whether Gemini fallback was used' })
  fallbackUsed!: boolean;

  @ApiPropertyOptional({ description: 'Original PaddleOCR confidence before fallback' })
  originalConfidence?: number;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTimeMs!: number;
}
