import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IdempotencyManager } from '../idempotency';

describe('IdempotencyManager', () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    // Use in-memory storage for tests (no Redis configured)
    manager = new IdempotencyManager({ prefix: 'test:' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('store and retrieve', () => {
    it('should store and retrieve a response', async () => {
      const key = 'test-key-1';
      const requestBody = { amount: 100 };
      const response = { status: 'success', id: 'order-123' };

      await manager.set(key, { response, statusCode: 200 }, requestBody);

      const cached = await manager.get(key, requestBody);
      expect(cached).not.toBeNull();
      expect(cached?.response).toEqual(response);
      expect(cached?.statusCode).toBe(200);
    });

    it('should return null for non-existent key', async () => {
      const cached = await manager.get('non-existent', {});
      expect(cached).toBeNull();
    });

    it('should return cached response regardless of body in memory mode', async () => {
      // Note: Hash verification only works with Redis.
      // In-memory fallback returns the cached response without hash verification.
      const key = 'test-key-2';
      const originalBody = { amount: 100 };
      const differentBody = { amount: 200 };
      const response = { status: 'success' };

      await manager.set(key, { response, statusCode: 200 }, originalBody);

      const cached = await manager.get(key, differentBody);
      // In-memory mode doesn't verify hash, so returns the cached response
      expect(cached).not.toBeNull();
      expect(cached?.statusCode).toBe(200);
    });
  });

  describe('null key handling', () => {
    it('should return null for null key on get', async () => {
      const cached = await manager.get(null);
      expect(cached).toBeNull();
    });

    it('should return false for null key on set', async () => {
      const result = await manager.set(null, { response: {}, statusCode: 200 });
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      const key = 'delete-key';
      await manager.set(key, { response: { data: 'test' }, statusCode: 200 });

      // Verify key exists
      let cached = await manager.get(key);
      expect(cached).not.toBeNull();

      // Delete
      const deleted = await manager.delete(key);
      expect(deleted).toBe(true);

      // Verify key no longer exists
      cached = await manager.get(key);
      expect(cached).toBeNull();
    });

    it('should return true for non-existent key on delete', async () => {
      const result = await manager.delete('non-existent');
      expect(result).toBe(true);
    });
  });

  describe('TTL expiration', () => {
    it('should respect TTL and expire entries', async () => {
      // Create manager with 1 second TTL
      const shortTtlManager = new IdempotencyManager({
        ttlSeconds: 1,
        prefix: 'short-ttl:',
      });

      const key = 'expiring-key';
      const response = { status: 'success' };

      await shortTtlManager.set(key, { response, statusCode: 200 });

      // Should exist initially
      let cached = await shortTtlManager.get(key);
      expect(cached).not.toBeNull();

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      // Should be expired
      cached = await shortTtlManager.get(key);
      expect(cached).toBeNull();
    });
  });

  describe('request body hashing', () => {
    it('should match identical request bodies', async () => {
      const key = 'hash-test';
      const body1 = { a: 1, b: 2 };
      const body2 = { a: 1, b: 2 }; // Same content, different object
      const response = { status: 'success' };

      await manager.set(key, { response, statusCode: 200 }, body1);

      // Same content should match
      const cached = await manager.get(key, body2);
      expect(cached).not.toBeNull();
      expect(cached?.statusCode).toBe(200);
    });

    it('should work without request body', async () => {
      const key = 'no-body-key';
      const response = { result: 'ok' };

      await manager.set(key, { response, statusCode: 200 });

      const cached = await manager.get(key);
      expect(cached).not.toBeNull();
      expect(cached?.response).toEqual(response);
    });
  });

  describe('edge cases', () => {
    it('should handle empty request body', async () => {
      const key = 'empty-body';
      const response = { status: 'success' };

      await manager.set(key, { response, statusCode: 200 }, {});

      const cached = await manager.get(key, {});
      expect(cached).not.toBeNull();
      expect(cached?.statusCode).toBe(200);
    });

    it('should handle complex nested objects', async () => {
      const key = 'complex-body';
      const body = {
        user: { id: 1, name: 'Test' },
        items: [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }],
        metadata: { source: 'api' },
      };
      const response = { orderId: 'ORD-123' };

      await manager.set(key, { response, statusCode: 201 }, body);

      const cached = await manager.get(key, body);
      expect(cached).not.toBeNull();
      expect(cached?.response).toEqual({ orderId: 'ORD-123' });
    });

    it('should store createdAt timestamp', async () => {
      const key = 'timestamp-test';
      const response = { data: 'test' };

      await manager.set(key, { response, statusCode: 200 });

      const cached = await manager.get(key);
      expect(cached?.createdAt).toBeDefined();
      expect(typeof cached?.createdAt).toBe('string');
    });
  });
});
