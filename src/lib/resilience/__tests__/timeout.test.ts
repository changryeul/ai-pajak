import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withTimeout,
  withRetry,
  TimeoutError,
  sleep,
  createTimeoutWrapper,
} from '../timeout';

describe('Timeout Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withTimeout', () => {
    it('should resolve if operation completes before timeout', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        1000,
        'Operation timed out'
      );

      expect(result).toBe('success');
    });

    it('should reject with TimeoutError if operation exceeds timeout', async () => {
      const slowOperation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 2000);
      });

      const promise = withTimeout(slowOperation, 1000, 'Operation timed out');

      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow(TimeoutError);
      await expect(promise).rejects.toThrow('Operation timed out after 1000ms');
    });

    it('should include timeout duration in error', async () => {
      const slowOperation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 5000);
      });

      const promise = withTimeout(slowOperation, 3000);

      vi.advanceTimersByTime(3001);

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(3000);
      }
    });
  });

  describe('createTimeoutWrapper', () => {
    it('should create a wrapper with default timeout', async () => {
      const wrapper = createTimeoutWrapper(1000, 'Default timeout');

      const result = await wrapper(Promise.resolve('quick'));
      expect(result).toBe('quick');
    });

    it('should allow custom timeout override', async () => {
      const wrapper = createTimeoutWrapper(1000, 'Default timeout');

      const slowOperation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow'), 1500);
      });

      const promise = wrapper(slowOperation, 500);
      vi.advanceTimersByTime(501);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed eventually', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new TimeoutError('timeout', 1000));
        }
        return Promise.resolve('success');
      });

      const promise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: false,
      });

      // Process all retries
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = vi.fn().mockImplementation(() => {
        return Promise.reject(new TimeoutError('timeout', 1000));
      });

      const promise = withRetry(fn, {
        maxRetries: 2,
        baseDelay: 100,
        jitter: false,
      });

      // Process all retries - catch to prevent unhandled rejection
      promise.catch(() => {}); // Prevent unhandled rejection warning
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(TimeoutError);
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          shouldRetry: (error) => error.message === 'retryable',
        })
      ).rejects.toThrow('non-retryable');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TimeoutError('timeout', 1000));
        }
        return Promise.resolve('success');
      });

      const promise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        jitter: false,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(TimeoutError), 1, 100);
    });

    it('should apply exponential backoff', async () => {
      const onRetry = vi.fn();
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new TimeoutError('timeout', 1000));
        }
        return Promise.resolve('success');
      });

      const promise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        backoffFactor: 2,
        jitter: false,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 200);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified duration', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should not resolve before duration', async () => {
      let resolved = false;
      const promise = sleep(1000).then(() => {
        resolved = true;
      });

      vi.advanceTimersByTime(500);
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(500);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should have correct name', () => {
      const error = new TimeoutError('test', 1000);
      expect(error.name).toBe('TimeoutError');
    });

    it('should include timeout in message', () => {
      const error = new TimeoutError('Operation failed', 5000);
      expect(error.message).toBe('Operation failed');
      expect(error.timeoutMs).toBe(5000);
    });
  });
});
