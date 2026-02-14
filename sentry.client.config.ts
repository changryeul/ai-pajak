import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Session Replay (optional, can be expensive)
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 0.1, // 10% of sessions with errors

  // Debug mode (disable in production)
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.npm_package_version || '1.0.0',

  // Filter out certain errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return null;
    }

    // Ignore canceled requests
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    return event;
  },

  // Ignore certain URLs
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
  ],

  // Additional context
  initialScope: {
    tags: {
      app: 'ai-pajak',
      platform: 'web',
    },
  },
});
