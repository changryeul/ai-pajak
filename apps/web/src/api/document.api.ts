import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface UploadResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taxCaseId?: string;
  ocrJobId?: string;
  createdAt: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  ocrJobId?: string;
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
