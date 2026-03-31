import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // 100% of errors get replay
  environment: process.env.NODE_ENV,
});
