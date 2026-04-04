'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, ArrowLeftRight, Sparkles, Shield, FileText, Globe, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TP_METHODS = [
  { id: 'CUP', label: 'CUP (Comparable Uncontrolled Price)', desc: '독립기업 간 비교가격' },
  { id: 'COST_PLUS', label: 'Cost Plus Method', desc: '원가가산' },
  { id: 'RESALE', label: 'Resale Price Method', desc: '재판매가격' },
  { id: 'TNMM', label: 'TNMM (Transactional Net Margin)', desc: '거래순이익률' },
  { id: 'PROFIT_SPLIT', label: 'Profit Split Method', desc: '이익분할' },
];

interface TxRow { id: string; relatedParty: string; transactionType: string; amount: number; marketPrice: number; description: string; country: string; }
function newTx(): TxRow { return { id: crypto.randomUUID(), relatedParty: '', transactionType: 'Sale', amount: 0, marketPrice: 0, description: '', country: 'ID' }; }

export default function TransferPricingPage() {
  const t = useTranslations('pages');
  const tk = useTranslations('killer');
  const [transactions, setTransactions] = useState<TxRow[]>([newTx()]);
  const [companyName, setCompanyName] = useState('');
  const [tpMethod, setTpMethod] = useState('CUP');
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
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs">{tk('tp.companyName')}</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT Example" /></div>
            <div>
              <Label className="text-xs">{tk('tp.tpMethod')}</Label>
              <Select value={tpMethod} onValueChange={setTpMethod}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TP_METHODS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="text-xs">{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{tk('tp.resultTitle')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Transaksi</p><p className="font-bold">{result.summary.totalTransactions}</p></div>
                <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-xs text-gray-500 flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" />Arm&apos;s Length</p><p className="font-bold text-green-700">{result.summary.armLengthCount}</p></div>
                <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xs text-gray-500 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Adjustment</p><p className="font-bold text-red-700">{result.summary.adjustmentNeeded}</p></div>
              </div>

              {/* Risk Level */}
              {result.summary.adjustmentNeeded > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span>{tk('tp.adjustmentWarning', { count: result.summary.adjustmentNeeded })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TP Method & Legal Basis */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />{tk('tp.legalTitle')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-medium text-blue-800">{tk('tp.tpMethod')}</p>
                  <p className="text-blue-600 mt-1">{TP_METHODS.find(m => m.id === tpMethod)?.label || tpMethod}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-medium text-blue-800">법적 근거</p>
                  <p className="text-blue-600 mt-1">PMK 213/PMK.03/2016, UU PPh Pasal 18(3)</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-medium text-blue-800">{tk('tp.armsLength')}</p>
                  <p className="text-blue-600 mt-1">{tk('tp.armsLengthDesc')}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-medium text-blue-800">{tk('tp.docObligation')}</p>
                  <p className="text-blue-600 mt-1">{tk('tp.docObligationDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Documentation */}
          {result.documentation && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />{tk('tp.aiDocTitle')}
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                    const blob = new Blob([result.documentation], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `TP_Doc_${companyName || 'Company'}.txt`; a.click();
                  }}>
                    <Download className="h-3 w-3 mr-1" />{tk('tp.download')}
                  </Button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-line leading-relaxed max-h-[400px] overflow-y-auto">
                  {result.documentation}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
