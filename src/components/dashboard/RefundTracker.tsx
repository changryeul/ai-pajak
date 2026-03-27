'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

export function RefundTracker() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/tax/refund-status').then(r => r.json()).then(d => { if (d.success) setData(d.data); }).catch(() => {});
  }, []);
  if (!data || data.refunds.length === 0) return null;
  const statusColors: Record<string, string> = { SUBMITTED: 'bg-blue-100 text-blue-700', UNDER_REVIEW: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-purple-100 text-purple-700', AWAITING_TRANSFER: 'bg-green-100 text-green-700', COMPLETED: 'bg-gray-100 text-gray-500' };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3"><DollarSign className="h-5 w-5 text-green-600" /><span className="font-semibold text-sm">Tracking Restitusi</span>
          {data.totalPendingRefund > 0 && <Badge className="bg-green-100 text-green-700 ml-auto">Rp {data.totalPendingRefund.toLocaleString('id-ID')}</Badge>}
        </div>
        <div className="space-y-2">
          {data.refunds.slice(0, 3).map((r: { filingId: string; taxType: string; taxYear: number; refundAmount: number; refundStatus: string }) => (
            <div key={r.filingId} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{r.taxType} {r.taxYear}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">Rp {r.refundAmount.toLocaleString('id-ID')}</span>
                <Badge className={`text-[10px] ${statusColors[r.refundStatus] || 'bg-gray-100'}`}>{r.refundStatus}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
