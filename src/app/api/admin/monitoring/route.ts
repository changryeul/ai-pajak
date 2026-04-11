import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { UserRole, RequestWithSession } from '@/types/auth';
import { circuitBreakers, getCircuitBreakerHealth } from '@/lib/resilience/circuit-breaker';

/**
 * GET /api/admin/monitoring
 *
 * Comprehensive monitoring data for PLATFORM_ADMIN.
 * Returns system health, circuit breakers, memory, error stats, and API performance.
 */

const processStartTime = Date.now();

async function handler(_req: RequestWithSession): Promise<Response> {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - processStartTime) / 1000);

  // Run all checks in parallel
  const [dbCheck, redisCheck, errorStats, recentAuditStats] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    getErrorStats(),
    getRecentAuditStats(),
  ]);

  // Circuit breaker status (real)
  const cbHealth = getCircuitBreakerHealth();
  const circuitBreakerList = Object.entries(cbHealth).map(([name, stats]) => ({
    name,
    state: stats.state,
    failures: stats.failures,
    lastFailure: stats.lastFailure?.toISOString() ?? null,
  }));

  // Memory
  const mem = process.memoryUsage();
  const memory = {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    percentage: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  };

  // Overall status
  const isDown = dbCheck.status === 'down';
  const isDegraded = dbCheck.status === 'degraded'
    || redisCheck.status === 'degraded'
    || redisCheck.status === 'down'
    || circuitBreakerList.some((cb) => cb.state === 'OPEN');

  const overallStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'operational';

  return NextResponse.json({
    status: overallStatus,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime,
    services: [
      { name: 'Database (Supabase)', ...dbCheck, lastChecked: timestamp },
      { name: 'Redis (Upstash)', ...redisCheck, lastChecked: timestamp },
    ],
    circuitBreakers: circuitBreakerList,
    memory,
    errorStats,
    recentAuditStats,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function checkDatabase() {
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.from('platform').select('id').limit(1);
    const latency = Date.now() - start;

    if (error && error.code !== 'PGRST116') {
      return { status: 'down' as const, latency, message: error.message };
    }
    return {
      status: (latency > 1000 ? 'degraded' : 'operational') as 'operational' | 'degraded',
      latency,
    };
  } catch (err) {
    return { status: 'down' as const, latency: Date.now() - start, message: String(err) };
  }
}

async function checkRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { status: 'down' as const, message: 'Not configured' };
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
      status: (latency > 500 ? 'degraded' : 'operational') as 'operational' | 'degraded',
      latency,
    };
  } catch (err) {
    return { status: 'down' as const, latency: Date.now() - start, message: String(err) };
  }
}

// Audit-log activity_type values that represent failure events.
// activity_type is a Postgres enum, so ilike '%FAIL%' against the enum
// column does not work via supabase-js — we have to enumerate the values.
// Add new failure types here as they're introduced.
const FAILURE_ACTIVITY_TYPES = ['LOGIN_FAILURE'] as const;

async function getErrorStats() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Count error-related audit logs (failed actions). Use the actual column
    // name `activity_type` (was `action` — never existed on this table).
    const [hour, day, week] = await Promise.all([
      supabase.from('audit_log').select('id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo)
        .in('activity_type', FAILURE_ACTIVITY_TYPES as unknown as string[]),
      supabase.from('audit_log').select('id', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo)
        .in('activity_type', FAILURE_ACTIVITY_TYPES as unknown as string[]),
      supabase.from('audit_log').select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo)
        .in('activity_type', FAILURE_ACTIVITY_TYPES as unknown as string[]),
    ]);

    return {
      lastHour: hour.count ?? 0,
      last24Hours: day.count ?? 0,
      last7Days: week.count ?? 0,
    };
  } catch {
    return { lastHour: 0, last24Hours: 0, last7Days: 0 };
  }
}

async function getRecentAuditStats() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get activity distribution for last 24h. The column is `activity_type`
    // (an enum) — was previously querying a non-existent `action` column.
    // We expose it to the dashboard as `action` to keep the wire format
    // unchanged.
    const { data: logs } = await supabase
      .from('audit_log')
      .select('activity_type')
      .gte('created_at', oneDayAgo);

    const actionCounts: Record<string, number> = {};
    let totalActions = 0;

    if (logs) {
      for (const log of logs as Array<{ activity_type: string }>) {
        const key = log.activity_type;
        actionCounts[key] = (actionCounts[key] || 0) + 1;
        totalActions++;
      }
    }

    // Top 10 activity types
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return { totalActions, topActions };
  } catch {
    return { totalActions: 0, topActions: [] };
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.PLATFORM_ADMIN)
  )(request as RequestWithSession, handler);
}
