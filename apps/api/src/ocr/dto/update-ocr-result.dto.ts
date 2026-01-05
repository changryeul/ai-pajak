import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OcrFieldUpdateDto {
  @ApiProperty({ description: 'Field index to update' })
  @IsNumber()
  @Min(0)
  index!: number;

  @ApiProperty({ description: 'New value for the field' })
  @IsString()
  newValue!: string;
}

export class UpdateOcrResultDto {
  @ApiProperty({ description: 'Field index to update' })
  @IsNumber()
  @Min(0)
  fieldIndex!: number;

  @ApiProperty({ description: 'New value for the field' })
  @IsString()
  newValue!: string;
}

export class ConfirmOcrReviewDto {
  @ApiProperty({ description: 'List of field updates', type: [OcrFieldUpdateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcrFieldUpdateDto)
  updates!: OcrFieldUpdateDto[];
}
