import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class ApplyAIResultDto {
  @ApiProperty({
    example: '12500000',
    description: 'AI가 제안한 세금 금액',
  })
  @IsString()
  @IsNotEmpty()
  suggestedTax!: string;

  @ApiProperty({
    example: 0.87,
    required: false,
    description: 'AI 신뢰도 (0~1)',
  })
  //@IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiProperty({
    required: false,
    description: 'AI 원본 응답(JSON)',
    example: {
      model: 'gpt-4',
      reason: 'income analysis',
    },
  })
  @IsOptional()
  rawResponse?: any;
}