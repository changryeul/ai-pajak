import pino from 'pino';
import { getCurrentRequestContext, type RequestContext } from '@/lib/request-context';

/**
 * Structured Logger using Pino
 *
 * Features:
 * - JSON logging for production (easy to parse in log aggregators)
 * - Pretty printing for development
 * - Automatic request context injection
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Redaction of sensitive fields
 *
 * Usage:
 * ```typescript
 * import { logger, createLogger } from '@/lib/logger';
 *
 * // Basic usage
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Payment failed', { error, orderId: '456' });
 *
 * // With request context (automatically includes requestId)
 * logger.info('Processing request');
 *
 * // Create child logger for specific module
 * const paymentLogger = createLogger('payment');
 * paymentLogger.info('Payment initiated', { amount: 1000 });
 * ```
 */

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Log level from environment or default
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Fields to redact from logs
const REDACT_PATHS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'npwp',
  'nik',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  'headers.authorization',
  'headers.cookie',
  'body.password',
  'body.token',
];

/**
 * Create base Pino configuration
 */
function createPinoConfig(): pino.LoggerOptions {
  const baseConfig: pino.LoggerOptions = {
    level: LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
      bindings: () => ({}), // Remove pid and hostname in production
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      app: 'ai-pajak',
      env: process.env.NODE_ENV || 'development',
    },
  };

  // Pretty print in development
  if (isDevelopment && !isTest) {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return baseConfig;
}

/**
 * Base logger instance
 */
const baseLogger = pino(createPinoConfig());

/**
 * Enhanced logger that automatically includes request context
 */
class ContextAwareLogger {
  private logger: pino.Logger;
  private module?: string;

  constructor(logger: pino.Logger, module?: string) {
    this.logger = logger;
    this.module = module;
  }

  private getContext(): Partial<RequestContext> {
    const ctx = getCurrentRequestContext();
    if (ctx) {
      return {
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        userId: ctx.userId,
      };
    }
    return {};
  }

  private log(
    level: pino.Level,
    msgOrObj: string | object,
    msg?: string,
    ...args: unknown[]
  ): void {
    const context = this.getContext();
    const moduleContext = this.module ? { module: this.module } : {};

    if (typeof msgOrObj === 'string') {
      this.logger[level]({ ...context, ...moduleContext }, msgOrObj, ...args);
    } else {
      this.logger[level](
        { ...context, ...moduleContext, ...msgOrObj },
        msg || '',
        ...args
      );
    }
  }

  trace(obj: object, msg?: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;
  trace(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('trace', msgOrObj, msg, ...args);
  }

  debug(obj: object, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  debug(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('debug', msgOrObj, msg, ...args);
  }

  info(obj: object, msg?: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  info(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('info', msgOrObj, msg, ...args);
  }

  warn(obj: object, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  warn(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('warn', msgOrObj, msg, ...args);
  }

  error(obj: object, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  error(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('error', msgOrObj, msg, ...args);
  }

  fatal(obj: object, msg?: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
  fatal(msgOrObj: string | object, msg?: string, ...args: unknown[]): void {
    this.log('fatal', msgOrObj, msg, ...args);
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: pino.Bindings): ContextAwareLogger {
    return new ContextAwareLogger(this.logger.child(bindings), this.module);
  }
}

/**
 * Main logger instance
 */
export const logger = new ContextAwareLogger(baseLogger);

/**
 * Create a module-specific logger
 */
export function createLogger(module: string): ContextAwareLogger {
  return new ContextAwareLogger(baseLogger, module);
}

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
  api: createLogger('api'),
  auth: createLogger('auth'),
  tax: createLogger('tax'),
  payment: createLogger('payment'),
  billing: createLogger('billing'),
  djp: createLogger('djp'),
  ocr: createLogger('ocr'),
  email: createLogger('email'),
  audit: createLogger('audit'),
  db: createLogger('database'),
};

/**
 * Log an API request/response (for middleware)
 */
export function logApiRequest(
  ctx: RequestContext,
  response: { status: number; body?: unknown }
): void {
  const duration = Date.now() - ctx.startTime;
  const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';

  loggers.api[level]({
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    status: response.status,
    duration,
    userId: ctx.userId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }, `${ctx.method} ${ctx.path} ${response.status} ${duration}ms`);
}

/**
 * Log an error with stack trace
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>
): void {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, error.message);
}

// Export raw pino logger for advanced use cases
export { baseLogger as pinoLogger };
