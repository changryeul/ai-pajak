'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock, Loader2,
  DollarSign, FileText, Calendar, ChevronRight, Sparkles,
  TrendingUp, Shield, Receipt,
} from 'lucide-react';

interface Payment {
  id: string; tax_type: string; tax_period: string;
  amount_due: number; amount_paid: number; status: string;
  payment_deadline: string; reporting_deadline: string;
  spt_masa_filed: boolean;
}

interface TypeSummary {
  taxType: string; totalMonths: number; paidMonths: number;
  overdueMonths: number; totalDue: number; totalPaid: number;
  outstanding: number; payments: Payment[];
}

function fmtShort(n: number) {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}K`;
  return `Rp ${n}`;
}
function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

const taxTypeConfig: Record<string, { label: string; gradient: string; icon: typeof FileText; desc: string }> = {
  PPh21: { label: 'PPh 21', gradient: 'from-blue-500 to-indigo-600', icon: FileText, desc: 'Gaji Karyawan' },
  PPh23: { label: 'PPh 23', gradient: 'from-emerald-500 to-green-600', icon: Receipt, desc: 'Jasa & Sewa' },
  PPh25: { label: 'PPh 25', gradient: 'from-purple-500 to-violet-600', icon: TrendingUp, desc: 'Angsuran Bulanan' },
  PPN: { label: 'PPN', gradient: 'from-orange-500 to-red-500', icon: DollarSign, desc: 'Pajak Pertambahan Nilai' },
  PPh_FINAL: { label: 'PPh Final', gradient: 'from-amber-500 to-yellow-600', icon: Shield, desc: 'UMKM 0.5%' },
};

const statusConfig: Record<string, { bg: string; text: string; ring: string }> = {
  PAID: { bg: 'bg-green-500', text: 'text-white', ring: '' },
  UNPAID: { bg: 'bg-gray-200', text: 'text-gray-500', ring: '' },
  OVERDUE: { bg: 'bg-red-500', text: 'text-white', ring: 'ring-2 ring-red-300 ring-offset-1' },
  PARTIAL: { bg: 'bg-yellow-400', text: 'text-yellow-900', ring: '' },
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyPaymentsPage() {
  const t = useTranslations();
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<TypeSummary[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [ntpnInput, setNtpnInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams({ year: year.toString() });
      if (session?.customerId) p.append('customerId', session.customerId);
      const res = await fetch(`/api/tax/monthly-payments?${p}`);
      const data = await res.json();
      if (data.success) { setSummary(data.data.summary); setTotalOutstanding(data.data.totalOutstanding); }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [year, session?.customerId]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const generateSchedule = async () => {
    // For customer role, use session.customerId. For consultants, will need to select a client.
    const cid = session?.customerId;
    if (!cid) {
      alert('Customer ID not available. Please select a client first.');
      return;
    }
    try {
      const res = await fetch('/api/tax/monthly-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-schedule', customerId: cid, year, taxTypes: ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL'] }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to generate schedule');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
    loadPayments();
  };

  const markPaid = async () => {
    if (!selectedPayment) return;
    setIsSaving(true);
    try {
      await fetch('/api/tax/monthly-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-payment', paymentId: selectedPayment.id,
          ntpn: ntpnInput || undefined,
          amountPaid: selectedPayment.amount_due,
          paymentDate: new Date().toISOString().slice(0, 10),
        }),
      });
      setSelectedPayment(null);
      setNtpnInput('');
      loadPayments();
    } catch { /* */ }
    finally { setIsSaving(false); }
  };

  const totalPaid = summary.reduce((s, t) => s + t.totalPaid, 0);
  const totalDue = summary.reduce((s, t) => s + t.totalDue, 0);
  const activeSummary = summary.filter(s => s.totalMonths > 0);
  const hasData = activeSummary.length > 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('pages.monthlyPayments') || 'Pembayaran Pajak Bulanan'}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{year}</h1>
            </div>
            <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="w-[120px] bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasData && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/5 backdrop-blur rounded-xl p-4">
                <p className="text-xs text-slate-400">{t('pages.totalDue') || 'Total Terutang'}</p>
                <p className="text-xl font-bold mt-1">{fmtShort(totalDue)}</p>
              </div>
              <div className="bg-green-500/10 backdrop-blur rounded-xl p-4">
                <p className="text-xs text-green-300">{t('pages.totalPaidAmount') || 'Dibayar'}</p>
                <p className="text-xl font-bold text-green-400 mt-1">{fmtShort(totalPaid)}</p>
              </div>
              <div className={`${totalOutstanding > 0 ? 'bg-red-500/10' : 'bg-white/5'} backdrop-blur rounded-xl p-4`}>
                <p className="text-xs text-slate-400">{t('pages.outstanding') || 'Belum Bayar'}</p>
                <p className={`text-xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {fmtShort(totalOutstanding)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
      ) : !hasData ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Belum Ada Jadwal Pembayaran</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              Buat jadwal pembayaran pajak bulanan untuk tahun {year}
            </p>
            <Button onClick={generateSchedule} size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
              <Sparkles className="h-4 w-4 mr-2" />Buat Jadwal {year}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeSummary.map(ts => {
            const config = taxTypeConfig[ts.taxType] || taxTypeConfig.PPh21;
            const Icon = config.icon;
            const progress = ts.totalDue > 0 ? (ts.totalPaid / ts.totalDue) * 100 : 0;
            const hasDetail = ts.taxType === 'PPh23' || ts.taxType === 'PPN';

            return (
              <Card key={ts.taxType} className="border-0 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-5 pb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{config.label}</h3>
                        <span className="text-xs text-gray-400">{config.desc}</span>
                        {ts.overdueMonths > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{ts.overdueMonths} terlambat</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Progress value={progress} className="flex-1 h-1.5" />
                        <span className="text-xs text-gray-500 font-medium">{ts.paidMonths}/{ts.totalMonths}</span>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-gray-900">{fmtShort(ts.totalDue)}</p>
                      {ts.outstanding > 0 && <p className="text-xs text-red-600">-{fmtShort(ts.outstanding)}</p>}
                    </div>
                  </div>

                  {/* 12-Month Grid */}
                  <div className="px-5 pb-4">
                    <div className="grid grid-cols-12 gap-1.5">
                      {ts.payments.map(payment => {
                        const month = parseInt(payment.tax_period.split('-')[1]);
                        const sc = statusConfig[payment.status] || statusConfig.UNPAID;
                        const isNow = year === currentYear && month === currentMonth;

                        return (
                          <div key={payment.id} className="flex flex-col items-center gap-0.5">
                            <span className={`text-[10px] ${isNow ? 'font-bold text-blue-600' : 'text-gray-400'}`}>{MONTH_LABELS[month - 1]}</span>
                            <button
                              onClick={() => { if (payment.status !== 'PAID') setSelectedPayment(payment); }}
                              className={`w-full aspect-square rounded-lg ${sc.bg} ${sc.ring} flex items-center justify-center transition-all hover:scale-110 ${payment.status !== 'PAID' ? 'cursor-pointer hover:opacity-80' : ''} ${isNow ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                              title={`${config.label} ${payment.tax_period}: ${payment.status} - ${fmt(payment.amount_due)}`}>
                              {payment.status === 'PAID' && <CheckCircle className={`h-3 w-3 ${sc.text}`} />}
                              {payment.status === 'OVERDUE' && <AlertTriangle className={`h-3 w-3 ${sc.text}`} />}
                              {payment.status === 'UNPAID' && month < currentMonth && year <= currentYear && <Clock className="h-3 w-3 text-gray-400" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {hasDetail && (
                    <div className="border-t px-5 py-3 bg-gray-50/50">
                      <Link href={`/${locale}/tax/monthly-payments/detail?type=${ts.taxType}&period=${year}-${String(currentMonth).padStart(2, '0')}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
                        Lihat Detail Transaksi <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasData && (
        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /> Lunas</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-200" /> Belum</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /> Terlambat</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded ring-2 ring-blue-400" /> Bulan Ini</span>
        </div>
      )}

      {/* Payment Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedPayment(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-1">
              {taxTypeConfig[selectedPayment.tax_type]?.label || selectedPayment.tax_type}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{selectedPayment.tax_period}</p>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Jumlah Terutang</span>
                <span className="font-bold">{fmt(selectedPayment.amount_due)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Batas Setor</span>
                <span>{selectedPayment.payment_deadline}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Batas Lapor</span>
                <span>{selectedPayment.reporting_deadline}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${selectedPayment.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-900'}`}>
                  {selectedPayment.status}
                </span>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <label className="text-xs font-medium text-gray-700">NTPN (Nomor Transaksi Penerimaan Negara)</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="16 digit NTPN"
                  value={ntpnInput}
                  onChange={e => setNtpnInput(e.target.value)}
                  maxLength={16}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSelectedPayment(null)}>
                Batal
              </Button>
              <Button className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600" onClick={markPaid} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Tandai Lunas
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
