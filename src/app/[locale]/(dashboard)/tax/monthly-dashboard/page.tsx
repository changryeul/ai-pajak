'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  Loader2, CheckCircle, AlertTriangle, Clock, FileText,
  Receipt, DollarSign, Shield, TrendingUp, ArrowRight,
  Sparkles, Calendar, BarChart3,
} from 'lucide-react';

interface MonthlyStatus {
  taxType: string;
  period: string;
  transactionCount: number;
  totalTax: number;
  bupotGenerated: number;
  bupotPending: number;
  sptMasaFiled: boolean;
  paymentStatus: string; // UNPAID, PAID, OVERDUE
  paymentDeadline: string;
  reportingDeadline: string;
}

const TAX_TYPES = [
  { key: 'PPh21', label: 'PPh 21', icon: FileText, gradient: 'from-blue-500 to-indigo-600', desc: '근로소득세' },
  { key: 'PPh23', label: 'PPh 23', icon: Receipt, gradient: 'from-emerald-500 to-green-600', desc: '원천징수세' },
  { key: 'PPh_FINAL', label: 'PPh 4(2)', icon: Shield, gradient: 'from-amber-500 to-yellow-600', desc: 'Final Tax' },
  { key: 'PPN', label: 'PPN', icon: DollarSign, gradient: 'from-orange-500 to-red-500', desc: '부가가치세' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number) {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}K`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function MonthlyDashboardPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Array<{ tax_type: string; tax_period: string; status: string; amount_due: number; spt_masa_filed: boolean; payment_deadline: string; reporting_deadline: string }>>([]);

  const loadData = useCallback(async () => {
    if (!session?.customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/monthly-payments?year=${year}&customerId=${session.customerId}`);
      const data = await res.json();
      if (data.success) {
        // Flatten all payments from all tax types
        const allPayments: typeof payments = [];
        for (const summary of (data.data?.summary || [])) {
          for (const p of (summary.payments || [])) {
            allPayments.push(p);
          }
        }
        setPayments(allPayments);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [session?.customerId, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build month × tax type grid
  const getStatus = (taxType: string, month: number): { status: string; amount: number; sptFiled: boolean } => {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const p = payments.find(p => p.tax_type === taxType && p.tax_period === period);
    return {
      status: p?.status || (month <= currentMonth && year === currentYear ? 'NONE' : 'FUTURE'),
      amount: p?.amount_due || 0,
      sptFiled: p?.spt_masa_filed || false,
    };
  };

  const statusColors: Record<string, string> = {
    PAID: 'bg-green-500',
    UNPAID: 'bg-gray-300',
    OVERDUE: 'bg-red-500',
    PARTIAL: 'bg-yellow-400',
    NONE: 'bg-gray-100',
    FUTURE: 'bg-gray-50',
  };

  // Summary stats
  const totalDue = payments.reduce((s, p) => s + (p.amount_due || 0), 0);
  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const overdueCount = payments.filter(p => p.status === 'OVERDUE').length;
  const pendingCount = payments.filter(p => p.status === 'UNPAID').length;
  const sptFiledCount = payments.filter(p => p.spt_masa_filed).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />Monthly Tax Dashboard
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">월 신고 대시보드</h1>
          <p className="text-slate-400 mt-2 text-sm">납부, 신고, e-Bupot 현황을 한눈에 확인합니다</p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs">총 납부 예정</p>
              <p className="font-bold text-lg">{fmt(totalDue)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-400" />납부 완료</p>
              <p className="font-bold text-lg">{paidCount}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />연체</p>
              <p className="font-bold text-lg text-red-400">{overdueCount}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1"><FileText className="h-3 w-3 text-blue-400" />SPT 신고</p>
              <p className="font-bold text-lg">{sptFiledCount}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex justify-between items-center mb-6">
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`/${locale}/tax/spt-masa`)}>
            <Receipt className="h-3 w-3 mr-1" />SPT Masa
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`/${locale}/tax/ppn`)}>
            <DollarSign className="h-3 w-3 mr-1" />e-Faktur
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" /></div>
      ) : (
        <>
          {/* Monthly Grid per Tax Type */}
          <div className="space-y-4">
            {TAX_TYPES.map(tax => {
              const Icon = tax.icon;
              const monthlyAmounts = MONTHS.map((_, i) => getStatus(tax.key, i + 1));
              const yearTotal = monthlyAmounts.reduce((s, m) => s + m.amount, 0);

              return (
                <Card key={tax.key} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      {/* Tax type label */}
                      <div className={`w-36 bg-gradient-to-br ${tax.gradient} p-4 flex flex-col justify-center text-white`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="font-bold text-sm">{tax.label}</span>
                        </div>
                        <p className="text-[10px] opacity-75">{tax.desc}</p>
                        <p className="font-mono text-xs mt-2 opacity-90">{fmt(yearTotal)}</p>
                      </div>

                      {/* Month grid */}
                      <div className="flex-1 p-3">
                        <div className="grid grid-cols-12 gap-1.5">
                          {MONTHS.map((label, i) => {
                            const m = monthlyAmounts[i];
                            const isCurrent = i + 1 === currentMonth && year === currentYear;

                            return (
                              <div key={i}
                                className={`text-center rounded-lg p-1.5 cursor-pointer transition-all hover:scale-105 ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                                onClick={() => router.push(`/${locale}/tax/spt-masa`)}
                              >
                                <p className="text-[9px] text-gray-400 mb-1">{label}</p>
                                <div className={`w-full h-6 rounded-md ${statusColors[m.status]} flex items-center justify-center`}>
                                  {m.status === 'PAID' && <CheckCircle className="h-3 w-3 text-white" />}
                                  {m.status === 'OVERDUE' && <AlertTriangle className="h-3 w-3 text-white" />}
                                  {m.status === 'UNPAID' && <Clock className="h-3 w-3 text-gray-500" />}
                                </div>
                                {m.amount > 0 && (
                                  <p className="text-[8px] font-mono text-gray-500 mt-0.5">
                                    {m.amount >= 1e6 ? `${(m.amount / 1e6).toFixed(0)}M` : `${(m.amount / 1e3).toFixed(0)}K`}
                                  </p>
                                )}
                                {m.sptFiled && (
                                  <Badge className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0">SPT</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 납부 완료</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> 미납</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> 연체</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> 부분납부</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> 데이터 없음</span>
            <span className="flex items-center gap-1"><Badge className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0">SPT</Badge> 신고 완료</span>
          </div>
        </>
      )}
    </div>
  );
}
