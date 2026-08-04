'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Calculator, TrendingUp, FileText, Loader2, Building2, MapPin, Sparkles, BarChart3, DollarSign,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type ActiveTool = 'predict' | 'cashflow' | 'summarize' | 'customs' | 'regional' | 'benchmark' | null;

function fmt(n: number) { return `Rp ${n.toLocaleString('id-ID')}`; }

export default function TaxToolsPage() {
  const tp = useTranslations('pages');
  const tt = useTranslations('taxTools');
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  const tools = [
    { id: 'predict' as const, icon: TrendingUp, title: tt('predictTax'), desc: tt('predictDesc'), gradient: 'from-blue-500 to-indigo-600' },
    { id: 'cashflow' as const, icon: BarChart3, title: tt('cashflowForecast'), desc: tt('cashflowDesc'), gradient: 'from-green-500 to-emerald-600' },
    { id: 'summarize' as const, icon: FileText, title: tt('summarizeDoc'), desc: tt('summarizeDesc'), gradient: 'from-purple-500 to-violet-600' },
    { id: 'customs' as const, icon: DollarSign, title: tt('customsCalc'), desc: tt('customsDesc'), gradient: 'from-amber-500 to-orange-500' },
    { id: 'regional' as const, icon: MapPin, title: tt('regionalTax'), desc: tt('regionalDesc'), gradient: 'from-red-500 to-rose-500' },
    { id: 'benchmark' as const, icon: Building2, title: tt('benchmarking'), desc: tt('benchmarkDesc'), gradient: 'from-cyan-500 to-blue-500' },
  ];

  async function runTool(tool: ActiveTool, body: Record<string, unknown>, endpoint: string) {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data.success ? data.data : { error: data.error });
    } catch { setResult({ error: tt('processFailed') }); }
    finally { setIsLoading(false); }
  }

  async function runGet(endpoint: string) {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setResult(data.success ? data.data : { error: data.error });
    } catch { setResult({ error: tt('processFailed') }); }
    finally { setIsLoading(false); }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          {tp('taxToolsTitle')}
        </h1>
        <p className="text-gray-500 mt-1">{tp('taxToolsDesc')}</p>
      </div>

      {/* Tool Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(isActive ? null : tool.id); setResult(null); }}
              className={`text-left rounded-xl p-4 border transition-all ${isActive ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:shadow-sm'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${tool.gradient} shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{tool.title}</p>
                  <p className="text-xs text-gray-500">{tool.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tool Forms */}
      {activeTool === 'predict' && <PredictForm onSubmit={(b) => runTool('predict', b, '/api/tax/predict')} isLoading={isLoading} />}
      {activeTool === 'cashflow' && <CashflowForm onSubmit={(b) => runTool('cashflow', b, '/api/reports/cashflow-forecast')} isLoading={isLoading} />}
      {activeTool === 'summarize' && <SummarizeForm isLoading={isLoading} setIsLoading={setIsLoading} setResult={setResult} />}
      {activeTool === 'customs' && <CustomsForm onSubmit={(b) => runTool('customs', b, '/api/tax/customs')} isLoading={isLoading} />}
      {activeTool === 'regional' && <RegionalForm onSubmit={(b) => runTool('regional', b, '/api/tax/regional')} isLoading={isLoading} />}
      {activeTool === 'benchmark' && <BenchmarkForm onSubmit={(params) => runGet(`/api/reports/benchmarking?${params}`)} isLoading={isLoading} />}

      {/* Results */}
      {result && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-500" />{tp('result')}</CardTitle></CardHeader>
          <CardContent>
            {result.error ? (
              <p className="text-red-600 text-sm">{result.error}</p>
            ) : (
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Tool Forms ---

function PredictForm({ onSubmit, isLoading }: { onSubmit: (b: Record<string, unknown>) => void; isLoading: boolean }) {
  const tt = useTranslations('taxTools');
  const [income, setIncome] = useState('');
  const [ptkp, setPtkp] = useState('TK/0');
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">{tt('monthlySalary')}</Label><Input type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="15000000" /></div>
          <div><Label className="text-xs">PTKP</Label>
            <Select value={ptkp} onValueChange={setPtkp}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
        <Button onClick={() => onSubmit({ currentMonthlyIncome: Number(income), ptkpStatus: ptkp, taxYear: 2025 })} disabled={isLoading || !income} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}{tt('predict')}
        </Button>
      </CardContent>
    </Card>
  );
}

function CashflowForm({ onSubmit, isLoading }: { onSubmit: (b: Record<string, unknown>) => void; isLoading: boolean }) {
  const tt = useTranslations('taxTools');
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">{tt('monthlyRevenue')}</Label><Input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="100000000" /></div>
          <div><Label className="text-xs">{tt('monthlyExpenses')}</Label><Input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} placeholder="60000000" /></div>
        </div>
        <Button onClick={() => onSubmit({ monthlyRevenue: Number(revenue), monthlyExpenses: Number(expenses), months: 6 })} disabled={isLoading || !revenue} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}{tt('forecast')}
        </Button>
      </CardContent>
    </Card>
  );
}

function SummarizeForm({ isLoading, setIsLoading, setResult }: { isLoading: boolean; setIsLoading: (v: boolean) => void; setResult: (v: unknown) => void }) {
  const tt = useTranslations('taxTools');
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/documents/summarize', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data.success ? data.data : { error: data.error });
    } catch { setResult({ error: tt('uploadFailed') }); }
    finally { setIsLoading(false); }
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <Label className="text-xs">{tt('uploadRegDoc')}</Label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={isLoading} className="text-sm" />
        {isLoading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />{tt('aiSummarizing')}</div>}
      </CardContent>
    </Card>
  );
}

function CustomsForm({ onSubmit, isLoading }: { onSubmit: (b: Record<string, unknown>) => void; isLoading: boolean }) {
  const tt = useTranslations('taxTools');
  const [cif, setCif] = useState('');
  const [rate, setRate] = useState('15500');
  const [duty, setDuty] = useState('0.10');
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">{tt('cifUsd')}</Label><Input type="number" value={cif} onChange={e => setCif(e.target.value)} placeholder="1000" /></div>
          <div><Label className="text-xs">{tt('exchangeRate')}</Label><Input type="number" value={rate} onChange={e => setRate(e.target.value)} /></div>
          <div><Label className="text-xs">{tt('dutyRate')}</Label><Input type="number" value={duty} onChange={e => setDuty(e.target.value)} step="0.01" /></div>
        </div>
        <Button onClick={() => onSubmit({ cifValue: Number(cif), exchangeRate: Number(rate), dutyRate: Number(duty) })} disabled={isLoading || !cif} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}{tt('calculate')}
        </Button>
      </CardContent>
    </Card>
  );
}

function RegionalForm({ onSubmit, isLoading }: { onSubmit: (b: Record<string, unknown>) => void; isLoading: boolean }) {
  const tt = useTranslations('taxTools');
  const [taxType, setTaxType] = useState('PBB');
  const [value, setValue] = useState('');
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">{tt('taxType')}</Label>
            <Select value={taxType} onValueChange={setTaxType}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PBB">PBB</SelectItem>
                <SelectItem value="BPHTB">BPHTB</SelectItem>
                <SelectItem value="RESTAURANT">{tt('pajakRestoran')}</SelectItem>
                <SelectItem value="HOTEL">{tt('pajakHotel')}</SelectItem>
                <SelectItem value="PARKING">{tt('pajakParkir')}</SelectItem>
                <SelectItem value="ADVERTISEMENT">{tt('pajakReklame')}</SelectItem>
              </SelectContent></Select></div>
          <div><Label className="text-xs">{taxType === 'PBB' ? tt('njop') : taxType === 'BPHTB' ? tt('transactionValue') : tt('revenue')}</Label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="500000000" /></div>
        </div>
        <Button onClick={() => {
          const body: Record<string, unknown> = { taxType };
          if (taxType === 'PBB') body.njop = Number(value);
          else if (taxType === 'BPHTB') body.transactionValue = Number(value);
          else body.revenue = Number(value);
          onSubmit(body);
        }} disabled={isLoading || !value} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}{tt('calculate')}
        </Button>
      </CardContent>
    </Card>
  );
}

function BenchmarkForm({ onSubmit, isLoading }: { onSubmit: (params: string) => void; isLoading: boolean }) {
  const tt = useTranslations('taxTools');
  const [industry, setIndustry] = useState('RETAIL');
  const [rate, setRate] = useState('');
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">{tt('industry')}</Label>
            <Select value={industry} onValueChange={setIndustry}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['RETAIL','MANUFACTURING','SERVICES','TECHNOLOGY','FNB','CONSTRUCTION','TRADING','PROFESSIONAL'].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent></Select></div>
          <div><Label className="text-xs">{tt('yourRate')}</Label>
            <Input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="2.5" step="0.1" /></div>
        </div>
        <Button onClick={() => onSubmit(`industry=${industry}&effectiveRate=${rate}`)} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}{tt('compare')}
        </Button>
      </CardContent>
    </Card>
  );
}
