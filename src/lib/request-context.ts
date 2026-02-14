/**
 * Request Context Storage (Server-side only)
 *
 * Uses AsyncLocalStorage to provide request context anywhere in the call stack.
 * This is NOT compatible with Edge Runtime - only use in API routes and server components.
 *
 * Usage:
 * ```typescript
 * import { runWithRequestContext, getCurrentRequestContext } from '@/lib/request-context';
 *
 * // In API route handler:
 * export async function POST(request: Request) {
 *   const context = createRequestContext(request);
 *   return runWithRequestContextAsync(context, async () => {
 *     // Context is now available anywhere in the call stack
 *     logger.info('Processing request'); // Will include request ID
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request context for logging and tracing
 */
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  startTime: number;
}

/**
 * Async local storage for request context
 * This allows accessing request context anywhere in the call stack
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context from async local storage
 */
export function getCurrentRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Run a function with request context
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Run an async function with request context
 */
export async function runWithRequestContextAsync<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContextStorage.run(context, fn);
}

/**
 * Create request context from a request (server-side)
 */
export function createRequestContext(
  request: Request,
  userId?: string
): RequestContext {
  const url = new URL(request.url);

  // Get request ID from header or generate new one
  const requestId =
    request.headers.get('X-Request-ID') ||
    request.headers.get('X-Correlation-ID') ||
    request.headers.get('x-middleware-request-id') ||
    crypto.randomUUID();

  return {
    requestId,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: getClientIP(request),
    userId,
    startTime: Date.now(),
  };
}

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || undefined;
}

/**
 * Calculate request duration
 */
export function getRequestDuration(context: RequestContext): number {
  return Date.now() - context.startTime;
}

/**
 * Format log prefix with request context
 */
export function formatLogPrefix(context: RequestContext): string {
  return `[${context.requestId}] ${context.method} ${context.path}`;
}
