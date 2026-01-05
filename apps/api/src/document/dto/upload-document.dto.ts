import { IsOptional, IsNumberString } from 'class-validator';

export class UploadDocumentDto {
  @IsOptional()
  @IsNumberString()
  taxCaseId?: string; // BigInt as string
}
