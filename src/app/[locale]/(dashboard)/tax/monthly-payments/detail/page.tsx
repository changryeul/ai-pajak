'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/hooks/useSession';
import {
  ArrowLeft, Plus, Loader2, FileText, Users, DollarSign,
  TrendingUp, TrendingDown, Minus, Receipt, AlertTriangle,
} from 'lucide-react';

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

export default function MonthlyPaymentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { session } = useSession();

  const taxType = searchParams.get('type') || 'PPh23';
  const period = searchParams.get('period') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [counterparties, setCounterparties] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    counterpartyId: '', counterpartyName: '', counterpartyNpwp: '',
    serviceType: 'JASA_TEKNIK', grossAmount: '', invoiceNumber: '', description: '',
    fakturType: 'KELUARAN', dpp: '', fakturNumber: '',
  });

  useEffect(() => {
    loadData();
    loadCounterparties();
  }, [taxType, period]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const endpoint = taxType === 'PPN' ? '/api/tax/ppn-faktur-monthly' : '/api/tax/pph23-transactions';
      const p = new URLSearchParams({ period });
      if (session?.customerId) p.append('customerId', session.customerId);
      const res = await fetch(`${endpoint}?${p}`);
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const loadCounterparties = async () => {
    if (!session?.customerId) return;
    const res = await fetch(`/api/tax/counterparties?customerId=${session.customerId}`);
    const d = await res.json();
    if (d.success) setCounterparties(d.data.counterparties);
  };

  const handleSubmit = async () => {
    const endpoint = taxType === 'PPN' ? '/api/tax/ppn-faktur-monthly' : '/api/tax/pph23-transactions';
    const body = taxType === 'PPN' ? {
      customerId: session?.customerId,
      taxPeriod: period,
      fakturType: formData.fakturType,
      fakturNumber: formData.fakturNumber,
      counterpartyId: formData.counterpartyId || undefined,
      counterpartyName: formData.counterpartyName,
      counterpartyNpwp: formData.counterpartyNpwp,
      dpp: Number(formData.dpp),
    } : {
      customerId: session?.customerId,
      taxPeriod: period,
      counterpartyId: formData.counterpartyId || undefined,
      counterpartyName: formData.counterpartyName,
      counterpartyNpwp: formData.counterpartyNpwp,
      serviceType: formData.serviceType,
      grossAmount: Number(formData.grossAmount),
      invoiceNumber: formData.invoiceNumber,
      description: formData.description,
      transactionDate: new Date().toISOString().slice(0, 10),
    };

    await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowForm(false);
    setFormData({ counterpartyId: '', counterpartyName: '', counterpartyNpwp: '', serviceType: 'JASA_TEKNIK', grossAmount: '', invoiceNumber: '', description: '', fakturType: 'KELUARAN', dpp: '', fakturNumber: '' });
    loadData();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Button variant="ghost" onClick={() => router.push(`/${locale}/tax/monthly-payments`)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />Kembali
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-blue-600" />
            {taxType === 'PPN' ? 'PPN Faktur' : 'PPh 23'} - {period}
          </h1>
          <p className="text-gray-500 mt-1">
            {taxType === 'PPN' ? 'Faktur Pajak Keluaran & Masukan' : 'Daftar transaksi pemotongan PPh 23'}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />{taxType === 'PPN' ? 'Tambah Faktur' : 'Tambah Transaksi'}
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Lawan Transaksi</Label>
                <Select value={formData.counterpartyId} onValueChange={v => {
                  const cp = counterparties.find((c: {id: string}) => c.id === v);
                  setFormData({ ...formData, counterpartyId: v, counterpartyName: cp?.name || '', counterpartyNpwp: cp?.npwp || '' });
                }}>
                  <SelectTrigger><SelectValue placeholder="Pilih atau isi manual" /></SelectTrigger>
                  <SelectContent>
                    {counterparties.map((cp: {id: string; name: string; npwp?: string}) => (
                      <SelectItem key={cp.id} value={cp.id}>{cp.name} {cp.npwp ? `(${cp.npwp})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">NPWP Lawan</Label>
                <Input className="text-sm font-mono" value={formData.counterpartyNpwp} onChange={e => setFormData({ ...formData, counterpartyNpwp: e.target.value })} placeholder="XX.XXX.XXX.X-XXX.XXX" />
              </div>
            </div>

            {/* NPWP warning for PPh 23 */}
            {taxType !== 'PPN' && !formData.counterpartyNpwp && formData.counterpartyName && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span><strong>Tarif 2x lipat</strong> berlaku karena lawan transaksi tidak memiliki NPWP (Pasal 21 ayat 5a UU PPh). Contoh: Jasa 2% → 4%, Dividen 15% → 30%.</span>
              </div>
            )}

            {taxType === 'PPN' ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Jenis Faktur</Label>
                  <Select value={formData.fakturType} onValueChange={v => setFormData({ ...formData, fakturType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KELUARAN">Keluaran (Penjualan)</SelectItem>
                      <SelectItem value="MASUKAN">Masukan (Pembelian)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">No. Faktur</Label>
                  <Input className="text-sm font-mono" value={formData.fakturNumber} onChange={e => setFormData({ ...formData, fakturNumber: e.target.value })} placeholder="010.000-24.00000001" />
                </div>
                <div>
                  <Label className="text-xs">DPP (Rp)</Label>
                  <Input type="number" className="text-sm" value={formData.dpp} onChange={e => setFormData({ ...formData, dpp: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Jenis Jasa</Label>
                  <Select value={formData.serviceType} onValueChange={v => setFormData({ ...formData, serviceType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {data?.serviceTypes && Object.entries(data.serviceTypes).map(([k, v]: [string, unknown]) => (
                        <SelectItem key={k} value={k}>{(v as {label: string}).label} ({((v as {rate: number}).rate * 100)}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Jumlah Bruto (Rp)</Label>
                  <Input type="number" className="text-sm" value={formData.grossAmount} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">No. Invoice</Label>
                  <Input className="text-sm" value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Batal</Button>
              <Button size="sm" onClick={handleSubmit}>Simpan</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {!isLoading && data && (
        <>
          {taxType === 'PPN' && data.summary && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">PPN Keluaran (Penjualan)</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{fmt(data.summary.outputTax.totalPpn)}</p>
                  <p className="text-xs text-gray-400">{data.summary.outputTax.count} faktur</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">PPN Masukan (Pembelian)</p>
                  <p className="text-lg font-bold text-green-700 mt-1">{fmt(data.summary.inputTax.totalPpn)}</p>
                  <p className="text-xs text-gray-400">{data.summary.inputTax.count} faktur</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">PPN Neto</p>
                  <p className={`text-lg font-bold mt-1 ${data.summary.netPpn > 0 ? 'text-red-700' : data.summary.netPpn < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {fmt(Math.abs(data.summary.netPpn))}
                  </p>
                  <Badge className={data.summary.status === 'KURANG_BAYAR' ? 'bg-red-100 text-red-700' : data.summary.status === 'LEBIH_BAYAR' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>{data.summary.status}</Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {taxType !== 'PPN' && data.summary && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="border-0 shadow-sm"><CardContent className="p-4">
                <p className="text-xs text-gray-500">Total Bruto</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{fmt(data.summary.totalGross)}</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-4">
                <p className="text-xs text-gray-500">Total PPh 23</p>
                <p className="text-lg font-bold text-red-700 mt-1">{fmt(data.summary.totalTax)}</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-4">
                <p className="text-xs text-gray-500">Transaksi</p>
                <p className="text-lg font-bold text-blue-700 mt-1">{data.summary.transactionCount}</p>
              </CardContent></Card>
            </div>
          )}

          {/* Transaction List */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{taxType === 'PPN' ? 'Daftar Faktur' : 'Daftar Transaksi'}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-2 px-2">Lawan Transaksi</th>
                      <th className="text-left py-2 px-2">NPWP</th>
                      {taxType === 'PPN' ? (
                        <>
                          <th className="text-left py-2 px-2">Jenis</th>
                          <th className="text-right py-2 px-2">DPP</th>
                          <th className="text-right py-2 px-2">PPN</th>
                        </>
                      ) : (
                        <>
                          <th className="text-left py-2 px-2">Jenis Jasa</th>
                          <th className="text-right py-2 px-2">Bruto</th>
                          <th className="text-right py-2 px-2">PPh 23</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(taxType === 'PPN' ? data.fakturs : data.transactions)?.map((item: Record<string, unknown>, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-2">{(item.counterparty_name || '-') as string}</td>
                        <td className="py-2 px-2 font-mono text-xs">{(item.counterparty_npwp || '-') as string}</td>
                        {taxType === 'PPN' ? (
                          <>
                            <td className="py-2 px-2">
                              <Badge className={item.faktur_type === 'KELUARAN' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                                {item.faktur_type as string}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(Number(item.dpp))}</td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(Number(item.ppn))}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-2">{(item.service_type || '') as string}</td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(Number(item.gross_amount))}</td>
                            <td className="py-2 px-2 text-right font-mono text-red-600">{fmt(Number(item.tax_amount))}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>}
    </div>
  );
}
