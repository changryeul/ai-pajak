/**
 * Sentry Utilities
 *
 * Centralized error capture for API routes, circuit breakers, and background jobs.
 * Wraps @sentry/nextjs to provide structured context and consistent tagging.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an API route error with structured context
 */
export function captureApiError(
  error: unknown,
  context: {
    route: string;
    method?: string;
    userId?: string;
    role?: string;
    statusCode?: number;
    extra?: Record<string, unknown>;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  Sentry.withScope((scope) => {
    scope.setTag('error.source', 'api');
    scope.setTag('api.route', context.route);
    if (context.method) scope.setTag('api.method', context.method);
    if (context.statusCode) scope.setTag('api.status', context.statusCode.toString());
    if (context.role) scope.setTag('user.role', context.role);

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    if (context.extra) {
      scope.setExtras(context.extra);
    }

    scope.setLevel(context.statusCode && context.statusCode >= 500 ? 'error' : 'warning');

    Sentry.captureException(err);
  });
}

/**
 * Capture a circuit breaker state change
 */
export function captureCircuitBreakerEvent(
  serviceName: string,
  fromState: string,
  toState: string
): void {
  if (toState === 'OPEN') {
    // Circuit opened = service is failing, capture as warning
    Sentry.withScope((scope) => {
      scope.setTag('error.source', 'circuit_breaker');
      scope.setTag('service', serviceName);
      scope.setTag('circuit.from', fromState);
      scope.setTag('circuit.to', toState);
      scope.setLevel('warning');

      Sentry.captureMessage(
        `Circuit breaker OPEN: ${serviceName}`,
        'warning'
      );
    });
  } else if (toState === 'CLOSED' && fromState !== 'CLOSED') {
    // Service recovered, capture as info breadcrumb
    Sentry.addBreadcrumb({
      category: 'circuit_breaker',
      message: `${serviceName} recovered (${fromState} → CLOSED)`,
      level: 'info',
    });
  }
}

/**
 * Capture a background job failure
 */
export function captureJobError(
  error: unknown,
  context: {
    jobType: string;
    jobId: string;
    willRetry: boolean;
    retryCount?: number;
    extra?: Record<string, unknown>;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  Sentry.withScope((scope) => {
    scope.setTag('error.source', 'background_job');
    scope.setTag('job.type', context.jobType);
    scope.setTag('job.will_retry', context.willRetry.toString());

    scope.setExtra('jobId', context.jobId);
    if (context.retryCount !== undefined) {
      scope.setExtra('retryCount', context.retryCount);
    }
    if (context.extra) {
      scope.setExtras(context.extra);
    }

    // Final failures are errors, retriable failures are warnings
    scope.setLevel(context.willRetry ? 'warning' : 'error');

    Sentry.captureException(err);
  });
}

/**
 * Set user context for the current scope (call from auth middleware)
 */
export function setSentryUser(userId: string, role: string, organizationId?: string): void {
  Sentry.setUser({ id: userId });
  Sentry.setTag('user.role', role);
  if (organizationId) {
    Sentry.setTag('user.organization', organizationId);
  }
}
