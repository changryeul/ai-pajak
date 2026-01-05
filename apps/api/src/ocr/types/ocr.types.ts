/**
 * OCR Engine types
 */
export type OcrEngine = 'PADDLEOCR' | 'GEMINI';

/**
 * OCR Result from OCR service
 * Note: Gemini does not provide confidence scores, so confidence can be null
 */
export interface OcrResult {
  text: string;
  confidence: number | null; // null for Gemini (no confidence provided)
  bbox: number[][]; // [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] - empty for Gemini
  page: number;
}

/**
 * Table cell extracted from OCR
 */
export interface TableCell {
  row: number;
  col: number;
  text: string;
  confidence: number;
}

/**
 * Table result from OCR processing
 */
export interface TableResult {
  page: number;
  cells: TableCell[];
  bbox?: number[][];
  html?: string;
}

/**
 * Full OCR Response from OCR service (PaddleOCR or Gemini)
 */
export interface OcrResponse {
  success: boolean;
  processing_time_ms: number;
  results: OcrResult[];
  tables?: TableResult[];
  engine: OcrEngine; // Union type for both engines
  model_version: string;
}

/**
 * OCR Result with Fallback information
 * Used when Gemini fallback is triggered due to low PaddleOCR confidence
 */
export interface OcrResultWithFallback extends OcrResponse {
  /** Whether Gemini fallback was used */
  fallbackUsed: boolean;
  /** Original PaddleOCR average confidence (before fallback) */
  originalPaddleConfidence: number;
  /** Whether Gemini failed and fell back to PaddleOCR original result */
  geminiFailed?: boolean;
}

/**
 * Health check response from PaddleOCR service
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
}

/**
 * Info response from PaddleOCR service
 */
export interface OcrInfoResponse {
  version: string;
  model: string;
  supported_formats: string[];
}
