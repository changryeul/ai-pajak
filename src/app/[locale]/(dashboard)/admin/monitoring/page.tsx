'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'not_configured';
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface CircuitBreakerStatus {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure?: string | null;
}

interface MonitoringData {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: ServiceStatus[];
  circuitBreakers: CircuitBreakerStatus[];
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    percentage: number;
  };
  errorStats: {
    lastHour: number;
    last24Hours: number;
    last7Days: number;
  };
  recentAuditStats: {
    totalActions: number;
    topActions: Array<{ action: string; count: number }>;
  };
}

function StatusBadge({
  status,
}: {
  status: 'operational' | 'degraded' | 'down' | 'not_configured';
}) {
  const variants = {
    operational: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    down: 'bg-red-100 text-red-800 border-red-200',
    not_configured: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const icons = {
    operational: <CheckCircle className="h-3 w-3" />,
    degraded: <AlertCircle className="h-3 w-3" />,
    down: <AlertCircle className="h-3 w-3" />,
    not_configured: <AlertCircle className="h-3 w-3" />,
  };
  const labels = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
    not_configured: 'Not configured',
  };
  return (
    <Badge variant="outline" className={`${variants[status]} flex items-center gap-1`}>
      {icons[status]}
      {labels[status]}
    </Badge>
  );
}

function CircuitBreakerBadge({ state }: { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }) {
  const variants = {
    CLOSED: 'bg-green-100 text-green-800 border-green-200',
    OPEN: 'bg-red-100 text-red-800 border-red-200',
    HALF_OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  const labels = { CLOSED: 'Closed', OPEN: 'Open', HALF_OPEN: 'Half-Open' };
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
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatActionName(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MonitoringDashboard() {
  const t = useTranslations('admin');
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/monitoring', { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">{t('failedToLoad')}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('systemMonitoring')}</h1>
          <p className="text-muted-foreground">{t('monitoringSubtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={data.status} />
          <Button onClick={fetchData} variant="outline" size="sm" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t('systemStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={data.status} />
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
            <p className="text-2xl font-bold">{formatUptime(data.uptime)}</p>
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
              {data.services[0]?.latency ? formatLatency(data.services[0].latency) : '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Errors (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${data.errorStats.last24Hours > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.errorStats.last24Hours}
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
            <p className="text-2xl font-bold">{data.version}</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Statistics
          </CardTitle>
          <CardDescription>Failed operations tracked from audit logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Last Hour</p>
              <p className={`text-3xl font-bold ${data.errorStats.lastHour > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.errorStats.lastHour}
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Last 24 Hours</p>
              <p className={`text-3xl font-bold ${data.errorStats.last24Hours > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.errorStats.last24Hours}
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Last 7 Days</p>
              <p className={`text-3xl font-bold ${data.errorStats.last7Days > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                {data.errorStats.last7Days}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services + Circuit Breakers side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="space-y-3">
              {data.services.map((service) => (
                <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      service.status === 'operational' ? 'bg-green-500' :
                      service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      {service.message && (
                        <p className="text-xs text-muted-foreground">{service.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {service.latency != null && (
                      <span className="text-xs text-muted-foreground">
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
            <div className="space-y-3">
              {data.circuitBreakers.map((breaker) => (
                <div key={breaker.name} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm capitalize">{breaker.name}</p>
                    <CircuitBreakerBadge state={breaker.state} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span>{t('failures')}: {breaker.failures}</span>
                    {breaker.lastFailure && (
                      <span className="ml-3">
                        {t('lastFailure')}: {new Date(breaker.lastFailure).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {data.circuitBreakers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No circuit breakers configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Memory + Recent Activity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              {t('memoryUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>{t('heapUsed')}</span>
                  <span>{data.memory.heapUsed}MB / {data.memory.heapTotal}MB</span>
                </div>
                <Progress value={data.memory.percentage} />
                <p className="text-xs text-muted-foreground mt-1">
                  {data.memory.percentage}% heap used
                </p>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>RSS (Total Process)</span>
                  <span className="font-medium">{data.memory.rss}MB</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity (24h)
            </CardTitle>
            <CardDescription>
              {data.recentAuditStats.totalActions} total actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentAuditStats.topActions.length > 0 ? (
                data.recentAuditStats.topActions.map((item) => {
                  const maxCount = data.recentAuditStats.topActions[0]?.count || 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={item.action} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="truncate">{formatActionName(item.action)}</span>
                          <span className="text-muted-foreground ml-2">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        {t('lastUpdated')}: {new Date(data.timestamp).toLocaleString()}
        <span className="mx-2">|</span>
        Auto-refresh: 30s
      </div>
    </div>
  );
}
