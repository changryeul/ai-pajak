import {
  IsBoolean,
  IsNumber,
  IsArray,
  IsString,
  IsOptional,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OcrResult, TableResult } from '../types/ocr.types';

export class OcrResultResponseDto implements OcrResult {
  @IsString()
  text!: string;

  @IsNumber()
  @IsOptional()
  confidence!: number | null; // null for Gemini (no confidence provided)

  @IsArray()
  bbox!: number[][];

  @IsNumber()
  page!: number;
}

export class TableCellDto {
  @IsNumber()
  row!: number;

  @IsNumber()
  col!: number;

  @IsString()
  text!: string;

  @IsNumber()
  confidence!: number;
}

export class TableResultDto implements TableResult {
  @IsNumber()
  page!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableCellDto)
  cells!: TableCellDto[];

  @IsOptional()
  @IsArray()
  bbox?: number[][];

  @IsOptional()
  @IsString()
  html?: string;
}

export class OcrResponseDto {
  @IsBoolean()
  success!: boolean;

  @IsNumber()
  processing_time_ms!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcrResultResponseDto)
  results!: OcrResult[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableResultDto)
  tables?: TableResult[];

  @IsIn(['PADDLEOCR', 'GEMINI'])
  engine!: 'PADDLEOCR' | 'GEMINI';

  @IsString()
  model_version!: string;
}
