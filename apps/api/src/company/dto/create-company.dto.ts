import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({
    example: 'Test Company',
    description: '회사명',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: '01.234.567.8-999.000',
    description: '인도네시아 NPWP 번호',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/, {
    message: 'NPWP format is invalid',
  })
  npwp!: string;
}