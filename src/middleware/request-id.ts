import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Request ID / Correlation ID Middleware (Edge Runtime Compatible)
 *
 * Generates a unique ID for each request to enable:
 * - Request tracing across services
 * - Log correlation
 * - Debugging and monitoring
 *
 * The ID is:
 * 1. Extracted from incoming `X-Request-ID` header (for distributed tracing)
 * 2. Or generated as a new UUID
 * 3. Propagated to response headers
 *
 * Note: For server-side request context storage (AsyncLocalStorage),
 * use `@/lib/request-context` instead.
 */

export const REQUEST_ID_HEADER = 'X-Request-ID';
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/**
 * Generate a request ID using Web Crypto API (Edge Runtime compatible)
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Extract or generate request ID from a request
 */
export function getRequestId(request: NextRequest | Request): string {
  // Check for existing request ID (for distributed tracing)
  const existingId =
    request.headers.get(REQUEST_ID_HEADER) ||
    request.headers.get(CORRELATION_ID_HEADER);

  if (existingId) {
    return existingId;
  }

  // Generate new ID
  return generateRequestId();
}

/**
 * Middleware to add request ID to requests and responses
 */
export function withRequestId(
  request: NextRequest
): { requestId: string; headers: Headers } {
  const requestId = getRequestId(request);

  // Create new headers with request ID
  const headers = new Headers();
  headers.set(REQUEST_ID_HEADER, requestId);

  return { requestId, headers };
}

/**
 * Add request ID to a response
 */
export function addRequestIdToResponse(
  response: NextResponse,
  requestId: string
): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

// Re-export types for convenience (these are also in @/lib/request-context)
export type { RequestContext } from '@/lib/request-context';
