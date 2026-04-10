'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Clock,
  FileSignature,
  FileX,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface UrgentAction {
  id: string;
  type: 'OVERDUE_FILING' | 'PENDING_POA' | 'EXPIRING_POA' | 'REJECTED_FILING' | 'URGENT_DEADLINE';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  actionUrl: string;
  dueDate?: string;
  daysUntilDue?: number;
}

interface UrgentActionsPanelProps {
  consultantId?: string;
  limit?: number;
}

export function UrgentActionsPanel({ consultantId, limit = 5 }: UrgentActionsPanelProps) {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [actions, setActions] = useState<UrgentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUrgentActions = useCallback(async () => {
    if (!consultantId) return;

    setIsLoading(true);
    try {
      // Fetch overdue filings
      const filingsResponse = await fetch(
        `/api/tax/filings?consultantId=${consultantId}&status=DRAFT&limit=20`
      );
      const filingsData = await filingsResponse.json();

      // Fetch POAs needing attention
      const poaResponse = await fetch(
        `/api/poa?consultantId=${consultantId}&needsAction=true&limit=10`
      );
      const poaData = await poaResponse.json();

      const urgentActions: UrgentAction[] = [];

      // Process overdue filings
      if (filingsData.success && filingsData.data) {
        const today = new Date();

        filingsData.data.forEach((filing: {
          id: string;
          customer_id: string;
          customer?: { full_name?: string; company_name?: string };
          tax_type: string;
          tax_period: string;
        }) => {
          // Calculate if filing is near deadline (Coretax / PMK 81/2024):
          // - All PPh payments: 15th of following month
          // - PPN payment: 15th of following month (filing = end of month, but this
          //   uses the payment deadline for urgency calculation)
          if (!filing.tax_period || !filing.tax_period.includes('-')) return;
          const [year, month] = filing.tax_period.split('-').map(Number);
          const deadlineDay = filing.tax_type === 'PPN_FILING' ? 31 : 15;

          const deadline = new Date(year, month, deadlineDay);
          const daysUntilDue = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilDue <= 7) {
            urgentActions.push({
              id: `filing-${filing.id}`,
              type: daysUntilDue < 0 ? 'OVERDUE_FILING' : 'URGENT_DEADLINE',
              priority: daysUntilDue < 0 ? 'high' : daysUntilDue <= 3 ? 'high' : 'medium',
              title: `${filing.tax_type} - ${filing.tax_period}`,
              description: daysUntilDue < 0
                ? `Overdue by ${Math.abs(daysUntilDue)} days`
                : `Due in ${daysUntilDue} days`,
              customerId: filing.customer_id,
              customerName: filing.customer?.company_name || filing.customer?.full_name || 'Unknown',
              actionUrl: `/${locale}/tax/${filing.tax_type.toLowerCase()}?filingId=${filing.id}`,
              dueDate: deadline.toISOString().split('T')[0],
              daysUntilDue,
            });
          }
        });
      }

      // Process POAs needing signature
      if (poaData.success && poaData.data) {
        poaData.data.forEach((poa: {
          id: string;
          poa_number: string;
          status: string;
          customer_id: string;
          customer?: { full_name?: string; company_name?: string };
          valid_to: string;
        }) => {
          if (poa.status === 'PENDING_SIGNATURE') {
            urgentActions.push({
              id: `poa-sign-${poa.id}`,
              type: 'PENDING_POA',
              priority: 'medium',
              title: `POA Pending Signature`,
              description: `${poa.poa_number} awaiting advisor signature`,
              customerId: poa.customer_id,
              customerName: poa.customer?.company_name || poa.customer?.full_name || 'Unknown',
              actionUrl: `/${locale}/poa/${poa.id}`,
            });
          }

          // Check for expiring POAs
          const expiryDate = new Date(poa.valid_to);
          const today = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && poa.status === 'ACTIVE') {
            urgentActions.push({
              id: `poa-expire-${poa.id}`,
              type: 'EXPIRING_POA',
              priority: daysUntilExpiry <= 7 ? 'high' : 'low',
              title: `POA Expiring Soon`,
              description: `${poa.poa_number} expires in ${daysUntilExpiry} days`,
              customerId: poa.customer_id,
              customerName: poa.customer?.company_name || poa.customer?.full_name || 'Unknown',
              actionUrl: `/${locale}/poa/${poa.id}`,
              dueDate: poa.valid_to,
              daysUntilDue: daysUntilExpiry,
            });
          }
        });
      }

      // Sort by priority and limit
      const sortedActions = urgentActions
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, limit);

      setActions(sortedActions);
    } catch (error) {
      console.error('Failed to fetch urgent actions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [consultantId, limit, locale]);

  useEffect(() => {
    fetchUrgentActions();
  }, [fetchUrgentActions]);

  const getActionIcon = (type: UrgentAction['type']) => {
    switch (type) {
      case 'OVERDUE_FILING':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'URGENT_DEADLINE':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'PENDING_POA':
        return <FileSignature className="h-5 w-5 text-blue-600" />;
      case 'EXPIRING_POA':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'REJECTED_FILING':
        return <FileX className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPriorityBadge = (priority: UrgentAction['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'medium':
        return <Badge className="bg-orange-100 text-orange-800">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  const highPriorityCount = actions.filter(a => a.priority === 'high').length;

  return (
    <Card className={highPriorityCount > 0 ? 'border-red-200' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">
            {t('dashboard.urgentActions') || 'Urgent Actions'}
          </CardTitle>
          {highPriorityCount > 0 && (
            <Badge variant="destructive">{highPriorityCount} critical</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">All caught up!</p>
            <p className="text-sm text-gray-500">No urgent actions needed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  action.priority === 'high'
                    ? 'bg-red-50 border-red-200 hover:bg-red-100'
                    : action.priority === 'medium'
                    ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
                onClick={() => router.push(action.actionUrl)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getActionIcon(action.type)}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{action.title}</p>
                      {getPriorityBadge(action.priority)}
                    </div>
                    <p className="text-sm text-gray-600">{action.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{action.customerName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
