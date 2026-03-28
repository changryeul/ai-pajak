'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, ArrowLeftRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TxRow { id: string; relatedParty: string; transactionType: string; amount: number; marketPrice: number; description: string; }
function newTx(): TxRow { return { id: crypto.randomUUID(), relatedParty: '', transactionType: 'Sale', amount: 0, marketPrice: 0, description: '' }; }

export default function TransferPricingPage() {
  const t = useTranslations('pages');
  const [transactions, setTransactions] = useState<TxRow[]>([newTx()]);
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  const addRow = () => setTransactions(p => [...p, newTx()]);
  const removeRow = (id: string) => { if (transactions.length > 1) setTransactions(p => p.filter(t => t.id !== id)); };
  const update = (id: string, field: string, value: string | number) => setTransactions(p => p.map(t => t.id === id ? { ...t, [field]: value } : t));

  const analyze = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tax/transfer-pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, companyName, taxYear: 2025 }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ArrowLeftRight className="h-6 w-6 text-blue-600" />{t('tpTitle')}
      </h1>

      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-4">
          <div><Label className="text-xs">Nama Perusahaan</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT Example" /></div>
          {transactions.map((tx, i) => (
            <div key={tx.id} className="grid grid-cols-6 gap-2 items-end">
              <div><Label className="text-[10px]">Pihak Afiliasi</Label><Input value={tx.relatedParty} onChange={e => update(tx.id, 'relatedParty', e.target.value)} placeholder="PT Afiliasi" className="text-sm" /></div>
              <div><Label className="text-[10px]">Jenis</Label><Input value={tx.transactionType} onChange={e => update(tx.id, 'transactionType', e.target.value)} className="text-sm" /></div>
              <div><Label className="text-[10px]">Nilai (Rp)</Label><Input type="number" value={tx.amount || ''} onChange={e => update(tx.id, 'amount', Number(e.target.value))} className="text-sm" /></div>
              <div><Label className="text-[10px]">Harga Pasar (Rp)</Label><Input type="number" value={tx.marketPrice || ''} onChange={e => update(tx.id, 'marketPrice', Number(e.target.value))} className="text-sm" /></div>
              <div><Label className="text-[10px]">Deskripsi</Label><Input value={tx.description} onChange={e => update(tx.id, 'description', e.target.value)} className="text-sm" /></div>
              <Button variant="ghost" size="sm" onClick={() => removeRow(tx.id)} disabled={transactions.length <= 1}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" />Tambah</Button>
            <Button onClick={analyze} disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}{t('tpAnalyze')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Hasil Analisis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Transaksi</p><p className="font-bold">{result.summary.totalTransactions}</p></div>
              <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-xs text-gray-500">Arm's Length</p><p className="font-bold text-green-700">{result.summary.armLengthCount}</p></div>
              <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xs text-gray-500">Perlu Adjustment</p><p className="font-bold text-red-700">{result.summary.adjustmentNeeded}</p></div>
            </div>
            {result.documentation && (
              <div className="p-4 bg-blue-50 rounded-lg"><p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3 text-yellow-500" />AI Documentation</p>
                <div className="text-sm whitespace-pre-line">{result.documentation}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
