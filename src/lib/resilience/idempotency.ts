import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';

/**
 * Idempotency Key Manager
 *
 * Prevents duplicate operations (especially payments) by storing
 * operation results keyed by a client-provided idempotency key.
 *
 * Usage:
 * ```typescript
 * const idempotency = new IdempotencyManager();
 *
 * // In API handler:
 * const key = request.headers.get('Idempotency-Key');
 * const cached = await idempotency.get(key);
 * if (cached) return cached.response;
 *
 * // ... process request ...
 *
 * await idempotency.set(key, { response, statusCode: 200 });
 * ```
 */

interface IdempotencyRecord {
  response: unknown;
  statusCode: number;
  createdAt: string;
  requestHash?: string;
}

interface IdempotencyOptions {
  /** TTL in seconds (default: 24 hours) */
  ttlSeconds?: number;
  /** Key prefix for Redis */
  prefix?: string;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const DEFAULT_PREFIX = 'idempotency:';

// Create Redis client if configured
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }

  return null;
}

// In-memory fallback for development
const memoryStore = new Map<string, { data: IdempotencyRecord; expiresAt: number }>();

/**
 * Generate a hash of the request body for verification
 */
function hashRequestBody(body: unknown): string {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Clean expired entries from memory store
 */
function cleanMemoryStore(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
}

export class IdempotencyManager {
  private ttlSeconds: number;
  private prefix: string;

  constructor(options: IdempotencyOptions = {}) {
    this.ttlSeconds = options.ttlSeconds || DEFAULT_TTL_SECONDS;
    this.prefix = options.prefix || DEFAULT_PREFIX;
  }

  /**
   * Get cached response for idempotency key
   */
  async get(
    key: string | null,
    requestBody?: unknown
  ): Promise<IdempotencyRecord | null> {
    if (!key) return null;

    const fullKey = this.prefix + key;
    const redisClient = getRedis();

    try {
      if (redisClient) {
        const data = await redisClient.get<IdempotencyRecord>(fullKey);
        if (data) {
          // Optionally verify request body matches
          if (requestBody && data.requestHash) {
            const currentHash = hashRequestBody(requestBody);
            if (currentHash !== data.requestHash) {
              console.warn(
                `[Idempotency] Request body mismatch for key ${key}. ` +
                `Expected hash: ${data.requestHash}, got: ${currentHash}`
              );
              // Return 409 Conflict - same key but different request
              return {
                response: {
                  error: 'Conflict',
                  message: 'Idempotency key already used with different request body',
                },
                statusCode: 409,
                createdAt: data.createdAt,
              };
            }
          }
          return data;
        }
      } else {
        // Fallback to memory store
        cleanMemoryStore();
        const entry = memoryStore.get(fullKey);
        if (entry && entry.expiresAt > Date.now()) {
          return entry.data;
        }
      }
    } catch (error) {
      console.error('[Idempotency] Error getting cached response:', error);
    }

    return null;
  }

  /**
   * Store response for idempotency key
   */
  async set(
    key: string | null,
    data: { response: unknown; statusCode: number },
    requestBody?: unknown
  ): Promise<boolean> {
    if (!key) return false;

    const fullKey = this.prefix + key;
    const record: IdempotencyRecord = {
      response: data.response,
      statusCode: data.statusCode,
      createdAt: new Date().toISOString(),
      requestHash: requestBody ? hashRequestBody(requestBody) : undefined,
    };

    const redisClient = getRedis();

    try {
      if (redisClient) {
        await redisClient.setex(fullKey, this.ttlSeconds, record);
      } else {
        // Fallback to memory store
        memoryStore.set(fullKey, {
          data: record,
          expiresAt: Date.now() + this.ttlSeconds * 1000,
        });
      }
      return true;
    } catch (error) {
      console.error('[Idempotency] Error storing response:', error);
      return false;
    }
  }

  /**
   * Delete idempotency key (useful for allowing retry on error)
   */
  async delete(key: string | null): Promise<boolean> {
    if (!key) return false;

    const fullKey = this.prefix + key;
    const redisClient = getRedis();

    try {
      if (redisClient) {
        await redisClient.del(fullKey);
      } else {
        memoryStore.delete(fullKey);
      }
      return true;
    } catch (error) {
      console.error('[Idempotency] Error deleting key:', error);
      return false;
    }
  }
}

// Export singleton instance for common use
export const idempotencyManager = new IdempotencyManager();

/**
 * Higher-order function to wrap an API handler with idempotency support
 *
 * Usage:
 * ```typescript
 * import { withIdempotency } from '@/lib/resilience/idempotency';
 *
 * async function handler(request: NextRequest) {
 *   // Your handler logic
 * }
 *
 * export const POST = withIdempotency(handler);
 * ```
 */
export function withIdempotency(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const idempotencyKey = request.headers.get('Idempotency-Key');

    // If no key provided, just execute the handler
    if (!idempotencyKey) {
      return handler(request);
    }

    // Clone request to read body
    const clonedRequest = request.clone();
    let requestBody: unknown;
    try {
      requestBody = await clonedRequest.json();
    } catch {
      // Body might not be JSON
      requestBody = await clonedRequest.text();
    }

    // Check for cached response
    const cached = await idempotencyManager.get(idempotencyKey, requestBody);
    if (cached) {
      console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
      return new Response(JSON.stringify(cached.response), {
        status: cached.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Replayed': 'true',
        },
      });
    }

    // Execute handler
    const response = await handler(request);

    // Cache successful responses (2xx status codes)
    if (response.status >= 200 && response.status < 300) {
      try {
        const responseClone = response.clone();
        const responseBody = await responseClone.json();
        await idempotencyManager.set(
          idempotencyKey,
          { response: responseBody, statusCode: response.status },
          requestBody
        );
      } catch {
        // Response might not be JSON, skip caching
      }
    }

    return response;
  };
}
