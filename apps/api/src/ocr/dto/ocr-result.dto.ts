import { ApiProperty } from '@nestjs/swagger';

export class OcrResultItemDto {
  @ApiProperty({ description: 'Extracted text' })
  text!: string;

  @ApiProperty({ description: 'Confidence score (0-1)' })
  confidence!: number;

  @ApiProperty({ description: 'Bounding box coordinates', type: [[Number]] })
  bbox!: number[][];

  @ApiProperty({ description: 'Page number' })
  page!: number;
}

export class OcrResultDto {
  @ApiProperty({ description: 'Processing success status' })
  success!: boolean;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTimeMs!: number;

  @ApiProperty({ description: 'OCR results', type: [OcrResultItemDto] })
  results!: OcrResultItemDto[];

  @ApiProperty({ description: 'OCR engine used' })
  engine!: string;

  @ApiProperty({ description: 'Average confidence score (0-100)' })
  averageConfidence!: number;
}
