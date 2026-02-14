import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreakerHealth,
} from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeout: 5000,
      failureWindow: 60000,
      successThreshold: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should have zero failures initially', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.state).toBe('CLOSED');
    });
  });

  describe('successful operations', () => {
    it('should execute successful operations', async () => {
      const result = await circuitBreaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should remain in CLOSED state after success', async () => {
      await circuitBreaker.execute(() => Promise.resolve('success'));
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('failure handling', () => {
    it('should increment failure count on failures', async () => {
      await expect(
        circuitBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('should open circuit after threshold failures', async () => {
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow('fail');
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should reject immediately when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // Should throw CircuitOpenError
      await expect(
        circuitBreaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should include service name in CircuitOpenError', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      try {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).serviceName).toBe('test');
      }
    });
  });

  describe('half-open state', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Advance time past reset timeout
      vi.advanceTimersByTime(5001);

      // Next call should be allowed (HALF_OPEN) and succeed
      await circuitBreaker.execute(() => Promise.resolve('success'));

      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should reopen on failure in HALF_OPEN state', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // Advance time to allow HALF_OPEN
      vi.advanceTimersByTime(5001);

      // Fail in HALF_OPEN
      await expect(
        circuitBreaker.execute(() => Promise.reject(new Error('fail again')))
      ).rejects.toThrow();

      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('manual control', () => {
    it('should manually reset the circuit', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Manual reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should manually trip the circuit', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');

      circuitBreaker.trip();

      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('state change callback', () => {
    it('should call onStateChange when state changes', async () => {
      const onStateChange = vi.fn();
      const cbBreaker = new CircuitBreaker('callback-test', {
        failureThreshold: 2,
        resetTimeout: 1000,
        onStateChange,
      });

      // Trigger failures to open
      await expect(cbBreaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(cbBreaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(onStateChange).toHaveBeenCalledWith('callback-test', 'CLOSED', 'OPEN');
    });
  });

  describe('getStats', () => {
    it('should return complete stats', async () => {
      await expect(
        circuitBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      const stats = circuitBreaker.getStats();

      expect(stats.name).toBe('test');
      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(1);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('health reporting', () => {
    it('should include breaker in health report', () => {
      // Access the circuit breaker to register it
      const health = getCircuitBreakerHealth();

      // Should include pre-configured breakers
      expect(health.djp).toBeDefined();
      expect(health.midtrans).toBeDefined();
      expect(health.email).toBeDefined();
      expect(health.ocr).toBeDefined();
    });
  });

  describe('failure window', () => {
    it('should clear old failures outside the window', async () => {
      const windowBreaker = new CircuitBreaker('window-test', {
        failureThreshold: 3,
        resetTimeout: 5000,
        failureWindow: 1000, // 1 second window
      });

      // First failure
      await expect(
        windowBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      // Wait for failure to expire
      vi.advanceTimersByTime(1001);

      // These failures should be the only ones counted
      await expect(
        windowBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
      await expect(
        windowBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      // Circuit should still be CLOSED because old failure expired
      expect(windowBreaker.getState()).toBe('CLOSED');
    });
  });
});
