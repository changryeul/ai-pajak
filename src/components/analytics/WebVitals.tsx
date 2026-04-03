'use client';

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

/**
 * Web Vitals Reporter
 *
 * Collects Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP) and sends them to Sentry.
 * Mount once in the root layout.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to Sentry as custom measurement
    Sentry.addBreadcrumb({
      category: 'web-vital',
      message: `${metric.name}: ${Math.round(metric.value)}`,
      level: 'info',
      data: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
      },
    });

    // Report poor metrics as Sentry events for alerting
    if (metric.rating === 'poor') {
      Sentry.withScope((scope) => {
        scope.setTag('web_vital', metric.name);
        scope.setTag('web_vital.rating', 'poor');
        scope.setLevel('warning');
        scope.setExtra('value', metric.value);
        scope.setExtra('navigationType', metric.navigationType);

        Sentry.captureMessage(
          `Poor Web Vital: ${metric.name} = ${Math.round(metric.value)}`,
          'warning'
        );
      });
    }
  });

  return null;
}
