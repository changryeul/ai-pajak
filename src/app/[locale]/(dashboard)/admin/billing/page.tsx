'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard, DollarSign, TrendingUp, Users, Loader2,
  RefreshCw, BarChart3, Receipt, ArrowUpRight,
} from 'lucide-react';

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

export default function AdminBillingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [overview, setOverview] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/billing?view=overview');
        const data = await res.json();
        if (data.success) setOverview(data.data);
      } else {
        const res = await fetch('/api/admin/billing?view=transactions');
        const data = await res.json();
        if (data.success) setTransactions(data.data.transactions);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const processRefund = async (txId: string) => {
    const res = await fetch('/api/admin/billing', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund', transactionId: txId }),
    });
    const data = await res.json();
    setMessage(data.message);
    setTimeout(() => setMessage(null), 3000);
    loadData();
  };

  const statusColors: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
    REFUNDED: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-orange-200 text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Admin</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Billing & Revenue</h1>
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">{message}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { id: 'transactions' as const, label: 'Transaksi', icon: Receipt },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
      ) : activeTab === 'overview' && overview ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Revenue', value: fmt(overview.overview.totalRevenue), icon: DollarSign, gradient: 'from-green-500 to-emerald-600' },
              { label: 'MRR', value: fmt(overview.overview.mrr), icon: TrendingUp, gradient: 'from-blue-500 to-indigo-600' },
              { label: 'ARPU', value: fmt(overview.overview.arpu), icon: Users, gradient: 'from-purple-500 to-violet-600' },
              { label: 'Active Subs', value: overview.overview.activeSubscriptions.toString(), icon: CreditCard, gradient: 'from-amber-500 to-orange-500' },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <Card key={i} className="border-0 shadow-sm group hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{kpi.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} group-hover:scale-110 transition-transform`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Transaction Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Status Transaksi</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-700">{overview.overview.paidCount}</p>
                  <p className="text-xs text-gray-500">Paid</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-xl">
                  <p className="text-2xl font-bold text-yellow-700">{overview.overview.pendingCount}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-700">{overview.overview.failedCount}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-xl">
                  <p className="text-2xl font-bold text-orange-700">{fmt(overview.overview.pendingAmount)}</p>
                  <p className="text-xs text-gray-500">Pending Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Distribusi Plan</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {Object.entries(overview.overview.planDistribution || {}).map(([plan, count]) => (
                  <div key={plan} className="flex-1 text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{count as number}</p>
                    <p className="text-xs text-gray-500 capitalize">{plan}</p>
                  </div>
                ))}
                {Object.keys(overview.overview.planDistribution || {}).length === 0 && (
                  <p className="text-gray-400 text-sm">Belum ada data subscription</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue Chart (simple) */}
          {overview.monthlyRevenue.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Revenue Bulanan</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-40">
                  {overview.monthlyRevenue.map((m: { month: string; amount: number }, i: number) => {
                    const maxAmount = Math.max(...overview.monthlyRevenue.map((x: { amount: number }) => x.amount));
                    const height = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-md transition-all" style={{ height: `${height}%`, minHeight: '4px' }} />
                        <span className="text-[8px] text-gray-400">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : activeTab === 'transactions' ? (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Riwayat Transaksi ({transactions.length})</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center py-10 text-gray-400">Belum ada transaksi</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 text-xs">
                      <th className="text-left py-2 px-2">Customer</th>
                      <th className="text-left py-2 px-2">Deskripsi</th>
                      <th className="text-right py-2 px-2">Jumlah</th>
                      <th className="text-center py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Tanggal</th>
                      <th className="text-center py-2 px-2">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((tx: { id: string; customerName: string; customerEmail: string; description: string; amount: number; status: string; created_at: string }) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <p className="font-medium text-xs">{tx.customerName || '-'}</p>
                          <p className="text-[10px] text-gray-400">{tx.customerEmail}</p>
                        </td>
                        <td className="py-2 px-2 text-xs">{tx.description || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{fmt(tx.amount)}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge className={`text-[10px] ${statusColors[tx.status] || 'bg-gray-100'}`}>{tx.status}</Badge>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-2 text-center">
                          {tx.status === 'PAID' && (
                            <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => processRefund(tx.id)}>
                              <RefreshCw className="h-3 w-3 mr-0.5" />Refund
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
