'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface MonthlyData {
  month: string;
  income: number;
  tax: number;
}

interface TaxSummaryChartProps {
  customerId?: string;
  consultantId?: string;
}

export function TaxSummaryChart({ customerId, consultantId }: TaxSummaryChartProps) {
  const t = useTranslations();
  const [data, setData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ type: 'tax_summary' });
        if (customerId) params.append('customerId', customerId);
        if (consultantId) params.append('consultantId', consultantId);

        const res = await fetch(`/api/reports?${params}`);
        const result = await res.json();

        if (result.success && result.data?.monthlyBreakdown) {
          setData(result.data.monthlyBreakdown);
        } else {
          // Fallback: generate placeholder for current year
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const now = new Date();
          setData(months.slice(0, now.getMonth() + 1).map((m) => ({
            month: m,
            income: 0,
            tax: 0,
          })));
        }
      } catch {
        // Silent fail — chart just shows empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [customerId, consultantId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatRupiah = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('chart.taxSummary')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 && data.some((d) => d.income > 0 || d.tax > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatRupiah} tick={{ fontSize: 12 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, '']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="income" name={t('chart.income')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tax" name={t('chart.taxPaid')} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            {t('chart.noData')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
