/**
 * Timeout Handling Utilities
 *
 * Provides timeout wrappers for async operations to prevent
 * hanging requests when external services are slow.
 *
 * Usage:
 * ```typescript
 * import { withTimeout, fetchWithTimeout } from '@/lib/resilience/timeout';
 *
 * // Wrap any promise
 * const result = await withTimeout(
 *   someAsyncFunction(),
 *   5000,
 *   'Operation timed out'
 * );
 *
 * // Fetch with timeout
 * const response = await fetchWithTimeout('https://api.example.com', {
 *   timeout: 10000,
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * ```
 */

import { loggers } from '@/lib/logger';

export class TimeoutError extends Error {
  constructor(
    message: string,
    public timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${errorMessage} after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Create a function that wraps calls with a timeout
 */
export function createTimeoutWrapper(
  defaultTimeout: number,
  defaultErrorMessage = 'Operation timed out'
) {
  return <T>(
    promise: Promise<T>,
    timeoutMs = defaultTimeout,
    errorMessage = defaultErrorMessage
  ): Promise<T> => {
    return withTimeout(promise, timeoutMs, errorMessage);
  };
}

/**
 * Extended fetch options with timeout
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Fetch timed out after ${timeout}ms`, timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 1000) */
  baseDelay?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelay?: number;
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback on retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>
): number {
  let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt);
  delay = Math.min(delay, options.maxDelay);

  if (options.jitter) {
    // Add random jitter of ±25%
    const jitterRange = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterRange;
  }

  return Math.round(delay);
}

/**
 * Default retry condition - retry on network errors and 5xx responses
 */
function defaultShouldRetry(error: Error): boolean {
  // Always retry timeout errors
  if (error instanceof TimeoutError) {
    return true;
  }

  // Retry network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = options.shouldRetry || defaultShouldRetry;
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < opts.maxRetries && shouldRetry(lastError, attempt)) {
        const delay = calculateDelay(attempt, opts);

        if (options.onRetry) {
          options.onRetry(lastError, attempt + 1, delay);
        }

        loggers.api.warn({
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          delayMs: delay,
          err: lastError,
        }, 'Retry attempt failed, retrying');

        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError!;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combined timeout and retry for external API calls
 */
export async function fetchWithTimeoutAndRetry(
  url: string | URL,
  options: FetchWithTimeoutOptions & RetryOptions = {}
): Promise<Response> {
  const {
    timeout,
    maxRetries,
    baseDelay,
    maxDelay,
    backoffFactor,
    jitter,
    shouldRetry,
    onRetry,
    ...fetchOptions
  } = options;

  return withRetry(
    () => fetchWithTimeout(url, { timeout, ...fetchOptions }),
    {
      maxRetries,
      baseDelay,
      maxDelay,
      backoffFactor,
      jitter,
      shouldRetry: shouldRetry || ((error) => {
        // Retry on timeout or network errors
        if (error instanceof TimeoutError) return true;
        if (error.name === 'TypeError') return true;
        return false;
      }),
      onRetry,
    }
  );
}

/**
 * Pre-configured timeout wrappers for different services
 */
export const serviceTimeouts = {
  /** DJP API - 30 second timeout */
  djp: createTimeoutWrapper(30000, 'DJP API request timed out'),

  /** Midtrans - 15 second timeout */
  midtrans: createTimeoutWrapper(15000, 'Midtrans request timed out'),

  /** Email service - 10 second timeout */
  email: createTimeoutWrapper(10000, 'Email service request timed out'),

  /** OCR service - 60 second timeout (can be slow) */
  ocr: createTimeoutWrapper(60000, 'OCR processing timed out'),

  /** Database queries - 5 second timeout */
  database: createTimeoutWrapper(5000, 'Database query timed out'),

  /** Default - 30 second timeout */
  default: createTimeoutWrapper(30000, 'Request timed out'),
};
