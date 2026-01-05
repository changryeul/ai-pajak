import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface UploadResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEWED';
  taxCaseId?: string;
  ocrJobId?: string;
  createdAt: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEWED';
  ocrJobId?: string;
}

// Story 2-5: OCR Review Types
export interface OcrResultItem {
  text: string;
  confidence: number | null;
  bbox: number[][];
  page: number;
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  confidence: number;
}

export interface TableResult {
  page: number;
  cells: TableCell[];
}

export interface OcrResultResponse {
  documentId: string;
  fileUrl: string;
  mimeType: string;
  status: string;
  results: OcrResultItem[];
  tables?: TableResult[];
  engine: string;
  fallbackUsed: boolean;
  originalConfidence?: number;
  processingTimeMs: number;
}

export interface OcrFieldUpdate {
  index: number;
  newValue: string;
}

/**
 * Upload a document file
 * @param file - File to upload
 * @param taxCaseId - Optional tax case ID to associate with
 * @param onProgress - Progress callback (0-100)
 * @returns Upload response with document ID and OCR job ID
 */
export async function uploadDocument(
  file: File,
  taxCaseId?: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (taxCaseId) {
    formData.append('taxCaseId', taxCaseId);
  }

  const response = await axios.post<UploadResponse>(
    `${API_BASE_URL}/documents/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        // TODO: Epic 3 (Authentication & Authorization) - Replace with actual auth token
        // - 현재: 개발용 하드코딩된 user ID
        // - 변경: JWT 토큰에서 추출한 사용자 ID
        // - 참조: architecture.md#Authentication & Authorization
        'x-user-id': '1',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(percent);
        }
      },
    },
  );

  return response.data;
}

/**
 * Get document status by ID
 * @param id - Document ID
 * @returns Document status response
 */
export async function getDocumentStatus(id: string): Promise<DocumentStatusResponse> {
  const response = await axios.get<DocumentStatusResponse>(
    `${API_BASE_URL}/documents/${id}/status`,
    {
      headers: {
        // TODO: Epic 3 - Replace with auth token from context
        'x-user-id': '1',
      },
    },
  );
  return response.data;
}

/**
 * Get full document details by ID
 * @param id - Document ID
 * @returns Full upload response
 */
export async function getDocument(id: string): Promise<UploadResponse> {
  const response = await axios.get<UploadResponse>(
    `${API_BASE_URL}/documents/${id}`,
    {
      headers: {
        // TODO: Epic 3 - Replace with auth token from context
        'x-user-id': '1',
      },
    },
  );
  return response.data;
}

// Story 2-5: OCR Review API Functions

/**
 * Get OCR result for a document
 * @param documentId - Document ID
 * @returns OCR result with extracted data and document info
 */
export async function getOcrResult(documentId: string): Promise<OcrResultResponse> {
  const response = await axios.get<OcrResultResponse>(
    `${API_BASE_URL}/ocr/documents/${documentId}/result`,
    {
      headers: {
        // TODO: Epic 3 - Replace with auth token from context
        'x-user-id': '1',
      },
    },
  );
  return response.data;
}

/**
 * Update a single OCR result field
 * @param documentId - Document ID
 * @param fieldIndex - Index of the field to update
 * @param newValue - New value for the field
 */
export async function updateOcrField(
  documentId: string,
  fieldIndex: number,
  newValue: string,
): Promise<void> {
  await axios.patch(
    `${API_BASE_URL}/ocr/documents/${documentId}/result`,
    { fieldIndex, newValue },
    {
      headers: {
        // TODO: Epic 3 - Replace with auth token from context
        'x-user-id': '1',
      },
    },
  );
}

/**
 * Confirm OCR review and update document status
 * @param documentId - Document ID
 * @param updates - List of field updates to apply
 */
export async function confirmOcrReview(
  documentId: string,
  updates: OcrFieldUpdate[],
): Promise<void> {
  await axios.post(
    `${API_BASE_URL}/ocr/documents/${documentId}/confirm`,
    { updates },
    {
      headers: {
        // TODO: Epic 3 - Replace with auth token from context
        'x-user-id': '1',
      },
    },
  );
}
