/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services are down.
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 *
 * Usage:
 * ```typescript
 * const djpBreaker = new CircuitBreaker('djp', {
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 * });
 *
 * try {
 *   const result = await djpBreaker.execute(() => callDJPAPI());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Service is down, return fallback
 *   }
 * }
 * ```
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting reset (default: 30000) */
  resetTimeout?: number;
  /** Time window in ms to count failures (default: 60000) */
  failureWindow?: number;
  /** Number of successful calls in HALF_OPEN to close circuit (default: 2) */
  successThreshold?: number;
  /** Optional callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export class CircuitOpenError extends Error {
  constructor(
    public serviceName: string,
    public retryAfter: number
  ) {
    super(`Circuit breaker is open for service: ${serviceName}`);
    this.name = 'CircuitOpenError';
  }
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> = {
  failureThreshold: 5,
  resetTimeout: 30000,
  failureWindow: 60000,
  successThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  private readonly options: Required<Omit<CircuitBreakerOptions, 'onStateChange'>>;
  private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onStateChange = options.onStateChange;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures.length,
      successCount: this.successCount,
      lastFailure: this.lastFailureTime > 0 ? new Date(this.lastFailureTime) : undefined,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Check if circuit allows requests
   */
  private canExecute(): boolean {
    const now = Date.now();

    // Clean old failures outside the window
    this.failures = this.failures.filter(
      (f) => now - f.timestamp < this.options.failureWindow
    );

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (now >= this.nextAttemptTime) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(error: Error): void {
    const now = Date.now();
    this.lastFailureTime = now;

    this.failures.push({
      timestamp: now,
      error: error.message,
    });

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded the failure threshold
      if (this.failures.length >= this.options.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
      this.successCount = 0;
      console.warn(
        `[CircuitBreaker] ${this.name}: OPEN - will retry after ${this.options.resetTimeout}ms`
      );
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
      console.log(`[CircuitBreaker] ${this.name}: HALF_OPEN - testing service`);
    } else if (newState === 'CLOSED') {
      this.failures = [];
      this.successCount = 0;
      console.log(`[CircuitBreaker] ${this.name}: CLOSED - service recovered`);
    }

    if (this.onStateChange && oldState !== newState) {
      this.onStateChange(this.name, oldState, newState);
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const retryAfter = Math.max(0, this.nextAttemptTime - Date.now());
      throw new CircuitOpenError(this.name, retryAfter);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Manually trip the circuit breaker
   */
  trip(): void {
    this.transitionTo('OPEN');
  }
}

// Pre-configured circuit breakers for external services
export const circuitBreakers = {
  djp: new CircuitBreaker('djp', {
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute
    failureWindow: 120000, // 2 minutes
    successThreshold: 2,
    onStateChange: (name, from, to) => {
      console.log(`[CircuitBreaker] ${name}: ${from} -> ${to}`);
    },
  }),

  midtrans: new CircuitBreaker('midtrans', {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    failureWindow: 60000, // 1 minute
    successThreshold: 2,
  }),

  email: new CircuitBreaker('email', {
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute
    failureWindow: 120000, // 2 minutes
    successThreshold: 1,
  }),

  ocr: new CircuitBreaker('ocr', {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    failureWindow: 60000, // 1 minute
    successThreshold: 2,
  }),
};

/**
 * Get or create a circuit breaker by name
 */
const customBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  // Check pre-configured breakers
  if (name in circuitBreakers) {
    return circuitBreakers[name as keyof typeof circuitBreakers];
  }

  // Check custom breakers
  let breaker = customBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    customBreakers.set(name, breaker);
  }

  return breaker;
}

/**
 * Health check for all circuit breakers
 */
export function getCircuitBreakerHealth(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
  const health: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};

  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    health[name] = breaker.getStats();
  }

  for (const [name, breaker] of customBreakers.entries()) {
    health[name] = breaker.getStats();
  }

  return health;
}
