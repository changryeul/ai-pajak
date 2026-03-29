'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from 'lucide-react';

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

interface SystemStatus {
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

function StatusBadge({ status }: { status: 'operational' | 'degraded' | 'down' }) {
  const variants = {
    operational: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    down: 'bg-red-100 text-red-800 border-red-200',
  };

  const icons = {
    operational: <CheckCircle className="h-3 w-3" />,
    degraded: <AlertCircle className="h-3 w-3" />,
    down: <AlertCircle className="h-3 w-3" />,
  };

  return (
    <Badge variant="outline" className={`${variants[status]} flex items-center gap-1`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function CircuitBreakerBadge({ state }: { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }) {
  const variants = {
    CLOSED: 'bg-green-100 text-green-800 border-green-200',
    OPEN: 'bg-red-100 text-red-800 border-red-200',
    HALF_OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const labels = {
    CLOSED: 'Closed',
    OPEN: 'Open',
    HALF_OPEN: 'Half-Open',
  };

  return (
    <Badge variant="outline" className={variants[state]}>
      {labels[state]}
    </Badge>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatLatency(ms: number): string {
  if (ms < 100) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function MonitoringDashboard() {
  const t = useTranslations('admin');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/health');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Transform health check response to system status format
      const transformed: SystemStatus = {
        status: data.status === 'healthy' ? 'operational' : data.status === 'degraded' ? 'degraded' : 'down',
        timestamp: data.timestamp,
        version: data.version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: data.uptime || 0,
        services: [
          {
            name: 'Database (Supabase)',
            status: data.checks?.database?.status === 'up' ? 'operational' : data.checks?.database?.status === 'degraded' ? 'degraded' : 'down',
            latency: data.checks?.database?.latency,
            message: data.checks?.database?.message,
            lastChecked: data.timestamp,
          },
          ...(data.checks?.redis ? [{
            name: 'Redis (Upstash)',
            status: data.checks.redis.status === 'up' ? 'operational' as const : data.checks.redis.status === 'degraded' ? 'degraded' as const : 'down' as const,
            latency: data.checks.redis.latency,
            message: data.checks.redis.message,
            lastChecked: data.timestamp,
          }] : []),
        ],
        circuitBreakers: [
          { name: 'DJP API', state: 'CLOSED', failures: 0 },
          { name: 'Midtrans', state: 'CLOSED', failures: 0 },
          { name: 'Email', state: 'CLOSED', failures: 0 },
        ],
        metrics: {
          memory: {
            used: 0,
            total: 0,
            percentage: 0,
          },
          database: {
            connectionStatus: data.checks?.database?.status === 'up' ? 'connected' : 'disconnected',
            latency: data.checks?.database?.latency || 0,
          },
        },
      };

      setSystemStatus(transformed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !systemStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">{t('failedToLoad')}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchStatus} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('systemMonitoring')}</h1>
          <p className="text-muted-foreground">
            {t('monitoringSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {systemStatus && <StatusBadge status={systemStatus.status} />}
          <Button
            onClick={fetchStatus}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t('systemStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemStatus && <StatusBadge status={systemStatus.status} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('uptime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {systemStatus ? formatUptime(systemStatus.uptime) : '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t('dbLatency')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {systemStatus?.metrics.database.latency
                ? formatLatency(systemStatus.metrics.database.latency)
                : '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('version')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{systemStatus?.version || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('services')}
          </CardTitle>
          <CardDescription>{t('servicesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemStatus?.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      service.status === 'operational'
                        ? 'bg-green-500'
                        : service.status === 'degraded'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{service.name}</p>
                    {service.message && (
                      <p className="text-sm text-muted-foreground">{service.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {service.latency && (
                    <span className="text-sm text-muted-foreground">
                      {formatLatency(service.latency)}
                    </span>
                  )}
                  <StatusBadge status={service.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Circuit Breakers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('circuitBreakers')}
          </CardTitle>
          <CardDescription>{t('circuitBreakersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {systemStatus?.circuitBreakers.map((breaker) => (
              <div
                key={breaker.name}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{breaker.name}</p>
                  <CircuitBreakerBadge state={breaker.state} />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{t('failures')}: {breaker.failures}</p>
                  {breaker.lastFailure && (
                    <p>{t('lastFailure')}: {new Date(breaker.lastFailure).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Memory Usage */}
      {systemStatus?.metrics?.memory?.percentage && systemStatus.metrics.memory.percentage > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('memoryUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('heapUsed')}</span>
                <span>
                  {systemStatus.metrics.memory.used}MB / {systemStatus.metrics.memory.total}MB
                </span>
              </div>
              <Progress value={systemStatus.metrics.memory.percentage} />
              <p className="text-sm text-muted-foreground">
                {systemStatus.metrics.memory.percentage}% used
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        {t('lastUpdated')}: {systemStatus ? new Date(systemStatus.timestamp).toLocaleString() : '-'}
      </div>
    </div>
  );
}
