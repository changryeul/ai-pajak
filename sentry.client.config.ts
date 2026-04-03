import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,

  // Filter out noisy client-side errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    if (error instanceof Error) {
      // Network errors from user's connection issues
      if (error.message?.match(/fetch failed|network error|load failed/i)) {
        return null;
      }
      // Browser extension interference
      if (error.stack?.match(/extensions\//i)) {
        return null;
      }
    }

    return event;
  },

  // Ignore common noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    /Loading chunk \d+ failed/,
  ],
});
