'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusTimeline } from './StatusTimeline';
import { Receipt, Download, AlertTriangle } from 'lucide-react';
import { cn, fmtRp } from '@/lib/utils';

export interface QueueItem {
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

interface SubmissionCardProps {
  item: QueueItem;
}

const TAX_COLORS: Record<string, string> = {
  PPh21: 'bg-blue-100 text-blue-700',
  PPh23: 'bg-emerald-100 text-emerald-700',
  PPh_FINAL: 'bg-amber-100 text-amber-700',
  PPN: 'bg-orange-100 text-orange-700',
};


export function SubmissionCard({ item }: SubmissionCardProps) {
  const locale = (useParams()?.locale as string) || 'id';
  const t = useTranslations('killer');
  const period = `${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}`;

  return (
    <Card className={cn(
      'border-0 shadow-sm transition-all hover:shadow-md',
      item.status === 'FAILED' && 'border-l-4 border-l-red-500',
      item.status === 'COMPLETED' && 'border-l-4 border-l-green-500',
      item.status === 'PAYMENT_PENDING' && 'border-l-4 border-l-amber-500',
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs font-semibold', TAX_COLORS[item.tax_type] || 'bg-gray-100 text-gray-700')}>
              {item.tax_type}
            </Badge>
            <span className="text-sm text-gray-500">{period}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{fmtRp(item.amount || 0)}</p>
            {item.status === 'FAILED' && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />{t('submissions.failed')}
              </Badge>
            )}
          </div>
        </div>

        {/* Timeline */}
        <StatusTimeline status={item.status} />

        {/* Details */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="space-y-0.5">
            {item.ebilling_code && (
              <p>e-Billing: <span className="font-mono">{item.ebilling_code}</span></p>
            )}
            {item.bpe_number && (
              <p>BPE: <span className="font-mono">{item.bpe_number}</span></p>
            )}
          </div>

          <div className="flex gap-2">
            {item.status === 'PAYMENT_PENDING' && (
              <Button size="sm" variant="default" className="h-7 text-xs" asChild>
                <Link href={`/${locale}/tax/billing`}>
                  <Receipt className="h-3 w-3 mr-1" />{t('submissions.viewBilling')}
                </Link>
              </Button>
            )}
            {item.bpe_number && (
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />BPE
              </Button>
            )}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded p-2">{item.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
