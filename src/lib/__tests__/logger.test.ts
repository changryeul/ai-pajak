import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger, loggers, logError } from '../logger';
import { runWithRequestContext, type RequestContext } from '../request-context';

describe('Logger', () => {
  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log with object context', () => {
      expect(() => {
        logger.info({ userId: '123', action: 'login' }, 'User logged in');
      }).not.toThrow();
    });

    it('should log errors', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log warnings', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('createLogger', () => {
    it('should create module-specific logger', () => {
      const paymentLogger = createLogger('payment');
      expect(() => {
        paymentLogger.info('Payment initiated');
      }).not.toThrow();
    });

    it('should create multiple independent loggers', () => {
      const authLogger = createLogger('auth');
      const taxLogger = createLogger('tax');

      expect(() => {
        authLogger.info('Auth event');
        taxLogger.info('Tax event');
      }).not.toThrow();
    });
  });

  describe('pre-configured loggers', () => {
    it('should have api logger', () => {
      expect(loggers.api).toBeDefined();
    });

    it('should have auth logger', () => {
      expect(loggers.auth).toBeDefined();
    });

    it('should have tax logger', () => {
      expect(loggers.tax).toBeDefined();
    });

    it('should have payment logger', () => {
      expect(loggers.payment).toBeDefined();
    });

    it('should have billing logger', () => {
      expect(loggers.billing).toBeDefined();
    });

    it('should have djp logger', () => {
      expect(loggers.djp).toBeDefined();
    });

    it('should have email logger', () => {
      expect(loggers.email).toBeDefined();
    });

    it('should have audit logger', () => {
      expect(loggers.audit).toBeDefined();
    });

    it('should have database logger', () => {
      expect(loggers.db).toBeDefined();
    });
  });

  describe('request context integration', () => {
    it('should include request context when available', () => {
      const context: RequestContext = {
        requestId: 'ctx-test-123',
        method: 'POST',
        path: '/api/test',
        userId: 'user-456',
        startTime: Date.now(),
      };

      runWithRequestContext(context, () => {
        // Logger should automatically pick up context
        expect(() => {
          logger.info('Log with context');
        }).not.toThrow();
      });
    });
  });

  describe('logError utility', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error');

      expect(() => {
        logError(error);
      }).not.toThrow();
    });

    it('should include additional context', () => {
      const error = new Error('Payment failed');

      expect(() => {
        logError(error, {
          orderId: 'ORD-123',
          amount: 100000,
        });
      }).not.toThrow();
    });
  });

  describe('child logger', () => {
    it('should create child logger with additional bindings', () => {
      const childLogger = logger.child({ transactionId: 'tx-123' });

      expect(() => {
        childLogger.info('Child log message');
      }).not.toThrow();
    });
  });

  describe('log levels', () => {
    it('should support trace level', () => {
      expect(() => logger.trace('Trace message')).not.toThrow();
    });

    it('should support debug level', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should support info level', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });

    it('should support warn level', () => {
      expect(() => logger.warn('Warn message')).not.toThrow();
    });

    it('should support error level', () => {
      expect(() => logger.error('Error message')).not.toThrow();
    });

    it('should support fatal level', () => {
      expect(() => logger.fatal('Fatal message')).not.toThrow();
    });
  });
});
