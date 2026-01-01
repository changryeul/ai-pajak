import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OverrideAIResultDto {
  @ApiProperty({ example: '12000000' })
  @IsString()
  @IsNotEmpty()
  finalTax!: string;

  @ApiProperty({ example: 'Manual adjustment' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}