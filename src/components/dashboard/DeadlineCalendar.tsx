'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface Deadline {
  taxType: string;
  period: string;
  dueDate: string;
  daysUntilDue: number;
  status: 'completed' | 'upcoming' | 'urgent' | 'overdue';
}

interface DeadlineCalendarProps {
  customerId?: string;
  consultantId?: string;
  showAll?: boolean;
}

// Indonesian tax deadlines (fixed dates)
const TAX_DEADLINES = {
  PPh21: 10, // 10th of following month
  PPh23: 10, // 10th of following month
  PPN: 31, // End of following month
  PPh_FINAL: 15, // 15th of following month
};

export function DeadlineCalendar({ showAll = false }: DeadlineCalendarProps) {
  const t = useTranslations();

  // Calculate deadlines using useMemo instead of useEffect
  const deadlines = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Generate next 3 months of deadlines
    const upcomingDeadlines: Deadline[] = [];

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const targetMonth = (currentMonth + monthOffset) % 12;
      const targetYear = currentYear + Math.floor((currentMonth + monthOffset) / 12);
      const periodMonth = (targetMonth === 0 ? 11 : targetMonth - 1);
      const periodYear = targetMonth === 0 ? targetYear - 1 : targetYear;
      const periodStr = `${periodYear}-${String(periodMonth + 1).padStart(2, '0')}`;

      Object.entries(TAX_DEADLINES).forEach(([taxType, dayOfMonth]) => {
        const dueDate = new Date(targetYear, targetMonth, dayOfMonth);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let status: Deadline['status'] = 'upcoming';
        if (daysUntilDue < 0) {
          status = 'overdue';
        } else if (daysUntilDue <= 7) {
          status = 'urgent';
        } else if (daysUntilDue <= 0) {
          status = 'completed';
        }

        upcomingDeadlines.push({
          taxType,
          period: periodStr,
          dueDate: dueDate.toISOString().split('T')[0],
          daysUntilDue,
          status,
        });
      });
    }

    // Sort by due date and filter
    const sortedDeadlines = upcomingDeadlines
      .filter(d => d.daysUntilDue >= -7) // Show up to 7 days overdue
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return showAll ? sortedDeadlines : sortedDeadlines.slice(0, 6);
  }, [showAll]);

  const getStatusIcon = (status: Deadline['status']) => {
    switch (status) {
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'urgent':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'upcoming':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDaysUntilDue = (days: number): string => {
    if (days < 0) {
      return `${Math.abs(days)} days overdue`;
    } else if (days === 0) {
      return 'Due today';
    } else if (days === 1) {
      return 'Due tomorrow';
    } else {
      return `${days} days left`;
    }
  };

  const urgentCount = deadlines.filter(d => d.status === 'urgent' || d.status === 'overdue').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">
            {t('dashboard.upcomingDeadlines') || 'Tax Deadlines'}
          </CardTitle>
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {urgentCount} urgent
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No upcoming deadlines</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deadlines.map((deadline, index) => (
              <div
                key={`${deadline.taxType}-${deadline.period}-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  deadline.status === 'overdue'
                    ? 'bg-red-50 border-red-200'
                    : deadline.status === 'urgent'
                    ? 'bg-orange-50 border-orange-200'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(deadline.status)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {deadline.taxType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Period: {deadline.period}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${
                    deadline.status === 'overdue' ? 'text-red-600' :
                    deadline.status === 'urgent' ? 'text-orange-600' :
                    'text-gray-600'
                  }`}>
                    {formatDaysUntilDue(deadline.daysUntilDue)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(deadline.dueDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
