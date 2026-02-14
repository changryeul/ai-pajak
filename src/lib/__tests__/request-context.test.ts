import { describe, it, expect } from 'vitest';
import {
  getCurrentRequestContext,
  runWithRequestContext,
  runWithRequestContextAsync,
  createRequestContext,
  getRequestDuration,
  formatLogPrefix,
  type RequestContext,
} from '../request-context';

describe('Request Context', () => {
  describe('createRequestContext', () => {
    it('should create context from request', () => {
      const request = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'user-agent': 'test-agent',
          'x-request-id': 'req-123',
        },
      });

      const context = createRequestContext(request);

      expect(context.requestId).toBe('req-123');
      expect(context.method).toBe('POST');
      expect(context.path).toBe('/api/test');
      expect(context.userAgent).toBe('test-agent');
      expect(context.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should generate request ID if not provided', () => {
      const request = new Request('https://example.com/api/test');
      const context = createRequestContext(request);

      expect(context.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should include userId if provided', () => {
      const request = new Request('https://example.com/api/test');
      const context = createRequestContext(request, 'user-456');

      expect(context.userId).toBe('user-456');
    });

    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('https://example.com/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const context = createRequestContext(request);
      expect(context.ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('https://example.com/api/test', {
        headers: {
          'x-real-ip': '192.168.1.100',
        },
      });

      const context = createRequestContext(request);
      expect(context.ip).toBe('192.168.1.100');
    });
  });

  describe('runWithRequestContext', () => {
    it('should make context available in sync function', () => {
      const context: RequestContext = {
        requestId: 'test-req-1',
        method: 'GET',
        path: '/test',
        startTime: Date.now(),
      };

      const result = runWithRequestContext(context, () => {
        const current = getCurrentRequestContext();
        return current?.requestId;
      });

      expect(result).toBe('test-req-1');
    });

    it('should not leak context outside of run', () => {
      const context: RequestContext = {
        requestId: 'isolated-req',
        method: 'GET',
        path: '/test',
        startTime: Date.now(),
      };

      runWithRequestContext(context, () => {
        // Context is available here
        expect(getCurrentRequestContext()?.requestId).toBe('isolated-req');
      });

      // Context should not be available outside
      expect(getCurrentRequestContext()).toBeUndefined();
    });
  });

  describe('runWithRequestContextAsync', () => {
    it('should make context available in async function', async () => {
      const context: RequestContext = {
        requestId: 'async-req-1',
        method: 'POST',
        path: '/async',
        startTime: Date.now(),
      };

      const result = await runWithRequestContextAsync(context, async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        const current = getCurrentRequestContext();
        return current?.requestId;
      });

      expect(result).toBe('async-req-1');
    });

    it('should maintain context through async boundaries', async () => {
      const context: RequestContext = {
        requestId: 'boundary-test',
        method: 'GET',
        path: '/boundary',
        startTime: Date.now(),
      };

      const result = await runWithRequestContextAsync(context, async () => {
        // First await
        await Promise.resolve();

        const afterFirst = getCurrentRequestContext()?.requestId;

        // Second await
        await new Promise((resolve) => setTimeout(resolve, 5));

        const afterSecond = getCurrentRequestContext()?.requestId;

        return { afterFirst, afterSecond };
      });

      expect(result.afterFirst).toBe('boundary-test');
      expect(result.afterSecond).toBe('boundary-test');
    });
  });

  describe('getRequestDuration', () => {
    it('should calculate duration from startTime', async () => {
      const startTime = Date.now();
      const context: RequestContext = {
        requestId: 'duration-test',
        method: 'GET',
        path: '/duration',
        startTime,
      };

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = getRequestDuration(context);
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(200); // Reasonable upper bound
    });
  });

  describe('formatLogPrefix', () => {
    it('should format prefix with request ID, method and path', () => {
      const context: RequestContext = {
        requestId: 'log-123',
        method: 'DELETE',
        path: '/api/users/456',
        startTime: Date.now(),
      };

      const prefix = formatLogPrefix(context);
      expect(prefix).toBe('[log-123] DELETE /api/users/456');
    });
  });
});
