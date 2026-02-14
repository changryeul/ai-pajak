import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';

/**
 * System Status API
 *
 * GET /api/admin/system-status
 *
 * Provides comprehensive system health and metrics for monitoring.
 * This endpoint requires the CRON_SECRET for authentication.
 */

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface CircuitBreakerStatus {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure?: string;
}

interface SystemStatusResponse {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: ServiceStatus[];
  circuitBreakers: CircuitBreakerStatus[];
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    database: {
      connectionStatus: 'connected' | 'disconnected';
      latency: number;
    };
  };
}

const startTime = Date.now();

/**
 * Check database connectivity and latency
 */
async function checkDatabase(): Promise<{
  status: 'operational' | 'degraded' | 'down';
  latency: number;
  message?: string;
}> {
  const start = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('platform')
      .select('id')
      .limit(1);

    const latency = Date.now() - start;

    if (error && error.code !== 'PGRST116') {
      return {
        status: 'down',
        latency,
        message: error.message,
      };
    }

    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'High latency detected',
      };
    }

    return {
      status: 'operational',
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
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return {
      name: 'Redis (Upstash)',
      status: 'down',
      message: 'Not configured',
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    await redis.ping();
    const latency = Date.now() - start;

    return {
      name: 'Redis (Upstash)',
      status: latency > 500 ? 'degraded' : 'operational',
      latency,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: 'Redis (Upstash)',
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check external service connectivity
 */
async function checkExternalService(
  name: string,
  url: string,
  timeout: number = 5000
): Promise<ServiceStatus> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name,
        status: 'degraded',
        latency,
        message: `HTTP ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name,
      status: latency > 2000 ? 'degraded' : 'operational',
      latency,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name,
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Get circuit breaker statuses
 */
function getCircuitBreakerStatuses(): CircuitBreakerStatus[] {
  const breakers: CircuitBreakerStatus[] = [];

  // Get status for each circuit breaker
  const breakerNames = ['djp', 'midtrans', 'email'] as const;

  for (const name of breakerNames) {
    const breaker = circuitBreakers[name];
    const state = breaker.getState();
    const stats = breaker.getStats();

    breakers.push({
      name,
      state,
      failures: stats.failures,
      lastFailure: stats.lastFailure?.toISOString(),
    });
  }

  return breakers;
}

/**
 * Determine overall system status
 */
function determineOverallStatus(services: ServiceStatus[]): 'operational' | 'degraded' | 'down' {
  const hasDown = services.some((s) => s.status === 'down' && s.name === 'Database (Supabase)');
  const hasDegraded = services.some((s) => s.status === 'degraded' || s.status === 'down');

  if (hasDown) return 'down';
  if (hasDegraded) return 'degraded';
  return 'operational';
}

/**
 * Verify request authentication
 */
function verifyAuth(request: NextRequest): boolean {
  // Allow access with CRON_SECRET header
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  // Allow access with Authorization Bearer token (service role key)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return true;
    }
  }

  return false;
}

export async function GET(request: NextRequest): Promise<Response> {
  // Verify authentication
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Run all service checks in parallel
  const [databaseResult, redisStatus, midtransStatus, supabaseStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkExternalService('Midtrans API', 'https://api.midtrans.com'),
    checkExternalService('Supabase API', process.env.NEXT_PUBLIC_SUPABASE_URL!),
  ]);

  // Build services array
  const services: ServiceStatus[] = [
    {
      name: 'Database (Supabase)',
      status: databaseResult.status,
      latency: databaseResult.latency,
      message: databaseResult.message,
      lastChecked: timestamp,
    },
    redisStatus,
    midtransStatus,
    supabaseStatus,
  ];

  // Get circuit breaker statuses
  const circuitBreakerStatuses = getCircuitBreakerStatuses();

  // Get memory metrics (Node.js)
  const memoryUsage = process.memoryUsage();
  const memoryMetrics = {
    used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
    total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
    percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
  };

  // Determine overall status
  const overallStatus = determineOverallStatus(services);

  const response: SystemStatusResponse = {
    status: overallStatus,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime,
    services,
    circuitBreakers: circuitBreakerStatuses,
    metrics: {
      memory: memoryMetrics,
      database: {
        connectionStatus: databaseResult.status === 'down' ? 'disconnected' : 'connected',
        latency: databaseResult.latency,
      },
    },
  };

  // Return appropriate status code
  const httpStatus = overallStatus === 'down' ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
