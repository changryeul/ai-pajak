import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,

  // Filter out noisy or expected errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Skip expected operational errors
    if (error instanceof Error) {
      // Circuit breaker open errors are expected when services are down
      if (error.name === 'CircuitOpenError') return null;
      // Rate limit errors are expected
      if (error.message?.includes('Rate limit exceeded')) return null;
    }

    return event;
  },

  // Add breadcrumbs for debugging context
  beforeBreadcrumb(breadcrumb) {
    // Redact sensitive data from breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data) {
      if (breadcrumb.data.url?.includes('/api/auth/')) {
        breadcrumb.data.body = '[REDACTED]';
      }
    }
    return breadcrumb;
  },

  // Ignore specific transaction patterns
  ignoreTransactions: [
    /^GET \/api\/health/,
    /^\/_next\//,
  ],
});
