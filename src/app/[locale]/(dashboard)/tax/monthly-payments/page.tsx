'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  Calendar, CreditCard, AlertTriangle, CheckCircle, Clock,
  Loader2, DollarSign, FileText, TrendingUp,
} from 'lucide-react';

interface Payment {
  id: string;
  tax_type: string;
  tax_period: string;
  amount_due: number;
  amount_paid: number;
  kode_billing?: string;
  ntpn?: string;
  payment_date?: string;
  status: string;
  payment_deadline: string;
  reporting_deadline: string;
  spt_masa_filed: boolean;
  bpe_number?: string;
}

interface TypeSummary {
  taxType: string;
  totalMonths: number;
  paidMonths: number;
  overdueMonths: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  payments: Payment[];
}

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  PAID: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  UNPAID: { color: 'bg-gray-100 text-gray-600', icon: Clock },
  OVERDUE: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  PARTIAL: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

const taxTypeLabels: Record<string, { label: string; gradient: string }> = {
  PPh21: { label: 'PPh 21', gradient: 'from-blue-500 to-indigo-600' },
  PPh23: { label: 'PPh 23', gradient: 'from-green-500 to-emerald-600' },
  PPh25: { label: 'PPh 25', gradient: 'from-purple-500 to-violet-600' },
  PPN: { label: 'PPN', gradient: 'from-orange-500 to-red-500' },
  PPh_FINAL: { label: 'PPh Final', gradient: 'from-amber-500 to-yellow-600' },
};

export default function MonthlyPaymentsPage() {
  const t = useTranslations();
  const { session } = useSession();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<TypeSummary[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [ntpnInput, setNtpnInput] = useState('');

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ year: year.toString() });
      if (session?.customerId) params.append('customerId', session.customerId);
      const res = await fetch(`/api/tax/monthly-payments?${params}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.data.summary);
        setTotalOutstanding(data.data.totalOutstanding);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [year, session?.customerId]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const markPaid = async (paymentId: string) => {
    await fetch('/api/tax/monthly-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-payment',
        paymentId,
        ntpn: ntpnInput || undefined,
        amountPaid: summary.flatMap(s => s.payments).find(p => p.id === paymentId)?.amount_due,
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
    });
    setEditingPayment(null);
    setNtpnInput('');
    loadPayments();
  };

  const generateSchedule = async () => {
    if (!session?.customerId) return;
    await fetch('/api/tax/monthly-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate-schedule',
        customerId: session.customerId,
        year,
        taxTypes: ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL'],
      }),
    });
    loadPayments();
  };

  const activeSummary = selectedType ? summary.filter(s => s.taxType === selectedType) : summary.filter(s => s.totalMonths > 0);
  const totalPaid = summary.reduce((s, t) => s + t.totalPaid, 0);
  const totalDue = summary.reduce((s, t) => s + t.totalDue, 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            {t('pages.monthlyPayments') || 'Pembayaran Pajak Bulanan'}
          </h1>
          <p className="text-gray-500 mt-1">{t('pages.monthlyPaymentsDesc') || 'Tracking pembayaran PPh & PPN bulanan'}</p>
        </div>
        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{t('pages.totalDue') || 'Total Terutang'}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalDue)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600"><DollarSign className="h-5 w-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{t('pages.totalPaidAmount') || 'Total Dibayar'}</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalPaid)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600"><CheckCircle className="h-5 w-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{t('pages.outstanding') || 'Belum Dibayar'}</p>
                <p className={`text-2xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-red-700' : 'text-gray-400'}`}>{fmt(totalOutstanding)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600"><AlertTriangle className="h-5 w-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Type Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setSelectedType(null)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!selectedType ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {t('common.all')}
        </button>
        {Object.entries(taxTypeLabels).map(([key, val]) => (
          <button key={key} onClick={() => setSelectedType(selectedType === key ? null : key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedType === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {val.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
      ) : activeSummary.every(s => s.totalMonths === 0) ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">{t('pages.noPaymentSchedule') || 'Belum ada jadwal pembayaran untuk tahun ini'}</p>
            <Button onClick={generateSchedule} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <Calendar className="h-4 w-4 mr-2" />{t('pages.generateSchedule') || 'Buat Jadwal Pembayaran'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeSummary.filter(s => s.totalMonths > 0).map(typeSummary => {
            const info = taxTypeLabels[typeSummary.taxType] || { label: typeSummary.taxType, gradient: 'from-gray-500 to-gray-600' };
            const progress = typeSummary.totalDue > 0 ? (typeSummary.totalPaid / typeSummary.totalDue) * 100 : 0;

            return (
              <Card key={typeSummary.taxType} className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${info.gradient}`}>
                        <FileText className="h-3.5 w-3.5 text-white" />
                      </div>
                      {info.label}
                      <Badge variant="outline">{typeSummary.paidMonths}/{typeSummary.totalMonths}</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="w-24 h-2" />
                      <span className="text-xs text-gray-500">{progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                    {typeSummary.payments.map(payment => {
                      const month = parseInt(payment.tax_period.split('-')[1]);
                      const sc = statusConfig[payment.status] || statusConfig.UNPAID;
                      const Icon = sc.icon;
                      const isEditing = editingPayment === payment.id;

                      return (
                        <div key={payment.id} className="relative">
                          <button
                            onClick={() => setEditingPayment(isEditing ? null : payment.id)}
                            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-all hover:shadow-md ${sc.color} ${payment.status === 'OVERDUE' ? 'ring-2 ring-red-300' : ''}`}
                          >
                            <Icon className="h-3.5 w-3.5 mb-0.5" />
                            <span className="font-medium">{month}月</span>
                            {payment.amount_due > 0 && (
                              <span className="text-[9px] opacity-75">{(payment.amount_due / 1000000).toFixed(0)}M</span>
                            )}
                          </button>

                          {isEditing && payment.status !== 'PAID' && (
                            <div className="absolute top-full left-0 z-10 mt-1 w-48 bg-white rounded-xl shadow-xl border p-3 space-y-2">
                              <p className="text-xs font-medium">{info.label} - {payment.tax_period}</p>
                              <p className="text-xs text-gray-500">Due: {fmt(payment.amount_due)}</p>
                              <p className="text-xs text-gray-500">Deadline: {payment.payment_deadline}</p>
                              <div>
                                <Label className="text-[10px]">NTPN</Label>
                                <Input className="text-xs h-7" placeholder="16 digit" value={ntpnInput} onChange={e => setNtpnInput(e.target.value)} />
                              </div>
                              <Button size="sm" className="w-full text-xs h-7" onClick={() => markPaid(payment.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" />Tandai Lunas
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
