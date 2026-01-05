import { ApiProperty } from '@nestjs/swagger';

export class OcrJobDataDto {
  @ApiProperty({ description: 'Document ID' })
  documentId!: string;
}

export class OcrJobStatusDto {
  @ApiProperty({ description: 'Job ID' })
  jobId!: string;

  @ApiProperty({
    description: 'Job status',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
  })
  status!: string;

  @ApiProperty({ description: 'Job progress (0-100)', required: false })
  progress?: number;

  @ApiProperty({ description: 'Number of attempts made' })
  attemptsMade!: number;

  @ApiProperty({ description: 'Job data', type: OcrJobDataDto })
  data!: OcrJobDataDto;
}
