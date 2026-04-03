'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  FileText, Loader2, CheckCircle, AlertTriangle, Plus, Trash2,
  DollarSign, TrendingUp, TrendingDown, Minus, Sparkles,
  ArrowUpRight, ArrowDownLeft, Check, X, Ban,
} from 'lucide-react';

interface Faktur {
  id: string;
  serial_number: string | null;
  transaction_type: 'OUTPUT' | 'INPUT';
  faktur_date: string;
  tax_period: string;
  buyer_name: string;
  buyer_npwp: string;
  seller_name: string;
  seller_npwp: string;
  dpp: number;
  ppn_amount: number;
  ppnbm_amount: number;
  total_amount: number;
  status: string;
  items: Array<{ description: string; quantity: number; unit_price: number; dpp: number; ppn_amount: number }>;
}

interface FakturMonthly {
  id: string;
  faktur_type: string;
  faktur_number: string;
  faktur_date: string;
  counterparty_name: string;
  counterparty_npwp: string;
  dpp: number;
  ppn: number;
  status: string;
}

type TabId = 'faktur' | 'reconciliation';
type FakturFilter = 'ALL' | 'OUTPUT' | 'INPUT';

const PPN_RATE = 0.11;

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

export default function PPNPage() {
  const t = useTranslations();
  const { session } = useSession();
  const params = useParams();
  const locale = params.locale as string;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [activeTab, setActiveTab] = useState<TabId>('faktur');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<FakturFilter>('ALL');

  // Faktur data
  const [fakturs, setFakturs] = useState<FakturMonthly[]>([]);
  const [summary, setSummary] = useState({ outputTax: 0, inputTax: 0, netPpn: 0, status: 'NIHIL', keluaranCount: 0, masukanCount: 0 });

  // Faktur form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    transactionType: 'OUTPUT' as 'OUTPUT' | 'INPUT',
    counterpartyName: '',
    counterpartyNpwp: '',
    fakturDate: new Date().toISOString().slice(0, 10),
    items: [{ description: '', quantity: 1, unitPrice: 0 }] as Array<{ description: string; quantity: number; unitPrice: number }>,
  });

  const period = `${year}-${String(month).padStart(2, '0')}`;

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Load faktur data
  const loadFakturs = useCallback(async () => {
    if (!session?.customerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tax/ppn-faktur-monthly?customerId=${session.customerId}&period=${period}`);
      const data = await res.json();
      if (data.success) {
        setFakturs(data.data.fakturs || []);
        setSummary(data.data.summary || { outputTax: 0, inputTax: 0, netPpn: 0, status: 'NIHIL', keluaranCount: 0, masukanCount: 0 });
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [session?.customerId, period]);

  useEffect(() => { loadFakturs(); }, [loadFakturs]);

  // Calculate form totals
  const formTotals = formData.items.reduce((acc, item) => {
    const dpp = item.quantity * item.unitPrice;
    const ppn = Math.round(dpp * PPN_RATE);
    return { dpp: acc.dpp + dpp, ppn: acc.ppn + ppn };
  }, { dpp: 0, ppn: 0 });

  // Add/remove item rows
  const addItem = () => setFormData({ ...formData, items: [...formData.items, { description: '', quantity: 1, unitPrice: 0 }] });
  const removeItem = (idx: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
  };
  const updateItem = (idx: number, field: string, value: string | number) => {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: value };
    setFormData({ ...formData, items });
  };

  // Save faktur
  const saveFaktur = async () => {
    if (!session?.customerId) return;
    if (!formData.counterpartyName.trim()) {
      showMsg('error', 'Nama lawan transaksi wajib diisi');
      return;
    }
    if (formTotals.dpp <= 0) {
      showMsg('error', 'DPP harus lebih dari 0 — periksa item');
      return;
    }
    if (formData.counterpartyNpwp && formData.counterpartyNpwp.length > 0 && formData.counterpartyNpwp.length < 15) {
      showMsg('error', 'Format NPWP tidak valid');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/tax/ppn-faktur-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: session.customerId,
          taxPeriod: period,
          fakturType: formData.transactionType === 'OUTPUT' ? 'KELUARAN' : 'MASUKAN',
          fakturDate: formData.fakturDate,
          counterpartyName: formData.counterpartyName,
          counterpartyNpwp: formData.counterpartyNpwp,
          dpp: formTotals.dpp,
          ppn: formTotals.ppn,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', 'Faktur saved');
        setShowForm(false);
        setFormData({ transactionType: 'OUTPUT', counterpartyName: '', counterpartyNpwp: '', fakturDate: new Date().toISOString().slice(0, 10), items: [{ description: '', quantity: 1, unitPrice: 0 }] });
        loadFakturs();
      } else {
        showMsg('error', data.error || 'Failed');
      }
    } catch { showMsg('error', 'Error'); }
    finally { setIsSaving(false); }
  };

  const filteredFakturs = filter === 'ALL' ? fakturs : fakturs.filter(f => f.faktur_type === (filter === 'OUTPUT' ? 'KELUARAN' : 'MASUKAN'));

  const netStatus = summary.netPpn > 0 ? 'KURANG_BAYAR' : summary.netPpn < 0 ? 'LEBIH_BAYAR' : 'NIHIL';
  const statusConfig = {
    KURANG_BAYAR: { label: 'Kurang Bayar (납부)', color: 'bg-red-100 text-red-700', icon: TrendingUp },
    LEBIH_BAYAR: { label: 'Lebih Bayar (환급)', color: 'bg-green-100 text-green-700', icon: TrendingDown },
    NIHIL: { label: 'Nihil (0)', color: 'bg-gray-100 text-gray-600', icon: Minus },
  };
  const currentStatus = statusConfig[netStatus];

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: 'faktur', label: 'Faktur 관리', icon: FileText },
    { id: 'reconciliation', label: '월별 정산', icon: DollarSign },
  ];

  if (!session) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600 mb-4" />
        <p className="text-gray-500 text-sm">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-orange-200 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />PPN (Pajak Pertambahan Nilai)
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">e-Faktur & PPN</h1>
          <p className="text-orange-200 mt-2 text-sm">Faktur pajak 관리 및 PPN 월별 정산</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-orange-200 text-xs flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />PPN Keluaran</p>
              <p className="font-bold text-lg">{fmt(summary.outputTax)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-orange-200 text-xs flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />PPN Masukan</p>
              <p className="font-bold text-lg">{fmt(summary.inputTax)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-orange-200 text-xs">Net PPN</p>
              <p className="font-bold text-lg">{fmt(Math.abs(summary.netPpn))}</p>
              <Badge className={`${currentStatus.color} text-[10px] mt-1`}>{currentStatus.label}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Period Selector */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {new Date(2024, i).toLocaleString(locale, { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Faktur Management */}
      {activeTab === 'faktur' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              {(['ALL', 'OUTPUT', 'INPUT'] as FakturFilter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f === 'ALL' ? `All (${fakturs.length})` : f === 'OUTPUT' ? `Keluaran (${fakturs.filter(f => f.faktur_type === 'KELUARAN').length})` : `Masukan (${fakturs.filter(f => f.faktur_type === 'MASUKAN').length})`}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />Faktur Baru
            </Button>
          </div>

          {/* Faktur Form */}
          {showForm && (
            <Card className="mb-4 border-orange-200 shadow-md">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Jenis Faktur</Label>
                    <Select value={formData.transactionType} onValueChange={v => setFormData({ ...formData, transactionType: v as 'OUTPUT' | 'INPUT' })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUTPUT">Keluaran (매출)</SelectItem>
                        <SelectItem value="INPUT">Masukan (매입)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{formData.transactionType === 'OUTPUT' ? 'Pembeli (매수자)' : 'Penjual (매도자)'}</Label>
                    <Input className="h-9" value={formData.counterpartyName} onChange={e => setFormData({ ...formData, counterpartyName: e.target.value })} placeholder="PT ABC" />
                  </div>
                  <div>
                    <Label className="text-xs">NPWP</Label>
                    <Input className="h-9 font-mono" value={formData.counterpartyNpwp} onChange={e => setFormData({ ...formData, counterpartyNpwp: e.target.value })} placeholder="01.234.567.8-901.234" />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-semibold">Item</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
                  </div>
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => {
                      const dpp = item.quantity * item.unitPrice;
                      const ppn = Math.round(dpp * PPN_RATE);
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">Uraian</Label>}
                            <Input className="h-8 text-xs" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Barang/Jasa" />
                          </div>
                          <div className="col-span-1">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">Qty</Label>}
                            <Input className="h-8 text-xs font-mono" type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                          </div>
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">Harga Satuan</Label>}
                            <Input className="h-8 text-xs font-mono" type="number" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', parseInt(e.target.value) || 0)} />
                          </div>
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">DPP</Label>}
                            <div className="h-8 bg-gray-50 rounded px-2 flex items-center text-xs font-mono text-gray-600">{fmt(dpp)}</div>
                          </div>
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">PPN 11%</Label>}
                            <div className="h-8 bg-orange-50 rounded px-2 flex items-center text-xs font-mono text-orange-700">{fmt(ppn)}</div>
                          </div>
                          <div className="col-span-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeItem(idx)} disabled={formData.items.length <= 1}>
                              <Trash2 className="h-3 w-3 text-gray-300" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="mt-3 pt-3 border-t flex justify-end gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Total DPP</p>
                      <p className="font-mono font-bold text-sm">{fmt(formTotals.dpp)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Total PPN</p>
                      <p className="font-mono font-bold text-sm text-orange-600">{fmt(formTotals.ppn)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Grand Total</p>
                      <p className="font-mono font-bold text-sm">{fmt(formTotals.dpp + formTotals.ppn)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3 mr-1" />Batal</Button>
                  <Button size="sm" onClick={saveFaktur} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Simpan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faktur List */}
          {isLoading ? (
            <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
          ) : filteredFakturs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Faktur tidak ditemukan untuk periode ini</p>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2.5 px-3">No. Faktur</th>
                        <th className="text-left py-2.5 px-3">Tanggal</th>
                        <th className="text-center py-2.5 px-3">Jenis</th>
                        <th className="text-left py-2.5 px-3">Lawan Transaksi</th>
                        <th className="text-right py-2.5 px-3">DPP</th>
                        <th className="text-right py-2.5 px-3">PPN</th>
                        <th className="text-center py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredFakturs.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-xs">{f.faktur_number || '—'}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">{f.faktur_date}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge className={`text-[10px] ${f.faktur_type === 'KELUARAN' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {f.faktur_type === 'KELUARAN' ? 'OUT' : 'IN'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-xs">{f.counterparty_name}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs">{fmt(f.dpp)}</td>
                          <td className="py-2 px-3 text-right font-mono text-xs font-medium text-orange-600">{fmt(f.ppn)}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100"><ArrowUpRight className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">PPN Keluaran (매출세)</p>
                    <p className="text-xl font-bold">{fmt(summary.outputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.keluaranCount} faktur</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100"><ArrowDownLeft className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">PPN Masukan (매입세)</p>
                    <p className="text-xl font-bold">{fmt(summary.inputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.masukanCount} faktur</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${netStatus === 'KURANG_BAYAR' ? 'bg-red-100' : netStatus === 'LEBIH_BAYAR' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {(() => { const Icon = currentStatus.icon; return <Icon className="h-5 w-5" />; })()}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net PPN</p>
                    <p className="text-xl font-bold">{fmt(Math.abs(summary.netPpn))}</p>
                    <Badge className={`${currentStatus.color} text-[10px]`}>{currentStatus.label}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Keluaran */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />Faktur Keluaran (매출)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">Pembeli</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Masukan */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />Faktur Masukan (매입)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">Penjual</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">SPT Masa PPN 신고 기한: 매월 말일</p>
              <p>PPN Keluaran - PPN Masukan = 납부세액. Kurang Bayar 시 e-Billing으로 납부 후 신고합니다.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
