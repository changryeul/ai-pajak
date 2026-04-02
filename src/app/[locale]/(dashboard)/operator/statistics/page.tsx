'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquareWarning,
  Loader2,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';

interface OperatorStat {
  operator_id: string;
  operator_name: string;
  employee_id: string;
  status: string;
  completed: number;
  failed: number;
  total: number;
  success_rate_pct: number;
  avg_processing_time_hours: number;
  complaint_count: number;
  reassignment_count: number;
  rank: number;
}

interface StatisticsData {
  period: string;
  startDate: string;
  endDate: string;
  operators: OperatorStat[];
  totals: {
    completed: number;
    failed: number;
    total: number;
    complaint_count: number;
    avg_processing_time_hours: number;
  };
}

type SortKey = 'rank' | 'completed' | 'failed' | 'success_rate_pct' | 'avg_processing_time_hours' | 'complaint_count';

export default function StatisticsPage() {
  const t = useTranslations('operator');
  const [data, setData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/operator/statistics?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  };

  const sortedOperators = data?.operators
    ? [...data.operators].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      })
    : [];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-100 text-yellow-700">🥇 1</Badge>;
    if (rank === 2) return <Badge className="bg-gray-100 text-gray-600">🥈 2</Badge>;
    if (rank === 3) return <Badge className="bg-orange-100 text-orange-700">🥉 3</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-emerald-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-500">{t('loadingData')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-200 text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('statisticsTitle')}
            </p>
            <h1 className="text-2xl font-bold mt-1">{t('statisticsSubtitle')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 bg-white/10 border-white/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('periodDaily')}</SelectItem>
                <SelectItem value="weekly">{t('periodWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('periodMonthly')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('totalCompleted')}</p>
            <p className="text-2xl font-bold">{data.totals.completed}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('totalFailed')}</p>
            <p className="text-2xl font-bold">{data.totals.failed}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('avgProcessingTime')}</p>
            <p className="text-2xl font-bold">{data.totals.avg_processing_time_hours}h</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('complaintCount')}</p>
            <p className="text-2xl font-bold">{data.totals.complaint_count}</p>
          </div>
        </div>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t('rank')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedOperators.length === 0 ? (
            <p className="text-center py-8 text-gray-400">{t('noStatistics')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('rank')}>
                      <span className="flex items-center gap-1">{t('rank')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-left">{t('operatorName')}</th>
                    <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('completed')}>
                      <span className="flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> {t('totalCompleted')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('failed')}>
                      <span className="flex items-center justify-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> {t('totalFailed')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('success_rate_pct')}>
                      <span className="flex items-center justify-center gap-1">{t('successRate')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('avg_processing_time_hours')}>
                      <span className="flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> {t('avgProcessingTime')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('complaint_count')}>
                      <span className="flex items-center justify-center gap-1"><MessageSquareWarning className="h-3 w-3" /> {t('complaintCount')} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="p-3 text-center">{t('reassignmentCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOperators.map(op => (
                    <tr key={op.operator_id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{getRankBadge(op.rank)}</td>
                      <td className="p-3">
                        <p className="font-medium">{op.operator_name}</p>
                        <p className="text-xs text-gray-400">{op.employee_id}</p>
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-600">{op.completed}</td>
                      <td className="p-3 text-center font-semibold text-red-500">{op.failed}</td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${getSuccessRateColor(op.success_rate_pct)}`}>
                          {op.success_rate_pct}%
                        </span>
                      </td>
                      <td className="p-3 text-center text-gray-600">
                        {op.avg_processing_time_hours}h
                      </td>
                      <td className="p-3 text-center">
                        {op.complaint_count > 0 ? (
                          <Badge className="bg-red-100 text-red-700">{op.complaint_count}</Badge>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-gray-500">{op.reassignment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
