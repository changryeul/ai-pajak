/**
 * AI Rate Limiter
 *
 * Limits AI API calls per user to prevent abuse and control costs.
 * Uses in-memory store (fallback) or Upstash Redis when configured.
 *
 * Limits:
 * - Chatbot: 20 calls/hour/user
 * - OCR: 10 calls/hour/user
 * - Report: 5 calls/day/user
 * - Total AI: 100 calls/day/user
 */

type RateLimitType = 'chatbot' | 'ocr' | 'report' | 'savings' | 'validation' | 'anomaly' | 'general';

interface RateLimit {
  maxRequests: number;
  windowMs: number; // milliseconds
}

const RATE_LIMITS: Record<RateLimitType, RateLimit> = {
  chatbot: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  ocr: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  report: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5/day
  savings: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  validation: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  anomaly: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  general: { maxRequests: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100/day
};

// In-memory store (works without Redis)
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) store.delete(key);
  }
}, 60 * 1000); // Every minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs?: number;
}

/**
 * Check if a user can make an AI API call
 */
export async function checkRateLimit(
  userId: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type];
  const key = `rate:${type}:${userId}`;
  const now = Date.now();

  // Try Upstash Redis first
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return checkRedisRateLimit(key, config, now);
  }

  // Fallback: in-memory
  return checkMemoryRateLimit(key, config, now);
}

function checkMemoryRateLimit(key: string, config: RateLimit, now: number): RateLimitResult {
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      resetAt: new Date(entry.resetAt),
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    limit: config.maxRequests,
    resetAt: new Date(entry.resetAt),
  };
}

async function checkRedisRateLimit(key: string, config: RateLimit, now: number): Promise<RateLimitResult> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

    // INCR + TTL pattern
    const incrRes = await fetch(`${url}/incr/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const incrData = await incrRes.json();
    const count = incrData.result as number;

    // Set expiry on first request
    if (count === 1) {
      const ttlSeconds = Math.ceil(config.windowMs / 1000);
      await fetch(`${url}/expire/${key}/${ttlSeconds}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const allowed = count <= config.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - count),
      limit: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
      retryAfterMs: allowed ? undefined : config.windowMs,
    };
  } catch {
    // Redis failure → allow (fail open)
    return { allowed: true, remaining: config.maxRequests, limit: config.maxRequests, resetAt: new Date(now + config.windowMs) };
  }
}

/**
 * Helper: create rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult, type: string) {
  const retryMinutes = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 60000) : 0;
  return {
    error: 'Rate limit exceeded',
    message: `Terlalu banyak permintaan ${type}. Coba lagi dalam ${retryMinutes} menit.`,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt.toISOString(),
  };
}
