'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface QueueItem {
  id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  payment_verified_at: string | null;
  ebilling_code: string | null;
}

const TAX_TYPES = ['PPh21', 'PPh23', 'PPN', 'PPh25'] as const;
type TaxType = typeof TAX_TYPES[number];

// Display label per bucket. PPh23 bucket aggregates PPh4(2)/22/23/26/15,
// PPh25 bucket aggregates PPh25 + PPh Final UMKM. Labels reflect the
// real composition so users don't think a row covers only one tax.
const TAX_TYPE_LABEL: Record<TaxType, string> = {
  PPh21: 'PPh 21',
  PPh23: 'PPh 4(2) / 22 / 23 etc',
  PPN: 'PPN',
  PPh25: 'PPh 25 / Final',
};

// Filing deadline: 20th of following month for income/withholding taxes
// PPN: last day of following month
const getPayDeadline = (year: number, month: number, taxType: string): Date => {
  const nextMonth = month === 12 ? 1 : month + 1;
  const y = month === 12 ? year + 1 : year;
  if (taxType === 'PPN') {
    return new Date(y, nextMonth, 0); // last day of next month
  }
  return new Date(y, nextMonth - 1, 15);
};

const getFileDeadline = (year: number, month: number, taxType: string): Date => {
  const nextMonth = month === 12 ? 1 : month + 1;
  const y = month === 12 ? year + 1 : year;
  if (taxType === 'PPN') {
    return new Date(y, nextMonth, 0);
  }
  return new Date(y, nextMonth - 1, 20);
};

// Coretax era: 납부 = 신고 — COMPLETED 가 곧 납부이자 신고 완료.
const FILED_STATUSES = ['COMPLETED'];
const PAID_STATUSES = ['COMPLETED'];

export default function FilingStatusPage() {
  const t = useTranslations('filingStatus');
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/queue');
      const data = await res.json();
      const fetched = data?.data?.items;
      if (data?.success && Array.isArray(fetched)) setItems(fetched);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && session?.customerId) loadItems();
  }, [sessionLoading, session?.customerId, loadItems]);

  if (sessionLoading || loading) {
    return (
      <div className="container mx-auto py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
      </div>
    );
  }

  // Aggregate by period+tax_type
  interface Row {
    taxType: TaxType;
    amount: number;
    paidAmount: number;
    filed: boolean;
  }

  const buildRowsForMonth = (year: number, month: number): Row[] => {
    const safeItems = Array.isArray(items) ? items : [];
    return TAX_TYPES.map((taxType) => {
      const monthItems = safeItems.filter(
        (i) =>
          i.tax_period_year === year &&
          i.tax_period_month === month &&
          matchesTaxType(i.tax_type, taxType),
      );
      const amount = monthItems.reduce((s, i) => s + (i.amount || 0), 0);
      const paidAmount = monthItems
        .filter((i) => PAID_STATUSES.includes(i.status))
        .reduce((s, i) => s + (i.amount || 0), 0);
      const filed = monthItems.length > 0 && monthItems.every((i) => FILED_STATUSES.includes(i.status));
      return { taxType, amount, paidAmount, filed };
    });
  };

  // Show last 3 months (current + 2 previous)
  const now = new Date();
  const targetMonths = [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const today = new Date();

  const getDday = (deadline: Date): string => {
    const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return t('ddayPast');
    if (diff === 0) return t('ddayToday');
    return t('ddayFuture', { days: diff });
  };

  const getStatus = (row: Row, payDate: Date, fileDate: Date) => {
    if (row.filed) return { label: t('statusDone'), color: 'text-green-600' };
    if (row.amount === 0) return { label: t('statusNone'), color: 'text-slate-400' };
    if (row.paidAmount === 0 && today > payDate)
      return { label: t('statusPaymentLate'), color: 'text-red-600' };
    if (row.paidAmount > 0 && !row.filed && today > fileDate)
      return { label: t('statusFilingLate'), color: 'text-red-600' };
    if (row.paidAmount > 0) return { label: t('statusInProgress'), color: 'text-amber-600' };
    return { label: t('statusTodo'), color: 'text-slate-600' };
  };

  const getActionRoute = (taxType: TaxType): string => {
    const routes: Record<TaxType, string> = {
      PPh21: `/${locale}/tax/pph21`,
      PPh23: `/${locale}/tax/pph23`,
      PPN: `/${locale}/tax/ppn`,
      PPh25: `/${locale}/tax/umkm`,
    };
    return routes[taxType];
  };

  const fmtPeriod = (year: number, month: number) => {
    return t('periodLabel', { year, month });
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 py-8 px-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('pageSubtitle')}</p>
      </div>

      {targetMonths.map(({ year, month }, idx) => {
        const rows = buildRowsForMonth(year, month);
        const isCurrent = idx === 0;

        return (
          <Card key={`${year}-${month}`}>
            <CardContent className="space-y-4 p-6">
              <p className="font-semibold">{fmtPeriod(year, month)}</p>

              <div className="overflow-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">{t('colTaxType')}</th>
                      <th className="p-2 text-right">{t('colTotalTax')}</th>
                      <th className="p-2 text-left">{t('colPayment')}</th>
                      <th className="p-2 text-left">{t('colFiling')}</th>
                      <th className="p-2 text-left">{t('colStatus')}</th>
                      <th className="p-2 text-left">{t('colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const payDate = getPayDeadline(year, month, row.taxType);
                      const fileDate = getFileDeadline(year, month, row.taxType);
                      const status = getStatus(row, payDate, fileDate);
                      const monthDisplay = payDate.getMonth() + 1;

                      return (
                        <tr key={row.taxType} className="border-t">
                          <td className="p-2 font-medium">{TAX_TYPE_LABEL[row.taxType]}</td>
                          <td className="p-2 text-right font-mono">{fmtRp(row.amount)}</td>
                          <td className="p-2">
                            <div className="text-xs">{fmtRp(row.paidAmount)}</div>
                            <div className="text-[10px] text-slate-500">
                              {t('deadlineFormat', {
                                month: monthDisplay,
                                day: payDate.getDate(),
                                dday: getDday(payDate),
                              })}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-xs">{row.filed ? t('filingDone') : t('filingNone')}</div>
                            <div className="text-[10px] text-slate-500">
                              {t('deadlineFormat', {
                                month: fileDate.getMonth() + 1,
                                day: fileDate.getDate(),
                                dday: getDday(fileDate),
                              })}
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                          </td>
                          <td className="p-2">
                            {!row.filed && isCurrent ? (
                              <Button size="sm" onClick={() => router.push(getActionRoute(row.taxType))}>
                                {t('actionProcess')}
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Match queue item tax_type (e.g., 'PPh21', 'PPh_FINAL', 'PPN') to bucket
function matchesTaxType(itemType: string, bucket: TaxType): boolean {
  if (!itemType) return false;
  if (bucket === 'PPh21') return itemType === 'PPh21';
  if (bucket === 'PPh23')
    return ['PPh23', 'PPh26', 'PPh22', 'PPh15', 'PPh_FINAL', 'PPh4_2'].some((t) => itemType.includes(t));
  if (bucket === 'PPN') return itemType.includes('PPN');
  if (bucket === 'PPh25') return itemType === 'PPh25' || itemType === 'PPh_FINAL_UMKM';
  return false;
}
