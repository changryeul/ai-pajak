export interface DocumentResponseDto {
  id: string; // BigInt as string
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taxCaseId?: string;
  ocrJobId?: string; // OCR 큐 작업 ID
  createdAt: string; // ISO 8601
}

export interface DocumentStatusResponseDto {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  ocrJobId?: string;
}
