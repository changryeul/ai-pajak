import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring - lower rate for edge
  tracesSampleRate: 0.05, // 5% of transactions

  // Debug mode
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.npm_package_version || '1.0.0',

  // Additional context
  initialScope: {
    tags: {
      app: 'ai-pajak',
      platform: 'edge',
    },
  },
});
