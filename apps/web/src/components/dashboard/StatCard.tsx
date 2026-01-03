import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the StatCard component
 */
export interface StatCardProps {
  /** Card title displayed in the header */
  title: string;
  /** Main value displayed prominently */
  value: number | string;
  /** Lucide icon to display in the header */
  icon: LucideIcon;
  /** Optional description text below the value */
  description?: string;
  /**
   * Optional trend indicator showing week-over-week change.
   * Reserved for future API integration when real-time stats are available.
   * @example { value: 12, isPositive: true } // Shows "↑ 12% from last week"
   */
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Visual variant: 'default', 'urgent' (red), or 'success' (green) */
  variant?: 'default' | 'urgent' | 'success';
  /** Additional CSS classes */
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        variant === 'urgent' && 'border-destructive/50 bg-destructive/5',
        variant === 'success' && 'border-green-500/50 bg-green-50 dark:bg-green-950/20',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon
          className={cn(
            'h-4 w-4',
            variant === 'urgent' && 'text-destructive',
            variant === 'success' && 'text-green-600',
            variant === 'default' && 'text-muted-foreground'
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <p
            className={cn('text-xs mt-1', trend.isPositive ? 'text-green-600' : 'text-destructive')}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
          </p>
        )}
      </CardContent>
    </Card>
  );
}
