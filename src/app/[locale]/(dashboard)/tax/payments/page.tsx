'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Clock,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Receipt,
  Info,
} from 'lucide-react';

interface QueueItem {
  id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  ebilling_code: string | null;
  bpe_number: string | null;
  bpe_date: string | null;
  payment_proof_url: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  payment_verified_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueData {
  customer: { id: string; name: string; npwp: string };
  items: QueueItem[];
  summary: {
    total: number;
    paymentPending: number;
    completed: number;
    inProgress: number;
  };
}

export default function PaymentsPage() {
  const t = useTranslations('payment');
  const [data, setData] = useState<QueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/queue');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
      PENDING: { label: t('statusPending'), color: 'text-gray-700', bg: 'bg-gray-100', icon: Clock },
      DATA_REVIEW: { label: t('statusInReview'), color: 'text-blue-700', bg: 'bg-blue-100', icon: FileText },
      PENDING_APPROVAL: { label: t('statusPendingApproval'), color: 'text-orange-700', bg: 'bg-orange-100', icon: Clock },
      APPROVED: { label: t('statusApproved'), color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle },
      EBILLING_GENERATED: { label: t('statusEbilling'), color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Receipt },
      PAYMENT_PENDING: { label: t('statusPaymentNeeded'), color: 'text-red-700', bg: 'bg-red-100', icon: AlertCircle },
      COMPLETED: { label: t('statusCompleted'), color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
      FAILED: { label: t('statusFailed'), color: 'text-red-700', bg: 'bg-red-100', icon: AlertCircle },
    };
    return configs[status] || configs.PENDING;
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-500">{t('loading')}</span>
      </div>
    );
  }

  // Sort: PAYMENT_PENDING first, then by date
  const sortedItems = [...data.items].sort((a, b) => {
    if (a.status === 'PAYMENT_PENDING' && b.status !== 'PAYMENT_PENDING') return -1;
    if (b.status === 'PAYMENT_PENDING' && a.status !== 'PAYMENT_PENDING') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-200 text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {t('pageTitle')}
            </p>
            <h1 className="text-2xl font-bold mt-1">{t('pageSubtitle')}</h1>
          </div>
          <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('totalItems')}</p>
            <p className="text-2xl font-bold">{data.summary.total}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-red-200">{t('needsPayment')}</p>
            <p className="text-2xl font-bold">{data.summary.paymentPending}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-200">{t('inProgressLabel')}</p>
            <p className="text-2xl font-bold">{data.summary.inProgress}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-200">{t('completed')}</p>
            <p className="text-2xl font-bold">{data.summary.completed}</p>
          </div>
        </div>
      </div>

      {/* Action needed alert */}
      {data.summary.paymentPending > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            {t('actionNeeded', { count: data.summary.paymentPending })}
          </p>
        </div>
      )}

      {/* Items list */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
          <p>{t('noItems')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map(item => {
            const config = getStatusConfig(item.status);
            const StatusIcon = config.icon;
            const isExpanded = expandedId === item.id;
            const isPaymentPending = item.status === 'PAYMENT_PENDING';

            return (
              <Card key={item.id} className={`overflow-hidden ${isPaymentPending ? 'ring-2 ring-red-200' : ''}`}>
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}>
                        <StatusIcon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {item.tax_type} — {item.tax_period_year}/{String(item.tax_period_month).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Rp {item.amount.toLocaleString('id-ID')}
                          {item.ebilling_code && <span className="ml-2 font-mono text-gray-400">e-Billing: {item.ebilling_code}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${config.bg} ${config.color}`}>{config.label}</Badge>
                      {isPaymentPending && (
                        <Badge className="bg-red-500 text-white animate-pulse">{t('uploadNow')}</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 bg-gray-50 space-y-4">
                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">{t('taxType')}</p>
                        <p className="font-medium">{item.tax_type}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">{t('period')}</p>
                        <p className="font-medium">{item.tax_period_year}/{String(item.tax_period_month).padStart(2, '0')}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">{t('amount')}</p>
                        <p className="font-medium">Rp {item.amount.toLocaleString('id-ID')}</p>
                      </div>
                      {item.ebilling_code && (
                        <div>
                          <p className="text-gray-400 text-xs">e-Billing</p>
                          <p className="font-mono font-medium text-indigo-600">{item.ebilling_code}</p>
                        </div>
                      )}
                      {item.bpe_number && (
                        <div>
                          <p className="text-gray-400 text-xs">BPE</p>
                          <p className="font-mono font-medium text-green-600">{item.bpe_number}</p>
                        </div>
                      )}
                    </div>

                    {/* Coretax: 납부 = 신고. ID Billing 납부 안내 (PAYMENT_PENDING) */}
                    {isPaymentPending && (
                      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          {t('coretaxPayTitle')}
                        </h3>
                        <p className="text-sm text-blue-700 leading-relaxed">
                          {t('coretaxPayDesc')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
