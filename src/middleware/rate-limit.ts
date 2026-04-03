import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loggers } from '@/lib/logger';

// Create Redis client - uses environment variables automatically
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Check if Upstash is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

/**
 * Rate limiters for different endpoint types
 */
export const rateLimiters = {
  // General API: 100 requests per minute
  general: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:general',
  }),

  // Auth endpoints: 10 requests per minute (prevent brute force)
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Payment endpoints: 20 requests per minute
  payment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),

  // File upload: 30 requests per minute
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),

  // Webhook endpoints: 100 requests per minute (external services)
  webhook: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:webhook',
  }),

  // Tax calculation: 50 requests per minute
  tax: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 m'),
    analytics: true,
    prefix: 'ratelimit:tax',
  }),

  // DJP API: 30 requests per minute (external API has its own limits)
  djp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:djp',
  }),
};

export type RateLimitType = keyof typeof rateLimiters;

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from session (if authenticated)
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() :
    request.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Determine rate limit type based on URL path
 */
function getRateLimitType(pathname: string): RateLimitType {
  if (pathname.includes('/api/auth/')) {
    return 'auth';
  }
  if (pathname.includes('/api/payment/') || pathname.includes('/api/billing/')) {
    return 'payment';
  }
  if (pathname.includes('/api/documents/upload')) {
    return 'upload';
  }
  if (pathname.includes('/api/webhooks/')) {
    return 'webhook';
  }
  if (pathname.includes('/api/tax/')) {
    return 'tax';
  }
  if (pathname.includes('/api/djp/')) {
    return 'djp';
  }
  return 'general';
}

/**
 * Rate limiting middleware for API routes
 *
 * Usage in middleware.ts:
 * ```
 * import { withRateLimit } from '@/middleware/rate-limit';
 *
 * export async function middleware(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   // ... rest of middleware
 * }
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  type?: RateLimitType
): Promise<NextResponse | null> {
  // Skip rate limiting if Upstash is not configured (development)
  if (!isUpstashConfigured) {
    loggers.api.warn('Upstash not configured, skipping rate limit');
    return null;
  }

  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for health check
  if (pathname === '/api/health') {
    return null;
  }

  const limitType = type || getRateLimitType(pathname);
  const limiter = rateLimiters[limitType];
  const identifier = getClientIdentifier(request);

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    // Add rate limit headers to response
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', limit.toString());
    headers.set('X-RateLimit-Remaining', remaining.toString());
    headers.set('X-RateLimit-Reset', reset.toString());

    if (!success) {
      loggers.api.warn({ identifier, pathname, limitType }, 'Rate limit exceeded');

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null; // Allow request to proceed
  } catch (error) {
    // Log error but don't block request if rate limiting fails
    loggers.api.error({ err: error }, 'Error checking rate limit');
    return null;
  }
}

/**
 * Higher-order function for rate limiting specific API routes
 *
 * Usage in API route:
 * ```
 * import { createRateLimitedHandler } from '@/middleware/rate-limit';
 *
 * async function handler(request: NextRequest) {
 *   // Your handler logic
 * }
 *
 * export const POST = createRateLimitedHandler(handler, 'payment');
 * ```
 */
export function createRateLimitedHandler(
  handler: (request: NextRequest) => Promise<Response>,
  type: RateLimitType = 'general'
) {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResponse = await withRateLimit(request, type);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}
