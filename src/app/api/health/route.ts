import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ServiceCheck;
    redis?: ServiceCheck;
    external?: {
      midtrans?: ServiceCheck;
      djp?: ServiceCheck;
    };
  };
}

interface ServiceCheck {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Simple query to check connectivity
    const { error } = await supabase
      .from('platform')
      .select('id')
      .limit(1)
      .single();

    const latency = Date.now() - start;

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is OK
      return {
        status: 'down',
        latency,
        message: error.message,
      };
    }

    // Check if latency is acceptable (< 1000ms)
    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'High latency detected',
      };
    }

    return {
      status: 'up',
      latency,
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity (if configured)
 */
async function checkRedis(): Promise<ServiceCheck | undefined> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return undefined;
  }

  const start = Date.now();

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    await redis.ping();
    const latency = Date.now() - start;

    return {
      status: latency > 500 ? 'degraded' : 'up',
      latency,
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(checks: HealthCheckResult['checks']): 'healthy' | 'degraded' | 'unhealthy' {
  // If database is down, system is unhealthy
  if (checks.database.status === 'down') {
    return 'unhealthy';
  }

  // If any check is degraded, system is degraded
  if (
    checks.database.status === 'degraded' ||
    checks.redis?.status === 'degraded' ||
    checks.redis?.status === 'down'
  ) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * GET /api/health
 *
 * Health check endpoint for load balancers and monitoring
 *
 * Returns:
 * - 200: System is healthy
 * - 503: System is unhealthy or degraded
 */
export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Run health checks in parallel
  const [databaseCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const checks: HealthCheckResult['checks'] = {
    database: databaseCheck,
  };

  if (redisCheck) {
    checks.redis = redisCheck;
  }

  const status = determineOverallStatus(checks);

  const result: HealthCheckResult = {
    status,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    uptime,
    checks,
  };

  // Return appropriate status code
  const httpStatus = status === 'healthy' ? 200 : 503;

  return NextResponse.json(result, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * HEAD /api/health
 *
 * Simple health check for basic monitoring (no body)
 */
export async function HEAD(): Promise<Response> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('platform')
      .select('id')
      .limit(1);

    if (error) {
      return new Response(null, { status: 503 });
    }

    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
