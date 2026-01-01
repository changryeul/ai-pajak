import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateTaxCaseDto {
  @ApiProperty({
    example: '1',
    description: '회사 ID (Company ID)',
  })
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @ApiProperty({
    example: 'VAT',
    description: '세금 유형 (VAT, PPH21 등)',
  })
  @IsString()
  @IsNotEmpty()
  taxType!: string;

  @ApiProperty({
    example: '2024-12',
    description: '과세 기간 (YYYY-MM)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'period must be YYYY-MM format',
  })
  period!: string;
}