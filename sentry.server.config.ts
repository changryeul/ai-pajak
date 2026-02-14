import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Debug mode
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.npm_package_version || '1.0.0',

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }

    // Remove sensitive data from request body
    if (event.request?.data) {
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'npwp', 'nik'];
      try {
        const data = typeof event.request.data === 'string'
          ? JSON.parse(event.request.data)
          : event.request.data;

        for (const field of sensitiveFields) {
          if (data[field]) {
            data[field] = '[REDACTED]';
          }
        }
        event.request.data = JSON.stringify(data);
      } catch {
        // Ignore parsing errors
      }
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),
  ],

  // Additional context
  initialScope: {
    tags: {
      app: 'ai-pajak',
      platform: 'server',
    },
  },
});
