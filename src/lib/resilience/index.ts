/**
 * Resilience Patterns
 *
 * This module exports utilities for building resilient applications:
 * - Circuit Breaker: Prevent cascading failures
 * - Idempotency: Prevent duplicate operations
 * - Timeout: Handle slow external services
 * - Retry: Automatic retry with backoff
 */

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitOpenError,
  circuitBreakers,
  getCircuitBreaker,
  getCircuitBreakerHealth,
  type CircuitState,
  type CircuitBreakerOptions,
} from './circuit-breaker';

// Idempotency
export {
  IdempotencyManager,
  idempotencyManager,
  withIdempotency,
} from './idempotency';

// Timeout and Retry
export {
  TimeoutError,
  withTimeout,
  createTimeoutWrapper,
  fetchWithTimeout,
  fetchWithTimeoutAndRetry,
  withRetry,
  sleep,
  serviceTimeouts,
  type FetchWithTimeoutOptions,
  type RetryOptions,
} from './timeout';
