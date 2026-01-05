import { IsString, IsNotEmpty } from 'class-validator';

export class ProcessOcrDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}
