import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UrgentCase } from '@/types/dashboard.types';

interface UrgentCasesPanelProps {
  /** Array of urgent cases to display */
  cases: UrgentCase[];
  /** Callback when a case is clicked */
  onCaseClick?: (caseId: string) => void;
}

/**
 * Determines badge variant based on urgency level
 * @param days - Days until deadline
 * @returns Badge variant: 'destructive' (≤1 day), 'warning' (≤3 days), 'secondary' (>3 days)
 */
function getBadgeVariant(days: number): 'destructive' | 'warning' | 'secondary' {
  if (days <= 1) return 'destructive';
  if (days <= 3) return 'warning';
  return 'secondary';
}

export function UrgentCasesPanel({ cases, onCaseClick }: UrgentCasesPanelProps) {
  const { t } = useTranslation('dashboard');

  /**
   * Formats days until deadline into a human-readable label
   * @param days - Days until deadline (negative = overdue)
   * @returns Formatted label (e.g., "D-3", "Due Today", "2 days overdue")
   */
  function getDaysLabel(days: number): string {
    if (days < 0) return t('urgentCases.overdue', { count: Math.abs(days) });
    if (days === 0) return t('urgentCases.dueToday');
    return `D-${days}`;
  }

  if (cases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            {t('urgentCases.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('urgentCases.noUrgent')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {t('urgentCases.title')}
          <Badge variant="destructive" className="ml-2">
            {t('urgentCases.casesCount', { count: cases.length })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cases.map((urgentCase) => (
          <div
            key={urgentCase.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock
                className={cn(
                  'h-4 w-4',
                  urgentCase.daysUntilDeadline <= 1 ? 'text-destructive' : 'text-orange-500'
                )}
              />
              <div>
                <p className="font-medium text-sm">{urgentCase.customerName}</p>
                <p className="text-xs text-muted-foreground">{urgentCase.taxType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(urgentCase.daysUntilDeadline)}>
                {getDaysLabel(urgentCase.daysUntilDeadline)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCaseClick?.(urgentCase.id)}
                aria-label={t('urgentCases.viewDetails', { name: urgentCase.customerName })}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
