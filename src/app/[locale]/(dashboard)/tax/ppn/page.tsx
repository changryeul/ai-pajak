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
                  {f === 'ALL' ? `${t('filterAll')} (${fakturs.length})` : f === 'OUTPUT' ? `${t('filterKeluaran')} (${fakturs.filter(f => f.faktur_type === 'KELUARAN').length})` : `${t('filterMasukan')} (${fakturs.filter(f => f.faktur_type === 'MASUKAN').length})`}
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

      {/* PPN Refund Section */}
      <PPNRefundSection locale={locale} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PPN 환급 신청 (Restitusi PPN)
// ══════════════════════════════════════════════════════
function PPNRefundSection({ locale }: { locale: string }) {
  const [showRefund, setShowRefund] = useState(false);
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
                <p className="font-bold text-sm">PPN 환급 신청 (Restitusi PPN)</p>
                <p className="text-xs text-gray-500">매입세(PPN Masukan)가 매출세(PPN Keluaran)보다 큰 경우 환급 신청이 가능합니다</p>
              </div>
            </div>
            <Button onClick={() => setShowRefund(true)} variant="outline">
              환급 절차 확인 <ArrowUpRight className="h-3 w-3 ml-1" />
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
                PPN 환급 신청 (Restitusi PPN)
              </h2>
              <p className="text-sm text-emerald-100 mt-1">Jakarta Tax Consulting 세무 감사 대행 서비스</p>
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
              { id: 1, label: '환급 안내' },
              { id: 2, label: '비용 확인' },
              { id: 3, label: '신청 정보' },
              { id: 4, label: '완료' },
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
                <p className="font-bold text-sm text-emerald-900 mb-2">PPN 환급이란?</p>
                <p className="text-xs text-emerald-800">
                  매입세(PPN Masukan)가 매출세(PPN Keluaran)보다 많은 경우, 차액을 DJP(세무서)에서 돌려받는 것입니다.
                  이를 <b>"Restitusi PPN"</b>이라 합니다.
                </p>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="font-bold text-sm text-red-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  중요: 세무조사 수반
                </p>
                <p className="text-xs text-red-800">
                  PPN 환급을 신청하면 DJP가 <b>세무조사(Pemeriksaan Pajak)</b>를 실시합니다.
                  이는 법적 의무이며, 모든 거래 증빙과 장부를 검토합니다.
                </p>
                <p className="text-xs text-red-800 mt-1">
                  세무조사 기간은 통상 <b>3~12개월</b>이며, JTC가 전 과정을 대행합니다.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border">
                <p className="font-bold text-sm mb-3">환급 절차 (6단계)</p>
                <div className="space-y-2 text-xs">
                  {[
                    { step: '1', title: '사전 분석', desc: 'JTC 세무사가 Faktur Pajak, 장부, 증빙을 사전 검토하여 환급 가능성을 평가합니다.', duration: '1~2주' },
                    { step: '2', title: '환급 신청서 제출', desc: 'SPT Masa PPN에 "Lebih Bayar — Restitusi" 표시하여 DJP에 제출합니다.', duration: '1일' },
                    { step: '3', title: 'DJP 세무조사 통보', desc: 'DJP에서 조사 일정을 통보합니다. JTC가 모든 서류를 준비합니다.', duration: '1~3개월' },
                    { step: '4', title: '세무조사 실시', desc: 'DJP 조사관이 사무실을 방문하거나 서류 제출을 요구합니다. JTC가 전 과정에 동행합니다.', duration: '1~6개월' },
                    { step: '5', title: '조사 결과 통보', desc: 'DJP가 SKPLB(환급결정서) 또는 SKPKB(추가납부결정)를 발행합니다.', duration: '1~2주' },
                    { step: '6', title: '환급금 수령', desc: '결정된 금액이 고객 계좌로 이체됩니다 (SKPLB 발행 후 1개월 이내).', duration: '1개월' },
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
                  JTC 세무조사 대행 비용
                </p>

                <div className="space-y-3">
                  {/* Operating cost */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-blue-900">오퍼레이팅 비용 (고정)</p>
                      <p className="text-lg font-bold font-mono text-blue-700">Rp 20,000,000</p>
                    </div>
                    <p className="text-[11px] text-blue-700">
                      세무조사 대행에 필요한 기본 비용입니다. 조사 결과에 관계없이 선불로 청구됩니다.
                    </p>
                    <ul className="text-[10px] text-blue-600 mt-2 space-y-0.5">
                      <li>• Faktur Pajak / 장부 사전 검토</li>
                      <li>• DJP 서류 준비 및 제출</li>
                      <li>• 세무 조사관 대응 (사무실 방문 동행)</li>
                      <li>• 조사 기간 중 추가 자료 요청 대응</li>
                    </ul>
                  </div>

                  {/* Success fee */}
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-emerald-900">성공 보수</p>
                      <p className="text-lg font-bold font-mono text-emerald-700">환급액의 7%</p>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      환급이 확정된 금액에 대해서만 청구됩니다. 환급이 거부되면 성공 보수는 0원입니다.
                    </p>
                  </div>

                  {/* Estimate calculator */}
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-xs font-bold mb-2">예상 비용 계산</p>
                    <div>
                      <Label className="text-[10px]">예상 환급 금액 (Rp)</Label>
                      <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                        placeholder="500000000" className="font-mono h-8 text-xs" />
                    </div>
                    {estimatedRefund > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span>오퍼레이팅 비용</span><span className="font-mono">Rp 20,000,000</span></div>
                        <div className="flex justify-between"><span>성공 보수 (7% × {new Intl.NumberFormat('id-ID').format(estimatedRefund)})</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedSuccessFee)}</span></div>
                        <div className="flex justify-between font-bold border-t pt-1"><span>예상 총 비용</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalEstimatedCost)}</span></div>
                        <div className="flex justify-between text-emerald-700 font-bold"><span>예상 실수령 환급액</span><span className="font-mono">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund - totalEstimatedCost)}</span></div>
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
                    <p className="font-medium">비용 조건에 동의합니다 <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">오퍼레이팅 비용 Rp 20,000,000 (선불) + 환급액의 7% 성공 보수</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={agreedAudit} onChange={e => setAgreedAudit(e.target.checked)}
                    className="mt-0.5 accent-emerald-600" />
                  <div className="text-xs">
                    <p className="font-medium">세무조사 동의 <span className="text-red-500">*</span></p>
                    <p className="text-gray-500">PPN 환급 신청 시 DJP 세무조사가 수반됨을 이해하고 동의합니다</p>
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
                  <Label className="text-xs">환급 신청 기간 (SPT Masa PPN)</Label>
                  <Input value={refundPeriod} onChange={e => setRefundPeriod(e.target.value)}
                    placeholder="예: 2026-01 ~ 2026-03" />
                </div>
                <div>
                  <Label className="text-xs">예상 환급 금액 (Rp)</Label>
                  <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                    className="font-mono" placeholder="500000000" />
                </div>
              </div>
              <div>
                <Label className="text-xs">환급 사유</Label>
                <select value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm">
                  <option value="">선택하세요</option>
                  <option value="EXCESS_INPUT">매입세 초과 (PPN Masukan {'>'} Keluaran)</option>
                  <option value="EXPORT">수출 거래 (PPN 0%)</option>
                  <option value="CAPITAL_GOODS">자본재 취득</option>
                  <option value="PKP_TERMINATION">PKP 등록 해제</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 border border-amber-200">
                <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" />환급 신청 전 준비 사항</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• 해당 기간 모든 Faktur Pajak (Keluaran + Masukan) 원본 보관</li>
                  <li>• 매입/매출 거래 증빙 (인보이스, 계약서, 납품서)</li>
                  <li>• 은행 거래내역서 (해당 기간)</li>
                  <li>• 회계 장부 (Buku Besar, Jurnal)</li>
                  <li>• e-Faktur 데이터 백업 (CSV/XML)</li>
                </ul>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900">JTC 담당자가 다음을 수행합니다:</p>
                <ul className="text-[11px] text-emerald-800 mt-1 space-y-0.5">
                  <li>✓ 사전 Faktur 분석 — 불일치/오류 사전 수정</li>
                  <li>✓ SPT Masa PPN "Lebih Bayar — Restitusi" 제출</li>
                  <li>✓ DJP 조사관 대응 — 모든 서류 준비 + 방문 동행</li>
                  <li>✓ 추가 자료 요청 시 즉시 대응</li>
                  <li>✓ SKPLB(환급결정) 또는 SKPKB(추가납부) 결과 분석 및 이의신청 검토</li>
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
              <p className="font-bold text-lg">환급 신청 접수 완료</p>
              <p className="text-sm text-gray-600 mt-2">
                JTC 담당 세무사가 1영업일 이내에 연락드립니다.
              </p>
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1">신청 정보 요약</p>
                <div className="space-y-0.5">
                  <p>기간: {refundPeriod || '-'}</p>
                  <p>예상 환급: {estimatedRefund > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedRefund) : '-'}</p>
                  <p>오퍼레이팅 비용: Rp 20,000,000</p>
                  <p>성공 보수: 환급액의 7%</p>
                </div>
              </div>
              <Button className="mt-6" onClick={() => { setShowRefund(false); setRefundStep(1); }}>
                닫기
              </Button>
            </div>
          )}

          {/* Navigation */}
          {refundStep < 4 && (
            <div className="flex justify-between pt-2">
              {refundStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setRefundStep(refundStep - 1)}>
                  이전
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
                {refundStep === 3 ? '환급 신청' : '다음'}
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
