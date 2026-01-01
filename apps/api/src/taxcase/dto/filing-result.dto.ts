import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RecordFilingResultDto {
  @ApiProperty({ example: 'ACCEPTED' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ example: 'DJP-2024-000123' })
  @IsString()
  @IsNotEmpty()
  submissionRef!: string;
}