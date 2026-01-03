import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, FileUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '@/types/dashboard.types';

interface RecentActivityTimelineProps {
  /** Array of activity items to display in timeline */
  activities: ActivityItem[];
}

/** Icon mapping for each activity type */
const activityIcons = {
  status_change: Clock,
  document_upload: FileUp,
  approved: CheckCircle,
  rejected: XCircle,
};

/** Color mapping for each activity type */
const activityColors = {
  status_change: 'text-blue-500',
  document_upload: 'text-purple-500',
  approved: 'text-green-500',
  rejected: 'text-destructive',
};

export function RecentActivityTimeline({ activities }: RecentActivityTimelineProps) {
  const { t, i18n } = useTranslation('dashboard');

  /**
   * Formats a date string into a relative date label
   * @param dateString - ISO date string
   * @returns "Today", "Yesterday", or localized date (e.g., "Jan 3")
   */
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('recentActivity.today');
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return t('recentActivity.yesterday');
    }
    return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
  }

  /**
   * Formats a date string into a time string
   * @param dateString - ISO date string
   * @returns Localized time (e.g., "2:30 PM")
   */
  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Group activities by date
  const groupedActivities = activities.reduce(
    (groups, activity) => {
      const dateKey = formatDate(activity.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
      return groups;
    },
    {} as Record<string, ActivityItem[]>
  );

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            {t('recentActivity.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('recentActivity.noActivity')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          {t('recentActivity.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedActivities).map(([date, items]) => (
          <div key={date}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{date}</h4>
            <div className="space-y-2 border-l-2 border-muted pl-4">
              {items.map((activity) => {
                const Icon = activityIcons[activity.action];
                return (
                  <div key={activity.id} className="relative flex items-start gap-3 pb-2">
                    <div
                      className={cn(
                        'absolute -left-[21px] p-1 bg-background rounded-full',
                        activityColors[activity.action]
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.customerName}</span>{' '}
                        <span className="text-muted-foreground">{activity.details}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
