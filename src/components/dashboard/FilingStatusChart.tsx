'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PieChartIcon } from 'lucide-react';

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  UNDER_REVIEW: '#f59e0b',
  FILED: '#10b981',
  REJECTED: '#ef4444',
};

interface FilingStatusChartProps {
  customerId?: string;
  consultantId?: string;
}

export function FilingStatusChart({ customerId, consultantId }: FilingStatusChartProps) {
  const t = useTranslations();
  const [data, setData] = useState<StatusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        if (customerId) params.append('customerId', customerId);
        if (consultantId) params.append('consultantId', consultantId);

        const res = await fetch(`/api/tax/filings?${params}`);
        const result = await res.json();

        const filings = result.data || result.filings || [];
        const statusCounts: Record<string, number> = {};
        filings.forEach((f: { status: string }) => {
          statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
        });

        setData(Object.entries(statusCounts).map(([status, count]) => ({
          name: t(`filings.status.${status.toLowerCase()}`),
          value: count,
          color: STATUS_COLORS[status] || '#6b7280',
        })));
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [customerId, consultantId, t]);

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('chart.filingStatus')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={data as any}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={PieChartIcon} titleKey="chart.noData" />
        )}
      </CardContent>
    </Card>
  );
}
