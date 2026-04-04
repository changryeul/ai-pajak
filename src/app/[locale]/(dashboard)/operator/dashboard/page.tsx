'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Headphones,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowRight,
  Loader2,
  RefreshCw,
  ListChecks,
  Zap,
  TrendingUp,
  Timer,
} from 'lucide-react';

interface QueueItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period: number;
  tax_year: number;
  amount: number;
  status: string;
  ebilling_code: string | null;
  bpe_number: string | null;
  bpe_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    customer_name: string;
    npwp: string;
  } | null;
}

interface DashboardData {
  assignments: Array<{
    id: string;
    customer_id: string;
    assigned_at: string;
    customer: {
      id: string;
      customer_name: string;
      npwp: string;
      customer_type: string;
      is_active: boolean;
    } | null;
  }>;
  queueItems: QueueItem[];
  stats: {
    totalAssigned: number;
    pending: number;
    inProgress: number;
    completedThisMonth: number;
    failedThisMonth: number;
  };
  summary: {
    totalAssigned: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
}

function fmt(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function OperatorDashboardPage() {
  const t = useTranslations('operator');

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    PENDING:            { label: t('statusPending'),           color: 'text-gray-700',    bg: 'bg-gray-100' },
    DATA_REVIEW:        { label: t('statusDataReview'),        color: 'text-blue-700',    bg: 'bg-blue-100' },
    PENDING_APPROVAL:   { label: t('statusPendingApproval'),   color: 'text-orange-700',  bg: 'bg-orange-100' },
    APPROVED:           { label: t('statusApproved'),          color: 'text-emerald-700', bg: 'bg-emerald-100' },
    EBILLING_GENERATED: { label: t('statusEbillingGenerated'), color: 'text-indigo-700',  bg: 'bg-indigo-100' },
    PAYMENT_PENDING:    { label: t('statusPaymentPending'),    color: 'text-yellow-700',  bg: 'bg-yellow-100' },
    PAYMENT_UPLOADED:   { label: t('statusPaymentUploaded'),   color: 'text-cyan-700',    bg: 'bg-cyan-100' },
    PAYMENT_VERIFIED:   { label: t('statusPaymentVerified'),   color: 'text-purple-700',  bg: 'bg-purple-100' },
    DJP_SUBMITTED:      { label: t('statusDjpSubmitted'),      color: 'text-amber-700',   bg: 'bg-amber-100' },
    BPE_UPLOADED:       { label: t('statusBpeUploaded'),       color: 'text-teal-700',    bg: 'bg-teal-100' },
    COMPLETED:          { label: t('statusCompleted'),         color: 'text-green-700',   bg: 'bg-green-100' },
    FAILED:             { label: t('statusFailed'),            color: 'text-red-700',     bg: 'bg-red-100' },
  };

  const ACTION_CONFIG: Record<string, { label: string; action: string; color: string }> = {
    PENDING:            { label: t('actionReview'),            action: 'review',            color: 'bg-blue-600 hover:bg-blue-700' },
    DATA_REVIEW:        { label: t('actionRequestApproval'),   action: 'request-approval',  color: 'bg-orange-600 hover:bg-orange-700' },
    PENDING_APPROVAL:   { label: t('actionApprove'),           action: 'approve',           color: 'bg-emerald-600 hover:bg-emerald-700' },
    APPROVED:           { label: t('actionGenerateEbilling'),  action: 'generate-ebilling', color: 'bg-indigo-600 hover:bg-indigo-700' },
    EBILLING_GENERATED: { label: t('actionNotifyCustomer'),    action: 'notify-customer',   color: 'bg-yellow-600 hover:bg-yellow-700' },
    PAYMENT_UPLOADED:   { label: t('actionVerifyPayment'),     action: 'verify-payment',    color: 'bg-purple-600 hover:bg-purple-700' },
    PAYMENT_VERIFIED:   { label: t('actionSubmitDjp'),         action: 'submit-djp',        color: 'bg-amber-600 hover:bg-amber-700' },
    DJP_SUBMITTED:      { label: t('actionUploadBpe'),         action: 'upload-bpe',        color: 'bg-teal-600 hover:bg-teal-700' },
    BPE_UPLOADED:       { label: t('actionComplete'),          action: 'complete',          color: 'bg-green-600 hover:bg-green-700' },
  };

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal state for actions that need input
  const [modalState, setModalState] = useState<{
    open: boolean;
    itemId: string;
    action: string;
    ebillingCode: string;
    bpeNumber: string;
    bpeDate: string;
    notes: string;
  }>({
    open: false,
    itemId: '',
    action: '',
    ebillingCode: '',
    bpeNumber: '',
    bpeDate: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operator');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime stats
  const [realtimeStats, setRealtimeStats] = useState<{
    statusDistribution: Record<string, number>;
    hourlyThroughput: Array<{ hour: string; count: number }>;
    metrics: {
      totalItems: number; activeItems: number; completedToday: number;
      avgProcessingHours: number; autoApprovalRate: number; slaBreaches: number;
    };
    agingItems: Array<{ id: string; status: string; taxType: string; ageHours: number; slaWarning: boolean }>;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadRealtimeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/operator/queue/realtime-stats');
      const json = await res.json();
      if (json.success) {
        setRealtimeStats(json.data);
        setLastUpdated(new Date());
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadData();
    loadRealtimeStats();
    const interval = setInterval(() => {
      loadData();
      loadRealtimeStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, loadRealtimeStats]);

  const handleAction = async (itemId: string, action: string) => {
    // Actions that need additional input
    if (action === 'generate-ebilling' || action === 'upload-bpe') {
      setModalState({
        open: true,
        itemId,
        action,
        ebillingCode: '',
        bpeNumber: '',
        bpeDate: '',
        notes: '',
      });
      return;
    }

    await executeAction(itemId, action, {});
  };

  const executeAction = async (
    itemId: string,
    action: string,
    extra: Record<string, string>
  ) => {
    setActionLoading(itemId);
    try {
      const res = await fetch('/api/operator/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, action, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: json.message || t('statusUpdated'), type: 'success' });
        loadData();
      } else {
        setMessage({ text: json.error || t('errorOccurred'), type: 'error' });
      }
    } catch {
      setMessage({ text: t('networkError'), type: 'error' });
    } finally {
      setActionLoading(null);
      setModalState(prev => ({ ...prev, open: false }));
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleModalSubmit = () => {
    const extra: Record<string, string> = {};
    if (modalState.action === 'generate-ebilling') {
      if (!modalState.ebillingCode) return;
      extra.ebillingCode = modalState.ebillingCode;
    }
    if (modalState.action === 'upload-bpe') {
      if (!modalState.bpeNumber || !modalState.bpeDate) return;
      extra.bpeNumber = modalState.bpeNumber;
      extra.bpeDate = modalState.bpeDate;
    }
    if (modalState.notes) extra.notes = modalState.notes;
    executeAction(modalState.itemId, modalState.action, extra);
  };

  const activeItems = data?.queueItems.filter(q => !['COMPLETED', 'FAILED'].includes(q.status)) || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10">
          <p className="text-blue-200 text-sm flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            {t('taxOperator')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('dashboardTitle')}</h1>
          <p className="text-blue-100 text-sm mt-2">{t('dashboardSubtitle')}</p>

          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{data.summary.totalAssigned}</p>
                <p className="text-xs text-blue-200">{t('assignedClients')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{data.summary.pending}</p>
                <p className="text-xs text-blue-200">{t('pendingBadge')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{data.summary.inProgress}</p>
                <p className="text-xs text-blue-200">{t('inProgress')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{data.summary.completed}</p>
                <p className="text-xs text-blue-200">{t('completedBadge')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm text-gray-500 mt-2">{t('loadingData')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('assignedClients'), value: data?.stats.totalAssigned || 0, icon: Users, gradient: 'from-blue-500 to-cyan-600' },
              { label: t('pendingItems'), value: data?.stats.pending || 0, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
              { label: t('inProgress'), value: data?.stats.inProgress || 0, icon: ListChecks, gradient: 'from-indigo-500 to-purple-600' },
              { label: t('completedThisMonth'), value: data?.stats.completedThisMonth || 0, icon: CheckCircle, gradient: 'from-green-500 to-emerald-600' },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <Card key={i} className="border-0 shadow-sm group hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{kpi.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} group-hover:scale-110 transition-transform`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Failed items warning */}
          {(data?.stats.failedThisMonth || 0) > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {t('failedThisMonth', { count: data?.stats.failedThisMonth || 0 })}
                </p>
                <p className="text-xs text-red-600">{t('failedRetryMessage')}</p>
              </div>
            </div>
          )}

          {/* Submission Queue Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('queueCount', { count: activeItems.length })}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadData}
                className="text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {t('refresh')}
              </Button>
            </CardHeader>
            <CardContent>
              {activeItems.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-3" />
                  <p className="text-gray-400 text-sm">{t('noItemsToProcess')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-3 px-3">{t('customerName')}</th>
                        <th className="text-left py-3 px-3">{t('taxType')}</th>
                        <th className="text-left py-3 px-3">{t('period')}</th>
                        <th className="text-right py-3 px-3">{t('amount')}</th>
                        <th className="text-center py-3 px-3">{t('status')}</th>
                        <th className="text-center py-3 px-3">{t('action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeItems.map((item) => {
                        const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                        const actionCfg = ACTION_CONFIG[item.status];

                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <p className="font-medium text-xs text-gray-900">
                                {item.customer?.customer_name || '-'}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {item.customer?.npwp || '-'}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {item.tax_type}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-xs text-gray-600">
                              {item.tax_year}/{String(item.tax_period).padStart(2, '0')}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs">
                              {fmt(item.amount || 0)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Badge className={`text-[10px] ${statusCfg.bg} ${statusCfg.color} border-0`}>
                                {statusCfg.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {actionCfg && (
                                <Button
                                  size="sm"
                                  className={`text-[10px] h-7 text-white ${actionCfg.color}`}
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleAction(item.id, actionCfg.action)}
                                >
                                  {actionLoading === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      {actionCfg.label}
                                      <ArrowRight className="h-3 w-3 ml-1" />
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently Completed */}
          {(data?.queueItems.filter(q => q.status === 'COMPLETED').length || 0) > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {t('recentlyCompleted')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data?.queueItems
                    .filter(q => q.status === 'COMPLETED')
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-xs font-medium">{item.customer?.customer_name || '-'}</p>
                            <p className="text-[10px] text-gray-500">
                              {item.tax_type} - {item.tax_year}/{String(item.tax_period).padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono">{fmt(item.amount || 0)}</p>
                          {item.bpe_number && (
                            <p className="text-[10px] text-gray-500">BPE: {item.bpe_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Real-time Analytics */}
      {realtimeStats && (
        <div className="space-y-6 mb-6">
          {/* Last updated */}
          {lastUpdated && (
            <p className="text-xs text-gray-400 text-right">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              {lastUpdated.toLocaleTimeString()} (30s auto)
            </p>
          )}

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                <p className="text-2xl font-bold">{realtimeStats.metrics.completedToday}</p>
                <p className="text-xs text-gray-500">{t('completedToday')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <Timer className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold">{realtimeStats.metrics.avgProcessingHours}h</p>
                <p className="text-xs text-gray-500">{t('avgProcessingTime')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                <p className="text-2xl font-bold">{realtimeStats.metrics.autoApprovalRate}%</p>
                <p className="text-xs text-gray-500">{t('autoApprovalRateLabel')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <ListChecks className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
                <p className="text-2xl font-bold">{realtimeStats.metrics.activeItems}</p>
                <p className="text-xs text-gray-500">{t('activeItemsLabel')}</p>
              </CardContent>
            </Card>
            <Card className={realtimeStats.metrics.slaBreaches > 0 ? 'ring-2 ring-red-200' : ''}>
              <CardContent className="pt-4 pb-3 text-center">
                <AlertCircle className={`h-5 w-5 mx-auto mb-1 ${realtimeStats.metrics.slaBreaches > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                <p className={`text-2xl font-bold ${realtimeStats.metrics.slaBreaches > 0 ? 'text-red-600' : ''}`}>
                  {realtimeStats.metrics.slaBreaches}
                </p>
                <p className="text-xs text-gray-500">{t('slaWarning')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution PieChart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('statusDistribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(realtimeStats.statusDistribution).map(([name, value]) => ({ name, value }))}
                      cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                      dataKey="value" paddingAngle={2}
                    >
                      {Object.keys(realtimeStats.statusDistribution).map((status, i) => {
                        const colors: Record<string, string> = {
                          PENDING: '#9ca3af', DATA_REVIEW: '#3b82f6', PENDING_APPROVAL: '#f97316',
                          APPROVED: '#10b981', EBILLING_GENERATED: '#6366f1', PAYMENT_PENDING: '#eab308',
                          PAYMENT_UPLOADED: '#06b6d4', PAYMENT_VERIFIED: '#8b5cf6', DJP_SUBMITTED: '#f59e0b',
                          BPE_UPLOADED: '#14b8a6', COMPLETED: '#22c55e', FAILED: '#ef4444',
                        };
                        return <Cell key={i} fill={colors[status] || '#9ca3af'} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} ${t('items')}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {Object.entries(realtimeStats.statusDistribution)
                    .filter(([, v]) => v > 0)
                    .map(([status, count]) => (
                      <Badge key={status} variant="outline" className="text-xs">
                        {status.replace(/_/g, ' ')} ({count})
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Hourly Throughput AreaChart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('hourlyThroughput')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={realtimeStats.hourlyThroughput}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} ${t('items')}`, t('completed')]} />
                    <Area type="monotone" dataKey="count" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* SLA Aging Alert */}
          {realtimeStats.agingItems.filter(i => i.slaWarning).length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-red-700 flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" /> {t('slaWarningOver48h')}
                </p>
                <div className="space-y-1">
                  {realtimeStats.agingItems.filter(i => i.slaWarning).map(item => (
                    <p key={item.id} className="text-xs text-red-600">
                      {item.taxType} [{item.status}] — {t('hoursElapsed', { hours: item.ageHours })}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Input Modal */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">
              {modalState.action === 'generate-ebilling' ? t('ebillingCodeInput') : t('bpeInfoInput')}
            </h3>

            <div className="space-y-4">
              {modalState.action === 'generate-ebilling' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {t('ebillingCodeRequired')}
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={t('enterEbillingCode')}
                    value={modalState.ebillingCode}
                    onChange={(e) => setModalState(prev => ({ ...prev, ebillingCode: e.target.value }))}
                  />
                </div>
              )}

              {modalState.action === 'upload-bpe' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {t('bpeNumberRequired')}
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder={t('enterBpeNumber')}
                      value={modalState.bpeNumber}
                      onChange={(e) => setModalState(prev => ({ ...prev, bpeNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {t('bpeDateRequired')}
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={modalState.bpeDate}
                      onChange={(e) => setModalState(prev => ({ ...prev, bpeDate: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{t('notes')}</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows={2}
                  placeholder={t('notesPlaceholder')}
                  value={modalState.notes}
                  onChange={(e) => setModalState(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState(prev => ({ ...prev, open: false }))}
              >
                {t('cancel')}
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleModalSubmit}
                disabled={
                  (modalState.action === 'generate-ebilling' && !modalState.ebillingCode) ||
                  (modalState.action === 'upload-bpe' && (!modalState.bpeNumber || !modalState.bpeDate))
                }
              >
                {t('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
