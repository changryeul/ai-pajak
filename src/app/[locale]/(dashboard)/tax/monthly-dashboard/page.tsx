'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  Loader2, CheckCircle, AlertTriangle, Clock, FileText,
  Receipt, DollarSign, Shield, TrendingUp, ArrowRight,
  Sparkles, Calendar, BarChart3, PieChart, CalendarClock, Wallet,
  Upload, Building2, Landmark, FileCheck2, ChevronDown, Users,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fmtRp } from '@/lib/utils';

interface MonthlyStatus {
  taxType: string;
  period: string;
  transactionCount: number;
  totalTax: number;
  bupotGenerated: number;
  bupotPending: number;
  sptMasaFiled: boolean;
  paymentStatus: string; // UNPAID, PAID, OVERDUE
  paymentDeadline: string;
  reportingDeadline: string;
}

const TAX_TYPES = [
  { key: 'PPh21', label: 'PPh 21', icon: FileText, gradient: 'from-blue-500 to-indigo-600', desc: '근로소득세' },
  { key: 'PPh23', label: 'PPh 23', icon: Receipt, gradient: 'from-emerald-500 to-green-600', desc: '원천징수세' },
  { key: 'PPh_FINAL', label: 'PPh 4(2)', icon: Shield, gradient: 'from-amber-500 to-yellow-600', desc: 'Final Tax' },
  { key: 'PPN', label: 'PPN', icon: DollarSign, gradient: 'from-orange-500 to-red-500', desc: '부가가치세' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


export default function MonthlyDashboardPage() {
  const t = useTranslations('monthlyDashboard');
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [dataLoading, setDataLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payments, setPayments] = useState<Array<{ tax_type: string; tax_period: string; status: string; amount_due: number; spt_masa_filed: boolean; payment_deadline: string; reporting_deadline: string }>>([]);
  const [filings, setFilings] = useState<Array<{ tax_type: string; tax_period: string; status: string }>>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [overview, setOverview] = useState<{
    kpis: { deadlines: number; attention: number; expectedTax: number; submitted: number };
    workQueue: Array<{ id: string; title: string; desc: string; priority: string; actionKey: string; count: number }>;
    upcomingDeadlines: Array<{ tax: string; due: string; entity: string; status: string; daysLeft: number }>;
    riskAlerts: Array<{ type: string; message: string; severity: string }>;
    clientStatus: Array<{ id: string; name: string; health: string; open: number; done: number }>;
    recentSubmissions: Array<{ taxType: string; company: string; status: string; amount: number }>;
    isConsultant: boolean;
  } | null>(null);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      // Dashboard overview (KPIs, work queue, risks, etc.)
      const overviewRes = await fetch('/api/tax/dashboard-overview', { credentials: 'include' });
      if (overviewRes.ok) {
        const ovData = await overviewRes.json();
        if (ovData.success) setOverview(ovData.data);
      } else {
        console.error('Dashboard overview failed:', overviewRes.status, await overviewRes.text());
      }

      // Legacy grid data (only if customer has customerId)
      if (session.customerId) {
        const res = await fetch(`/api/tax/monthly-payments?year=${year}&customerId=${session.customerId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const allPayments: typeof payments = [];
            for (const summary of (data.data?.summary || [])) {
              for (const p of (summary.payments || [])) {
                allPayments.push(p);
              }
            }
            setPayments(allPayments);
          }
        }

        const filingRes = await fetch(`/api/tax/filings?customerId=${session.customerId}&year=${year}`);
        if (filingRes.ok) {
          const filingData = await filingRes.json();
          if (filingData.success) {
            setFilings((filingData.data || []).map((f: { tax_type: string; tax_period: string; status: string }) => ({
              tax_type: f.tax_type,
              tax_period: f.tax_period,
              status: f.status,
            })));
          }
        }
      }
    } catch (err) { console.error(err); }
    finally { setDataLoading(false); }
  }, [session, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWorkQueueAction = async (taskId: string) => {
    const actionMap: Record<string, string> = {
      'missing-docs': 'request-docs',
      'ai-review': 'start-review',
      'billing': 'create-billing',
      'e-filing': 'submit-filing',
    };
    const action = actionMap[taskId];
    if (!action) return;

    setActionLoading(taskId);
    try {
      const res = await fetch('/api/tax/work-queue-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      const result = await res.json();

      if (!res.ok) {
        alert(result.error || '작업 실행에 실패했습니다');
        return;
      }

      alert(result.message || '처리되었습니다');

      // start-review: navigate to calculations page
      if (action === 'start-review' && result.redirectTo) {
        router.push(`/${locale}${result.redirectTo}`);
        return;
      }

      // Refresh dashboard
      await loadData();
    } catch (err) {
      console.error(err);
      alert('작업 실행 중 오류가 발생했습니다');
    } finally {
      setActionLoading(null);
    }
  };

  // Build month × tax type grid
  const getStatus = (taxType: string, month: number): { status: string; amount: number; sptFiled: boolean; filingStatus: string | null } => {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const p = payments.find(p => p.tax_type === taxType && p.tax_period === period);
    const f = filings.find(f => f.tax_type === taxType && f.tax_period === period);
    return {
      status: p?.status || (month <= currentMonth && year === currentYear ? 'NONE' : 'FUTURE'),
      amount: p?.amount_due || 0,
      sptFiled: p?.spt_masa_filed || false,
      filingStatus: f?.status || null,
    };
  };

  const statusColors: Record<string, string> = {
    PAID: 'bg-green-500',
    UNPAID: 'bg-gray-300',
    OVERDUE: 'bg-red-500',
    PARTIAL: 'bg-yellow-400',
    NONE: 'bg-gray-100',
    FUTURE: 'bg-gray-50',
  };

  // Summary stats
  const totalDue = payments.reduce((s, p) => s + (p.amount_due || 0), 0);
  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const overdueCount = payments.filter(p => p.status === 'OVERDUE').length;
  const pendingCount = payments.filter(p => p.status === 'UNPAID').length;
  const sptFiledCount = payments.filter(p => p.spt_masa_filed).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />{t('headerLabel')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('title')}</h1>
          <p className="text-slate-400 mt-2 text-sm">{t('subtitle')}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs">{t('totalDue')}</p>
              <p className="font-bold text-lg">{fmtRp(totalDue)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-400" />{t('paidCount')}</p>
              <p className="font-bold text-lg">{paidCount}{t('count')}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />{t('overdueCount')}</p>
              <p className="font-bold text-lg text-red-400">{overdueCount}{t('count')}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><FileText className="h-3 w-3 text-blue-400" />{t('sptFiled')}</p>
              <p className="font-bold text-lg">{sptFiledCount}{t('count')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── NEW: KPI Cards (4 boxes) ── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { key: 'kpiDeadlines', value: `${overview.kpis.deadlines}${t('count')}`, desc: t('kpiDeadlinesDesc'), icon: CalendarClock, color: 'text-blue-600 bg-blue-50' },
            { key: 'kpiAttention', value: `${overview.kpis.attention}${t('count')}`, desc: t('kpiAttentionDesc'), icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
            { key: 'kpiExpected', value: fmtRp(overview.kpis.expectedTax), desc: t('kpiExpectedDesc'), icon: Wallet, color: 'text-amber-600 bg-amber-50' },
            { key: 'kpiSubmitted', value: `${overview.kpis.submitted}${t('count')}`, desc: t('kpiSubmittedDesc'), icon: CheckCircle, color: 'text-green-600 bg-green-50' },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.key} className="border-0 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-gray-500">{t(kpi.key)}</p>
                    <div className={`p-1.5 rounded-lg ${kpi.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">{kpi.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{kpi.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── NEW: Work Queue (Priority Tasks) ── */}
      {overview && (() => {
        const tasks = overview.workQueue;

        return (
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">이번 주 우선 처리 업무</h3>
              <p className="text-sm text-gray-400 mt-1">가장 먼저 처리해야 할 실무 작업만 노출</p>
            </div>
            <div className="space-y-3">
              {tasks.map((task) => {
                const iconMap: Record<string, typeof Upload> = {
                  'missing-docs': Upload,
                  'ai-review': Receipt,
                  'billing': Landmark,
                  'e-filing': FileCheck2,
                };
                const Icon = iconMap[task.id] || FileText;
                const isHigh = task.priority === 'HIGH';
                const isLow = task.priority === 'LOW';

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-gray-500" />
                    </div>

                    {/* Title + Badge + Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-base text-gray-900">{task.title}</h4>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          isHigh
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : isLow
                              ? 'bg-gray-50 text-gray-500 border-gray-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {isHigh ? '높음' : isLow ? '없음' : '중간'}
                        </span>
                        {task.count > 0 && (
                          <span className="text-xs text-gray-500">({task.count}건)</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{task.desc}</p>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleWorkQueueAction(task.id)}
                      disabled={actionLoading === task.id || task.count === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm font-medium text-gray-700">{task.actionKey}</span>
                      {actionLoading === task.id ? (
                        <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── NEW: Upcoming Deadlines + Risk Alerts (2-col) ── */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Upcoming Deadlines */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />{t('upcomingDeadlinesTitle')}
              </h3>
              {overview.upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">{t('noUpcomingDeadlines')}</p>
              ) : (
                <div className="space-y-2">
                  {overview.upcomingDeadlines.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 font-mono">{d.tax}</Badge>
                        <span className="text-xs text-gray-600 truncate">{d.entity}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{d.due}</span>
                        <Badge className={
                          d.status === 'urgent' ? 'text-[9px] bg-red-100 text-red-700' :
                          d.status === 'filed' ? 'text-[9px] bg-green-100 text-green-700' :
                          d.status === 'review' ? 'text-[9px] bg-yellow-100 text-yellow-700' :
                          'text-[9px] bg-gray-100 text-gray-600'
                        }>
                          D-{d.daysLeft}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Alerts */}
          <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />{t('riskAlertsTitle')}
              </h3>
              {overview.riskAlerts.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">{t('noRiskAlerts')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overview.riskAlerts.map((alert, i) => (
                    <div key={i} className={`p-2.5 rounded-lg text-xs ${alert.severity === 'HIGH' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${alert.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500'}`} />
                        <span>{alert.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── NEW: Client Status (Consultant only) ── */}
      {overview?.isConsultant && overview.clientStatus.length > 0 && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />{t('clientStatusTitle')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overview.clientStatus.slice(0, 6).map((client) => (
                <div key={client.id} className="p-3 rounded-xl border border-gray-100 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => router.push(`/${locale}/customers/${client.id}`)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-gray-400" />
                        <p className="text-sm font-medium truncate">{client.name}</p>
                      </div>
                    </div>
                    <Badge className={
                      client.health === 'attention' ? 'text-[9px] bg-red-100 text-red-700' :
                      client.health === 'review' ? 'text-[9px] bg-yellow-100 text-yellow-700' :
                      'text-[9px] bg-green-100 text-green-700'
                    }>
                      {client.health === 'attention' ? t('healthAttention') : client.health === 'review' ? t('healthReview') : t('healthNormal')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{t('openCount')}: <span className="font-bold text-gray-700">{client.open}</span></span>
                    <span>•</span>
                    <span>{t('doneCount')}: <span className="font-bold text-gray-700">{client.done}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grid Toggle ── */}
      {payments.length > 0 && (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setShowGrid(!showGrid)} className="text-xs text-gray-500">
            <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showGrid ? '' : '-rotate-90'}`} />
            {showGrid ? t('hideGrid') : t('showGrid')}
          </Button>
        </div>
      )}

      {/* Urgent Reminders */}
      {(() => {
        const now = new Date();
        const urgent = payments.filter(p => {
          if (p.status === 'PAID') return false;
          const deadline = new Date(p.payment_deadline);
          const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft >= 0 && daysLeft <= 3;
        });
        const overdue = payments.filter(p => p.status === 'OVERDUE');

        if (urgent.length === 0 && overdue.length === 0) return null;

        return (
          <div className="mb-6 space-y-2">
            {overdue.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="font-medium">{t('overdueAlert', { count: overdue.length })}</span>
                <span className="text-red-600">{overdue.map(p => `${p.tax_type} (${p.tax_period})`).join(', ')}</span>
              </div>
            )}
            {urgent.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="font-medium">{t('deadlineAlert', { count: urgent.length })}</span>
                <span className="text-amber-600">
                  {urgent.map(p => {
                    const dl = new Date(p.payment_deadline);
                    const days = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return `${p.tax_type} (D-${days})`;
                  }).join(', ')}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Year Selector */}
      <div className="flex justify-between items-center mb-6">
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`/${locale}/tax/spt-masa`)}>
            <Receipt className="h-3 w-3 mr-1" />SPT Masa
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`/${locale}/tax/ppn`)}>
            <DollarSign className="h-3 w-3 mr-1" />e-Faktur
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>
      ) : !showGrid ? null : (
        <>
          {/* Monthly Grid per Tax Type */}
          <div className="space-y-4">
            {TAX_TYPES.map(tax => {
              const Icon = tax.icon;
              const monthlyAmounts = MONTHS.map((_, i) => getStatus(tax.key, i + 1));
              const yearTotal = monthlyAmounts.reduce((s, m) => s + m.amount, 0);

              return (
                <Card key={tax.key} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      {/* Tax type label */}
                      <div className={`w-36 bg-gradient-to-br ${tax.gradient} p-4 flex flex-col justify-center text-white`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="font-bold text-sm">{tax.label}</span>
                        </div>
                        <p className="text-[10px] opacity-75">{tax.desc}</p>
                        <p className="font-mono text-xs mt-2 opacity-90">{fmtRp(yearTotal)}</p>
                      </div>

                      {/* Month grid */}
                      <div className="flex-1 p-3">
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                          {MONTHS.map((label, i) => {
                            const m = monthlyAmounts[i];
                            const isCurrent = i + 1 === currentMonth && year === currentYear;

                            return (
                              <div key={i}
                                className={`text-center rounded-lg p-1.5 cursor-pointer transition-all hover:scale-105 ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                                onClick={() => router.push(`/${locale}/tax/spt-masa`)}
                              >
                                <p className="text-[9px] text-gray-400 mb-1">{label}</p>
                                <div className={`w-full h-6 rounded-md ${statusColors[m.status]} flex items-center justify-center`}>
                                  {m.status === 'PAID' && <CheckCircle className="h-3 w-3 text-white" />}
                                  {m.status === 'OVERDUE' && <AlertTriangle className="h-3 w-3 text-white" />}
                                  {m.status === 'UNPAID' && <Clock className="h-3 w-3 text-gray-500" />}
                                </div>
                                {m.amount > 0 && (
                                  <p className="text-[8px] font-mono text-gray-500 mt-0.5">
                                    {m.amount >= 1e6 ? `${(m.amount / 1e6).toFixed(0)}M` : `${(m.amount / 1e3).toFixed(0)}K`}
                                  </p>
                                )}
                                {m.filingStatus === 'DRAFT' && (
                                  <Badge className="text-[7px] bg-yellow-100 text-yellow-700 px-1 py-0">DRAFT</Badge>
                                )}
                                {(m.filingStatus === 'FILED' || m.filingStatus === 'SUBMITTED') && (
                                  <Badge className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0">SPT</Badge>
                                )}
                                {m.filingStatus === 'ACCEPTED' && (
                                  <Badge className="text-[7px] bg-green-100 text-green-600 px-1 py-0">OK</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> {t('legendPaid')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> {t('legendUnpaid')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> {t('legendOverdue')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> {t('legendPartial')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> {t('legendNoData')}</span>
            <span className="flex items-center gap-1"><Badge className="text-[7px] bg-yellow-100 text-yellow-700 px-1 py-0">DRAFT</Badge> {t('legendDraft')}</span>
            <span className="flex items-center gap-1"><Badge className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0">SPT</Badge> {t('legendFiled')}</span>
            <span className="flex items-center gap-1"><Badge className="text-[7px] bg-green-100 text-green-600 px-1 py-0">OK</Badge> {t('legendAccepted')}</span>
          </div>

          {/* Annual Tax Chart */}
          {payments.length > 0 && (
            <Card className="mt-6 border-0 shadow-sm">
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />{t('chartTitle')} ({year})
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={MONTHS.map((label, i) => {
                    const m = i + 1;
                    const period = `${year}-${String(m).padStart(2, '0')}`;
                    const byType: Record<string, number> = {};
                    for (const p of payments) {
                      if (p.tax_period === period) {
                        byType[p.tax_type] = (byType[p.tax_type] || 0) + (p.amount_due || 0);
                      }
                    }
                    return { month: label, PPh21: byType.PPh21 || 0, PPh23: byType.PPh23 || 0, PPN: byType.PPN || 0, PPh_FINAL: byType.PPh_FINAL || 0 };
                  })}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => fmtRp(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="PPh21" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="PPh23" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="PPN" fill="#f97316" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="PPh_FINAL" fill="#eab308" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
