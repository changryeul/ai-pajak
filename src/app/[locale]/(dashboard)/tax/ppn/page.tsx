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
  Upload, Camera, Shield, Image, RefreshCw,
} from 'lucide-react';
import { useRef } from 'react';

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
  const t = useTranslations('ppnPage');
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
      showMsg('error', t('validationCounterpartyRequired'));
      return;
    }
    if (formTotals.dpp <= 0) {
      showMsg('error', t('validationDppPositive'));
      return;
    }
    if (formData.counterpartyNpwp && formData.counterpartyNpwp.length > 0 && formData.counterpartyNpwp.length < 15) {
      showMsg('error', t('validationNpwpInvalid'));
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
        showMsg('success', t('fakturSaved'));
        setShowForm(false);
        setFormData({ transactionType: 'OUTPUT', counterpartyName: '', counterpartyNpwp: '', fakturDate: new Date().toISOString().slice(0, 10), items: [{ description: '', quantity: 1, unitPrice: 0 }] });
        loadFakturs();
      } else {
        showMsg('error', data.error || t('errorSave'));
      }
    } catch { showMsg('error', t('errorGeneral')); }
    finally { setIsSaving(false); }
  };

  const filteredFakturs = filter === 'ALL' ? fakturs : fakturs.filter(f => f.faktur_type === (filter === 'OUTPUT' ? 'KELUARAN' : 'MASUKAN'));

  const netStatus = summary.netPpn > 0 ? 'KURANG_BAYAR' : summary.netPpn < 0 ? 'LEBIH_BAYAR' : 'NIHIL';
  const statusConfig = {
    KURANG_BAYAR: { label: t('statusKurangBayar'), color: 'bg-red-100 text-red-700', icon: TrendingUp },
    LEBIH_BAYAR: { label: t('statusLebihBayar'), color: 'bg-green-100 text-green-700', icon: TrendingDown },
    NIHIL: { label: t('statusNihil'), color: 'bg-gray-100 text-gray-600', icon: Minus },
  };
  const currentStatus = statusConfig[netStatus];

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: 'faktur', label: t('tabFaktur'), icon: FileText },
    { id: 'reconciliation', label: t('tabReconciliation'), icon: DollarSign },
  ];

  if (!session) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600 mb-4" />
        <p className="text-gray-500 text-sm">{t('loadingSession')}</p>
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
          <p className="text-orange-200 mt-2 text-sm">{t('subtitle')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-orange-200 text-xs flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{t('ppnKeluaran')}</p>
              <p className="font-bold text-lg">{fmt(summary.outputTax)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-orange-200 text-xs flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{t('ppnMasukan')}</p>
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
                  {f === 'ALL' ? t('filterAll') + ' (' + fakturs.length + ')' : f === 'OUTPUT' ? t('filterKeluaran') + ' (' + fakturs.filter(x => x.faktur_type === 'KELUARAN').length + ')' : t('filterMasukan') + ' (' + fakturs.filter(x => x.faktur_type === 'MASUKAN').length + ')'}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />{t('newFaktur')}
            </Button>
          </div>

          {/* Faktur Form */}
          {showForm && (
            <Card className="mb-4 border-orange-200 shadow-md">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{t('fakturType')}</Label>
                    <Select value={formData.transactionType} onValueChange={v => setFormData({ ...formData, transactionType: v as 'OUTPUT' | 'INPUT' })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUTPUT">{t('typeKeluaran')}</SelectItem>
                        <SelectItem value="INPUT">{t('typeMasukan')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{formData.transactionType === 'OUTPUT' ? t('buyerLabel') : t('sellerLabel')}</Label>
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
                    <Label className="text-xs font-semibold">{t('itemLabel')}</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t('addItem')}</Button>
                  </div>
                  <div className="space-y-2 overflow-x-auto">
                    {formData.items.map((item, idx) => {
                      const dpp = item.quantity * item.unitPrice;
                      const ppn = Math.round(dpp * PPN_RATE);
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end min-w-[600px]">
                          <div className="col-span-4">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">{t('uraian')}</Label>}
                            <Input className="h-8 text-xs" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Barang/Jasa" />
                          </div>
                          <div className="col-span-1">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">Qty</Label>}
                            <Input className="h-8 text-xs font-mono" type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                          </div>
                          <div className="col-span-2">
                            {idx === 0 && <Label className="text-[10px] text-gray-400">{t('unitPrice')}</Label>}
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
                      <p className="text-[10px] text-gray-400">{t('totalDpp')}</p>
                      <p className="font-mono font-bold text-sm">{fmt(formTotals.dpp)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">{t('totalPpn')}</p>
                      <p className="font-mono font-bold text-sm text-orange-600">{fmt(formTotals.ppn)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">{t('grandTotal')}</p>
                      <p className="font-mono font-bold text-sm">{fmt(formTotals.dpp + formTotals.ppn)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3 mr-1" />{t('cancel')}</Button>
                  <Button size="sm" onClick={saveFaktur} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}{t('save')}
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
              <p className="text-sm">{t('noFaktur')}</p>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2.5 px-3">{t('thFakturNo')}</th>
                        <th className="text-left py-2.5 px-3">{t('thDate')}</th>
                        <th className="text-center py-2.5 px-3">{t('thType')}</th>
                        <th className="text-left py-2.5 px-3">{t('thCounterparty')}</th>
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
                    <p className="text-xs text-gray-500">{t('ppnKeluaran')}</p>
                    <p className="text-xl font-bold">{fmt(summary.outputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.keluaranCount} {t('fakturCount')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100"><ArrowDownLeft className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-xs text-gray-500">{t('ppnMasukan')}</p>
                    <p className="text-xl font-bold">{fmt(summary.inputTax)}</p>
                    <p className="text-[10px] text-gray-400">{summary.masukanCount} {t('fakturCount')}</p>
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
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />{t('fakturKeluaran')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">{t('buyerHeader')}</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'KELUARAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">{t('noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Masukan */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />{t('fakturMasukan')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-gray-400"><th className="py-2 px-3 text-left">{t('sellerHeader')}</th><th className="py-2 px-3 text-right">DPP</th><th className="py-2 px-3 text-right">PPN</th></tr></thead>
                  <tbody className="divide-y">
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{f.counterparty_name}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(f.dpp)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-orange-600">{fmt(f.ppn)}</td>
                      </tr>
                    ))}
                    {fakturs.filter(f => f.faktur_type === 'MASUKAN').length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-300">{t('noData')}</td></tr>
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
              <p className="font-medium">{t('infoTitle')}</p>
              <p>{t('infoDesc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload + Filing Process */}
      <PPNFilingSection
        customerId={session?.customerId || ''}
        period={period}
        summary={summary}
        fakturCount={fakturs.length}
        locale={locale}
      />

      {/* PPN Refund Section */}
      <PPNRefundSection locale={locale} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PPN Filing Process (증빙 + SPT Masa + 납부 프로그래스)
// ══════════════════════════════════════════════════════
function PPNFilingSection({
  customerId, period, summary, fakturCount, locale,
}: {
  customerId: string;
  period: string;
  summary: { outputTax: number; inputTax: number; netPpn: number; status: string };
  fakturCount: number;
  locale: string;
}) {
  const t = useTranslations('ppnPage');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string; file_name: string; ocr_status: string;
    ocr_result?: { extractedData?: Record<string, unknown>; confidence?: number };
  }>>([]);
  const [creatingSPT, setCreatingSPT] = useState(false);
  const [sptResult, setSptResult] = useState<{
    totalGrossIncome: number; totalTaxWithheld: number; itemCount: number;
    submissionDeadline: string; isOverdue: boolean;
  } | null>(null);

  // Load docs
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/documents?customerId=${customerId}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUploadedDocs((d.data || []).slice(0, 10)); })
      .catch(() => {});
  }, [customerId, period]);

  // Check existing SPT Masa PPN
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/tax/filings?customerId=${customerId}&taxType=PPN&period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const filings = d?.data || [];
        const existing = filings.find((f: { tax_type: string; tax_period: string }) =>
          f.tax_type === 'PPN' && f.tax_period === period);
        if (existing?.tax_data?.spt_masa_result) {
          const r = existing.tax_data.spt_masa_result;
          setSptResult({
            totalGrossIncome: r.total_gross_income || 0,
            totalTaxWithheld: r.total_tax_withheld || 0,
            itemCount: r.item_count || 0,
            submissionDeadline: r.submission_deadline || '',
            isOverdue: false,
          });
        }
      })
      .catch(() => {});
  }, [customerId, period]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !customerId) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('customerId', customerId);
      fd.append('documentType', 'FAKTUR_PAJAK');
      fd.append('uploadSource', 'WEB');
      try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          count++;
          if (data.data?.id) fetch(`/api/documents/${data.data.id}/ocr`, { method: 'POST' }).catch(() => {});
        }
      } catch { /* */ }
    }
    if (count > 0) {
      setTimeout(() => {
        fetch(`/api/documents?customerId=${customerId}&period=${period}`)
          .then(r => r.json())
          .then(d => { if (d.success) setUploadedDocs((d.data || []).slice(0, 10)); })
          .catch(() => {});
      }, 2000);
    }
    setUploading(false);
  };

  const handleCreateSPT = async () => {
    setCreatingSPT(true);
    try {
      const res = await fetch('/api/tax/spt-masa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, taxType: 'PPN', period }),
      });
      const data = await res.json();
      if (data.success || data.sptMasa) {
        const spt = data.sptMasa;
        if (spt) {
          setSptResult({
            totalGrossIncome: spt.totalGrossIncome || 0,
            totalTaxWithheld: spt.totalTaxWithheld || 0,
            itemCount: spt.itemCount || 0,
            submissionDeadline: spt.submissionDeadline || '',
            isOverdue: spt.isOverdue || false,
          });
        }
      }
    } catch { /* */ }
    finally { setCreatingSPT(false); }
  };

  const sptCreated = !!sptResult;
  const netPpn = summary.netPpn;
  const isLebihBayar = netPpn < 0;

  const steps = [
    { id: 1, label: 'Faktur ' + t('k0_7bb79c'), done: fakturCount > 0, desc: t('fakturCount', { count: fakturCount }) },
    { id: 2, label: t('k1_32a33a'), done: uploadedDocs.length > 0, desc: t('fakturCount', { count: uploadedDocs.length }) },
    { id: 3, label: 'SPT Masa PPN', done: sptCreated, desc: sptCreated ? t('k2_b93104') : t('k3_ac6176') },
    { id: 4, label: t('k4_b303e6'), done: false, desc: netPpn > 0 ? fmt(netPpn) : netPpn < 0 ? t('overpaid') : 'NIHIL' },
    { id: 5, label: 'DJP ' + t('k6_d6ed72'), done: false, desc: t('afterPayment') },
  ];

  return (
    <div className="mt-6 space-y-4">
      {/* Document upload section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-orange-600" />
              Faktur Pajak {t('k8_c219cc')} ({uploadedDocs.length}{t('k9_bcbcd4')}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                Faktur {t('k10_a45c31')}
              </Button>
              <Button size="sm" variant="outline" disabled={uploading}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
                  input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files);
                  input.click();
                }}>
                <Camera className="h-3 w-3 mr-1" />{t('k11_8383f9')}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" multiple
                onChange={e => handleUpload(e.target.files)} />
            </div>
          </div>
          {uploadedDocs.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 border-2 border-dashed rounded-lg">
              <Image className="h-6 w-6 mx-auto mb-1 opacity-30" />
              <p>{t('uploadHint')}</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {uploadedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-1.5 rounded border text-xs">
                  <Badge className={
                    doc.ocr_status === 'COMPLETED' ? 'text-[8px] bg-green-100 text-green-700' :
                    doc.ocr_status === 'PROCESSING' ? 'text-[8px] bg-blue-100 text-blue-700' :
                    'text-[8px] bg-gray-100 text-gray-600'
                  }>
                    {doc.ocr_status === 'COMPLETED' ? 'OCR' + t('k13_4f8e30') : doc.ocr_status === 'PROCESSING' ? t('k14_95d1e4') : t('k15_65905a')}
                  </Badge>
                  <span className="truncate">{doc.file_name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filing progress */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-600" />
            {period} PPN {t('k16_aa38cd')}
          </h3>

          <div className="flex items-center justify-between mb-6">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step.done ? <CheckCircle className="h-4 w-4" /> : step.id}
                  </div>
                  <p className="text-[10px] mt-1 text-center font-medium">{step.label}</p>
                  <p className="text-[9px] text-gray-400 text-center">{step.desc}</p>
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-full ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {/* SPT Masa PPN action */}
            {fakturCount > 0 && !sptCreated && (
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <div className="text-xs">
                    <p className="font-medium text-orange-900">SPT Masa PPN {t('k17_b0b7b5')}</p>
                    <p className="text-orange-700">
                      PPN Keluaran: {fmt(summary.outputTax)} — PPN Masukan: {fmt(summary.inputTax)} —
                      Selisih: <b>{fmt(Math.abs(netPpn))}</b> ({netPpn > 0 ? 'Kurang Bayar' : netPpn < 0 ? 'Lebih Bayar' : 'Nihil'})
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleCreateSPT} disabled={creatingSPT}>
                  {creatingSPT ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                  SPT Masa {t('k18_4169bb')}
                </Button>
              </div>
            )}

            {/* SPT Masa PPN done */}
            {sptCreated && sptResult && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-xs font-medium text-green-900">SPT Masa PPN {t('k18_4169bb')} {t('k13_4f8e30')}</p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><p className="text-gray-500">PPN Keluaran</p><p className="font-mono font-bold">{fmt(summary.outputTax)}</p></div>
                  <div><p className="text-gray-500">PPN Masukan</p><p className="font-mono font-bold">{fmt(summary.inputTax)}</p></div>
                  <div>
                    <p className="text-gray-500">Selisih</p>
                    <p className={`font-mono font-bold ${netPpn > 0 ? 'text-red-700' : netPpn < 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                      {fmt(Math.abs(netPpn))} {netPpn > 0 ? '(' + t('k4_b303e6') + ')' : netPpn < 0 ? '(' + t('k21_d003cd') : '(NIHIL)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('k22_df2337')}</p>
                    <p>{sptResult.submissionDeadline?.substring(0, 10)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment / Lebih Bayar notice */}
            {sptCreated && netPpn > 0 && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                  <div className="text-xs">
                    <p className="font-medium text-indigo-900">{t('ppnPayment', { amount: fmt(netPpn) })}</p>
                    <p className="text-indigo-700">{t('billingNote')}</p>
                  </div>
                </div>
                <a href={`/${locale}/tax/monthly-payments`}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                  {t('k24_d76082')}
                </a>
              </div>
            )}

            {sptCreated && isLebihBayar && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium">PPN {t('k25_7fd5d5')}: {fmt(Math.abs(netPpn))}</p>
                  <p>{t('k26_a4897c')} — {t('k27_f960de')}</p>
                </div>
              </div>
            )}

            {sptCreated && netPpn === 0 && (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-gray-400" />
                <span>PPN NIHIL — {t('k28_c33073')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PPN 환급 신청 (Restitusi PPN)
// ══════════════════════════════════════════════════════
function PPNRefundSection({ locale }: { locale: string }) {
  const [showRefund, setShowRefund] = useState(false);
  const t = useTranslations('ppnPage');
  const [refundStep, setRefundStep] = useState(1);
  const [agreedFees, setAgreedFees] = useState(false);
  const [agreedAudit, setAgreedAudit] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundPeriod, setRefundPeriod] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const operatingCost = 20_000_000; // Rp 20 juta
  const successFeeRate = 0.07; // 7%
  const estimatedRefund = Number(refundAmount) || 0;
  const estimatedSuccessFee = Math.round(estimatedRefund * successFeeRate);
  const totalEstimatedCost = operatingCost + estimatedSuccessFee;

  if (!showRefund) {
    return (
      <Card className="mt-6 border-2 border-dashed border-emerald-300 hover:border-emerald-400 transition-colors">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-sm">PPN {t('k29_789ddc')}</p>
                <p className="text-xs text-gray-500">{t('k30_96e0f6')}</p>
              </div>
            </div>
            <Button onClick={() => setShowRefund(true)} variant="outline">
              {t('k31_1a2b6d')} <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-emerald-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 rounded-t-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                PPN {t('k29_789ddc')}
              </h2>
              <p className="text-sm text-emerald-100 mt-1">Jakarta Tax Consulting {t('k32_6e2104')}</p>
            </div>
            <button onClick={() => setShowRefund(false)} className="text-white/70 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            {[
              { id: 1, label: t('k33_7844a2') },
              { id: 2, label: t('k34_aae1bf') },
              { id: 3, label: t('k35_829a90') },
              { id: 4, label: t('k13_4f8e30') },
            ].map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    refundStep >= s.id ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{refundStep > s.id ? <Check className="h-3 w-3" /> : s.id}</div>
                  <p className="text-[9px] mt-1">{s.label}</p>
                </div>
                {i < 3 && <div className={`h-0.5 flex-1 ${refundStep > s.id ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: 환급 절차 설명 */}
          {refundStep === 1 && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <p className="font-bold text-sm text-emerald-900 mb-2">PPN {t('k36_09f6dc')}?</p>
                <p className="text-xs text-emerald-800">
                  {t('k37_be38dd')}
                  {t('k38_445cc6')} <b>"Restitusi PPN"</b>{t('k39_081b53')}
                </p>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="font-bold text-sm text-red-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  {t('k40_1766bd')}: {t('k41_f6b4c4')}
                </p>
                <p className="text-xs text-red-800">
                  PPN {t('k42_0eac31')} <b>{t('k43_cbf9a9')}</b>{t('k44_63354a')}
                  {t('auditLegal')}
                </p>
                <p className="text-xs text-red-800 mt-1">
                  {t('k46_d7dee2')} <b>3~12{t('k47_f667f2')}</b>{t('k48_ce06b2')}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border">
                <p className="font-bold text-sm mb-3">{t('k49_55fa8f')}</p>
                <div className="space-y-2 text-xs">
                  {[
                    { step: '1', title: t('k50_e0cc70'), desc: t('k50_e0cc70'), duration: '1~2' + t('k47_f667f2') },
                    { step: '2', title: t('k113_5fd53c') + ' ' + t('k6_d6ed72'), desc: 'SPT Masa PPN Lebih Bayar — Restitusi → DJP ' + t('k6_d6ed72'), duration: '1' + t('k56_1d0584') },
                    { step: '3', title: 'DJP ' + t('k54_ee04da'), desc: 'DJP ' + t('k55_b63cd9'), duration: '1~3' + t('k47_f667f2') },
                    { step: '4', title: t('k56_d6fa73'), desc: t('auditStep4Desc'), duration: t('auditStep4Duration') },
                    { step: '5', title: t('k58_a43bd6'), desc: t('auditStep5Desc'), duration: t('auditStep5Duration') },
                    { step: '6', title: t('k60_6345b9'), desc: t('k60_6345b9'), duration: '1' + t('k47_f667f2') },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <Badge className="bg-emerald-100 text-emerald-700 flex-shrink-0">{item.step}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{item.title}</p>
                          <span className="text-[10px] text-gray-400">{item.duration}</span>
                        </div>
                        <p className="text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 비용 확인 */}
          {refundStep === 2 && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4 border">
                <p className="font-bold text-sm mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  JTC {t('k62_db9d38')}
                </p>

                <div className="space-y-3">
                  {/* Operating cost */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-blue-900">{t('k63_2b3c5e')}</p>
                      <p className="text-lg font-bold font-mono text-blue-700">Rp 20,000,000</p>
                    </div>
                    <p className="text-[11px] text-blue-700">
                      {t('k64_bc4bdb')}
                    </p>
                    <ul className="text-[10px] text-blue-600 mt-2 space-y-0.5">
                      <li>• Faktur Pajak / {t('k65_3418e5')}</li>
                      <li>• DJP {t('k66_d7896e')}</li>
                      <li>• {t('k67_6a481d')}</li>
                      <li>• {t('k68_f9fd91')}</li>
                    </ul>
                  </div>

                  {/* Success fee */}
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-emerald-900">{t('k69_b31bb9')}</p>
                      <p className="text-lg font-bold font-mono text-emerald-700">{t('k70_69edb3')}</p>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      {t('refundFeeNote')}
                    </p>
                  </div>

                  {/* Estimate calculator */}
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-xs font-bold mb-2">{t('k72_a4a9a0')}</p>
                    <div>
                      <Label className="text-[10px]">{t('k73_ab8f53')}</Label>
                      <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                        placeholder="500000000" className="font-mono h-8 text-xs" />
                    </div>
                    {estimatedRefund > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span>{t('k74_d089c1')}</span><span className="font-mono">Rp 20,000,000</span></div>
                        <div className="flex justify-between"><span>{t('k69_b31bb9')} (7% × {new Intl.NumberFormat('id-ID').format(estimatedRefund)})</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedSuccessFee)}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1"><span>{t('k76_2db159')}</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalEstimatedCost)}</span></div>
                        <div className="flex justify-between text-emerald-700 font-bold"><span>{t('k77_594f62')}</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund - totalEstimatedCost)}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Agreements */}
              <div className="space-y-2">
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreedFees} onChange={e => setAgreedFees(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium">{t('k78_77194a')} <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">{t('costSummary')}</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreedAudit} onChange={e => setAgreedAudit(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium">{t('k81_e0de89')} <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">PPN {t('k82_441317')}</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: 신청 정보 */}
          {refundStep === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('k83_98cd0b')}</Label>
                  <Input value={refundPeriod} onChange={e => setRefundPeriod(e.target.value)}
                    placeholder={t('periodPlaceholder')} />
                </div>
                <div>
                  <Label className="text-xs">{t('k73_ab8f53')}</Label>
                  <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                    className="font-mono" placeholder="500000000" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('k84_19e87b')}</Label>
                <select value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  <option value="">{t('k85_f1d7fb')}</option>
                  <option value="EXCESS_INPUT">{t('k86_d00397')} {'>'} Keluaran)</option>
                  <option value="EXPORT">{t('k87_eb6282')}</option>
                  <option value="CAPITAL_GOODS">{t('k88_5266a8')}</option>
                  <option value="PKP_TERMINATION">PKP {t('k89_d53d30')}</option>
                  <option value="OTHER">{t('k90_7f598d')}</option>
                </select>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 border border-amber-200">
                <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{t('k91_84f2f6')}</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• {t('k92_0d7003')} + Masukan) {t('k93_d47e1e')}</li>
                  <li>• {t('requiredDocs')}</li>
                  <li>• {t('k95_b95354')}</li>
                  <li>• {t('k96_197524')}</li>
                  <li>• e-Faktur {t('k97_f6f0cc')}</li>
                </ul>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900">JTC {t('k98_3eba7d')}:</p>
                <ul className="text-[11px] text-emerald-800 mt-1 space-y-0.5">
                  <li>✓ {t('k99_93c016')} — {t('k100_b7e27c')}</li>
                  <li>✓ {t('sptRestitusi')}</li>
                  <li>✓ DJP {t('k101_bb490b')} — {t('k102_7441f9')} + {t('k103_4aac74')}</li>
                  <li>✓ {t('k104_2a6e81')}</li>
                  <li>✓ {t('skplbResult')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 4: 완료 */}
          {refundStep === 4 && !submitted && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="font-bold text-lg">{t('refundAccepted')}</p>
              <p className="text-sm text-gray-600 mt-2">
                JTC {t('k107_04e227')}
              </p>
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1">{t('k108_ed1d88')}</p>
                <div className="space-y-0.5">
                  <p>{t('k109_7bc7c5')}: {refundPeriod || '-'}</p>
                  <p>{t('k110_38e8ae')}: {estimatedRefund > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund) : '-'}</p>
                  <p>{t('k74_d089c1')}: Rp 20,000,000</p>
                  <p>{t('k69_b31bb9')}: {t('k70_69edb3')}</p>
                </div>
              </div>
              <Button className="mt-6" onClick={() => { setShowRefund(false); setRefundStep(1); }}>
                {t('k111_218e2a')}
              </Button>
            </div>
          )}

          {/* Navigation */}
          {refundStep < 4 && (
            <div className="flex justify-between pt-2">
              {refundStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setRefundStep(refundStep - 1)}>
                  {t('k112_cb1dc9')}
                </Button>
              ) : <div />}
              <Button size="sm"
                disabled={
                  (refundStep === 2 && (!agreedFees || !agreedAudit)) ||
                  (refundStep === 3 && (!refundPeriod || !refundReason))
                }
                onClick={() => {
                  if (refundStep === 3) {
                    setSubmitted(true);
                  }
                  setRefundStep(refundStep + 1);
                }}
              >
                {refundStep === 3 ? t('k113_5fd53c') : t('k114_fe6879')}
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
