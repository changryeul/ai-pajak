'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, BarChart3, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle, Lightbulb, FileText, ArrowRight, Sparkles, DollarSign,
} from 'lucide-react';
import { cn, fmtRp } from '@/lib/utils';

interface TaxSummary {
  taxType: string;
  transactionCount: number;
  totalGross: number;
  totalTax: number;
  prevMonthTax: number;
  changePercent: number;
  filingStatus: string;
  paymentStatus: string;
  bpeNumber: string | null;
}

interface Alert {
  type: string;
  severity: string;
  message: string;
}

interface SavingsOpportunity {
  category: string;
  description: string;
  potentialSavings: number;
}

interface ReportData {
  period: string;
  customer: { name: string; npwp: string };
  summary: TaxSummary[];
  totals: { totalGross: number; totalTax: number; totalSavings: number };
  alerts: Alert[];
  savingsOpportunities: SavingsOpportunity[];
  generatedAt: string;
}


const TAX_GRADIENTS: Record<string, string> = {
  PPh21: 'from-blue-500 to-indigo-600',
  PPh23: 'from-emerald-500 to-green-600',
  PPh_FINAL: 'from-amber-500 to-yellow-600',
  PPN: 'from-orange-500 to-red-500',
};


const FILING_STATUS_COLORS: Record<string, string> = {
  NOT_FILED: 'bg-gray-200 text-gray-600',
  DRAFT: 'bg-yellow-100 text-yellow-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  FILED: 'bg-blue-100 text-blue-700',
};

const FILING_STATUS_KEYS: Record<string, string> = {
  NOT_FILED: 'monthlyReport.notFiled',
  DRAFT: 'monthlyReport.draft',
  SUBMITTED: 'monthlyReport.submitted',
  ACCEPTED: 'monthlyReport.accepted',
  FILED: 'monthlyReport.filed',
};

export default function MonthlyReportPage() {
  const t = useTranslations('killer');
  const tm = useTranslations('monthlyReport');
  const TAX_LABELS: Record<string, string> = {
    PPh21: tm('taxLabelPph21'),
    PPh23: tm('taxLabelPph23'),
    PPh_FINAL: tm('taxLabelPphFinal'),
    PPN: tm('taxLabelPpn'),
  };
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const locale = params.locale as string;

  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState(defaultPeriod);
  const [report, setReport] = useState<ReportData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadReport = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch(`/api/customer/monthly-report?period=${period}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.success) setReport(data.data);
    } catch (err) { console.error(err); }
    finally { setDataLoading(false); }
  }, [session, period]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-800 via-purple-700 to-indigo-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-violet-300 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />{t('monthlyReport.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('monthlyReport.title')}</h1>
          <p className="text-violet-300 mt-2 text-sm">{t('monthlyReport.subtitle')}</p>

          {report && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-violet-300 text-xs">{t('monthlyReport.totalTax')}</p>
                <p className="font-bold text-lg">{fmtRp(report.totals.totalTax)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-violet-300 text-xs flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-yellow-300" />{t('monthlyReport.savingsOpportunity')}
                </p>
                <p className="font-bold text-lg text-yellow-300">
                  {report.totals.totalSavings > 0 ? fmtRp(report.totals.totalSavings) : '-'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-violet-300 text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-300" />{t('monthlyReport.alerts')}
                </p>
                <p className="font-bold text-lg text-red-300">{tm('count', { n: report.alerts.length })}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex justify-between items-center mb-6">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodOptions.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
      ) : report ? (
        <div className="space-y-6">
          {/* Alerts */}
          {report.alerts.length > 0 && (
            <div className="space-y-2">
              {report.alerts.map((alert, i) => (
                <div key={i} className={cn(
                  'p-3 rounded-xl text-sm flex items-center gap-2',
                  alert.severity === 'HIGH' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
                )}>
                  <AlertTriangle className={cn('h-4 w-4 flex-shrink-0', alert.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')} />
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {/* Tax Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.summary.filter(s => s.transactionCount > 0 || s.totalTax > 0).map(s => {
              const filingColor = FILING_STATUS_COLORS[s.filingStatus] || FILING_STATUS_COLORS.NOT_FILED;
              const filingKey = FILING_STATUS_KEYS[s.filingStatus] || FILING_STATUS_KEYS.NOT_FILED;
              return (
                <Card key={s.taxType} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className={`h-1.5 bg-gradient-to-r ${TAX_GRADIENTS[s.taxType] || 'from-gray-400 to-gray-500'}`} />
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{TAX_LABELS[s.taxType] || s.taxType}</h3>
                        <Badge className={cn('text-[10px]', filingColor)}>{t(filingKey)}</Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-gray-400">{t('monthlyReport.transactions')}</p>
                          <p className="font-bold text-sm">{tm('count', { n: s.transactionCount })}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">{t('monthlyReport.totalRevenue')}</p>
                          <p className="font-bold text-sm">{fmtRp(s.totalGross)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">{t('monthlyReport.tax')}</p>
                          <p className="font-bold text-sm">{fmtRp(s.totalTax)}</p>
                        </div>
                      </div>

                      {/* Month-over-month change */}
                      {s.prevMonthTax > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          {s.changePercent > 0 ? (
                            <TrendingUp className="h-3 w-3 text-red-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-green-500" />
                          )}
                          <span className={s.changePercent > 0 ? 'text-red-600' : 'text-green-600'}>
                            {t('monthlyReport.vsLastMonth')} {s.changePercent > 0 ? '+' : ''}{s.changePercent}%
                          </span>
                          <span className="text-gray-400">({fmtRp(s.prevMonthTax)})</span>
                        </div>
                      )}

                      {s.bpeNumber && (
                        <p className="text-[10px] text-gray-400">
                          BPE: <span className="font-mono">{s.bpeNumber}</span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No transactions */}
          {report.summary.every(s => s.transactionCount === 0) && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">{t('monthlyReport.noData', { period })}</p>
              </CardContent>
            </Card>
          )}

          {/* Savings Opportunities */}
          {report.savingsOpportunities.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-yellow-400">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />{t('monthlyReport.savingsTitle')}
                </h3>
                <div className="space-y-3">
                  {report.savingsOpportunities.map((opp, i) => (
                    <div key={i} className="bg-yellow-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className="text-[10px] bg-yellow-100 text-yellow-700">{opp.category}</Badge>
                        <span className="text-sm font-bold text-yellow-700 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />{fmtRp(opp.potentialSavings)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{opp.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.href = `/${locale}/tax/savings`}
            >
              <Lightbulb className="h-4 w-4 mr-2" />{t('monthlyReport.detailAnalysis')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.href = `/${locale}/submissions`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />{t('monthlyReport.submissionStatus')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <BarChart3 className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{tm('reportLoadFailed')}</p>
        </div>
      )}
    </div>
  );
}
