'use client';

/**
 * Transfer Pricing — Phase 1 upgrade.
 *
 * Adds to the baseline arm's-length analyzer:
 *   - Per-transaction category (Goods / Services / Royalty / Interest / Financial)
 *     with category-aware risk tolerance
 *   - FAR (Functions / Assets / Risks) fields per transaction
 *   - Annual revenue + industry inputs → PMK 213/PMK.03/2016 threshold
 *     gating (Local File / Master File / CbCR auto-detect)
 *   - Three-section documentation output (Master File, Local File,
 *     Executive Summary) — download each as .md
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Loader2, ArrowLeftRight, Sparkles, Shield, Globe,
  AlertTriangle, CheckCircle, Download, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type TxCategory = 'GOODS' | 'SERVICES' | 'ROYALTY' | 'INTEREST' | 'FINANCIAL';

interface TxRow {
  id: string;
  relatedParty: string;
  transactionType: string;
  category: TxCategory;
  amount: number;
  marketPrice: number;
  description: string;
  country: string;
  functions: string;
  assets: string;
  risks: string;
}

interface AnalyzedTx extends Omit<TxRow, 'id'> {
  deviation: number;
  isArmLength: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  adjustment: number;
}

interface ApiResult {
  analysis: AnalyzedTx[];
  summary: {
    totalTransactions: number;
    armLengthCount: number;
    adjustmentNeeded: number;
    totalAdjustment: number;
    byCategory: { GOODS: number; NON_GOODS: number };
  };
  compliance: {
    triggersLocalFile: boolean;
    triggersMasterFile: boolean;
    triggersCbCR: boolean;
    requiredDocs: string[];
    legalBasis: string;
  };
  documentation: {
    masterFile: string;
    localFile: string;
    executiveSummary: string;
  };
}

function newTx(): TxRow {
  return {
    id: crypto.randomUUID(),
    relatedParty: '',
    transactionType: 'Sale',
    category: 'GOODS',
    amount: 0,
    marketPrice: 0,
    description: '',
    country: 'ID',
    functions: '',
    assets: '',
    risks: '',
  };
}

const TP_METHODS = [
  { id: 'CUP', label: 'CUP (Comparable Uncontrolled Price)' },
  { id: 'COST_PLUS', label: 'Cost Plus Method' },
  { id: 'RESALE', label: 'Resale Price Method' },
  { id: 'TNMM', label: 'TNMM (Transactional Net Margin)' },
  { id: 'PROFIT_SPLIT', label: 'Profit Split Method' },
];

const CATEGORIES: { id: TxCategory; label: string }[] = [
  { id: 'GOODS', label: 'Goods (Barang)' },
  { id: 'SERVICES', label: 'Services (Jasa)' },
  { id: 'ROYALTY', label: 'Royalty' },
  { id: 'INTEREST', label: 'Interest (Bunga)' },
  { id: 'FINANCIAL', label: 'Financial (Keuangan)' },
];

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransferPricingPage() {
  const t = useTranslations('pages');
  const tk = useTranslations('killer');
  const tp = useTranslations('transferPricing');

  const [transactions, setTransactions] = useState<TxRow[]>([newTx()]);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [tpMethod, setTpMethod] = useState('CUP');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const addRow = () => setTransactions((p) => [...p, newTx()]);
  const removeRow = (id: string) => {
    if (transactions.length > 1) setTransactions((p) => p.filter((t) => t.id !== id));
  };
  const update = <K extends keyof TxRow>(id: string, field: K, value: TxRow[K]) =>
    setTransactions((p) => p.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  const analyze = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tax/transfer-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          companyName,
          industry,
          tpMethod,
          annualRevenue: annualRevenue ? Number(annualRevenue) : undefined,
          taxYear: new Date().getFullYear(),
        }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data as ApiResult);
    } finally {
      setIsLoading(false);
    }
  };

  const riskChip = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (level === 'HIGH') return <Badge className="bg-red-100 text-red-800 text-[10px]">HIGH</Badge>;
    if (level === 'MEDIUM') return <Badge className="bg-amber-100 text-amber-800 text-[10px]">MEDIUM</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">LOW</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ArrowLeftRight className="h-6 w-6 text-blue-600" />
        {t('tpTitle')}
      </h1>

      {/* Company + TP method */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-5 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">{tk('tp.companyName')}</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="PT Example" />
            </div>
            <div>
              <Label className="text-xs">{tp('industryLabel')}</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Manufacturing" />
            </div>
            <div>
              <Label className="text-xs">{tp('annualRevenueLabel')}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">{tk('tp.tpMethod')}</Label>
              <Select value={tpMethod} onValueChange={setTpMethod}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TP_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="text-xs">{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction rows */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-sm">{tp('transactionsTitle')}</p>
          {transactions.map((tx) => {
            const isExpanded = !!expanded[tx.id];
            return (
              <div key={tx.id} className="rounded-lg border border-gray-200 bg-gray-50/40 p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-12 items-end">
                  <div className="md:col-span-3">
                    <Label className="text-[10px]">{tp('relatedParty')}</Label>
                    <Input
                      className="h-9 text-sm"
                      value={tx.relatedParty}
                      onChange={(e) => update(tx.id, 'relatedParty', e.target.value)}
                      placeholder="PT Afiliasi"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px]">{tp('category')}</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs"
                      value={tx.category}
                      onChange={(e) => update(tx.id, 'category', e.target.value as TxCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px]">{tp('transactionTypeLabel')}</Label>
                    <Input
                      className="h-9 text-sm"
                      value={tx.transactionType}
                      onChange={(e) => update(tx.id, 'transactionType', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px]">{tp('amountLabel')}</Label>
                    <Input
                      className="h-9 text-sm"
                      type="number"
                      value={tx.amount || ''}
                      onChange={(e) => update(tx.id, 'amount', Number(e.target.value))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px]">{tp('marketPriceLabel')}</Label>
                    <Input
                      className="h-9 text-sm"
                      type="number"
                      value={tx.marketPrice || ''}
                      onChange={(e) => update(tx.id, 'marketPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="md:col-span-1 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() =>
                        setExpanded((s) => ({ ...s, [tx.id]: !s[tx.id] }))
                      }
                      title="FAR"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => removeRow(tx.id)}
                      disabled={transactions.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="grid gap-2 md:grid-cols-3 pt-2 border-t border-gray-200">
                    <div>
                      <Label className="text-[10px]">{tp('functionsLabel')}</Label>
                      <Input
                        className="h-9 text-sm"
                        value={tx.functions}
                        onChange={(e) => update(tx.id, 'functions', e.target.value)}
                        placeholder={tp('functionsPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">{tp('assetsLabel')}</Label>
                      <Input
                        className="h-9 text-sm"
                        value={tx.assets}
                        onChange={(e) => update(tx.id, 'assets', e.target.value)}
                        placeholder={tp('assetsPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">{tp('risksLabel')}</Label>
                      <Input
                        className="h-9 text-sm"
                        value={tx.risks}
                        onChange={(e) => update(tx.id, 'risks', e.target.value)}
                        placeholder={tp('risksPlaceholder')}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {tp('addRow')}
            </Button>
            <Button
              onClick={analyze}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t('tpAnalyze')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-sm">{tk('tp.resultTitle')}</p>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">{tp('kpiTotal')}</p>
                  <p className="font-bold">{result.summary.totalTransactions}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />{tp('kpiArmLength')}
                  </p>
                  <p className="font-bold text-emerald-700">{result.summary.armLengthCount}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" />{tp('kpiAdjustment')}
                  </p>
                  <p className="font-bold text-amber-700">{result.summary.adjustmentNeeded}</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-[11px] text-gray-500">{tp('kpiTotalAdjustment')}</p>
                  <p className="font-bold text-red-700">
                    Rp {result.summary.totalAdjustment.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance gate */}
          <Card className={`border-0 shadow-sm ${result.compliance.triggersCbCR
            ? 'bg-red-50 border-l-4 border-l-red-500'
            : result.compliance.triggersLocalFile
            ? 'bg-amber-50 border-l-4 border-l-amber-500'
            : 'bg-gray-50 border-l-4 border-l-gray-300'}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-gray-700 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{tp('complianceTitle')}</p>
                  <p className="text-xs text-gray-600 mt-1">{result.compliance.legalBasis}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge className={result.compliance.triggersLocalFile
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-600'}>
                      Local File: {result.compliance.triggersLocalFile ? tp('required') : tp('notRequired')}
                    </Badge>
                    <Badge className={result.compliance.triggersMasterFile
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-600'}>
                      Master File: {result.compliance.triggersMasterFile ? tp('required') : tp('notRequired')}
                    </Badge>
                    <Badge className={result.compliance.triggersCbCR
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600'}>
                      CbCR: {result.compliance.triggersCbCR ? tp('required') : tp('notRequired')}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-transaction risk breakdown */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="font-semibold text-sm mb-3">{tp('perTxAnalysis')}</p>
              <div className="space-y-2">
                {result.analysis.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.relatedParty || '—'}</p>
                      <p className="text-[11px] text-gray-500">
                        {a.category} · {a.transactionType} · Rp {a.amount.toLocaleString('id-ID')} · {a.deviation}%
                      </p>
                    </div>
                    {riskChip(a.riskLevel)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Documentation sections */}
          {[
            { key: 'masterFile', label: 'Master File', text: result.documentation.masterFile },
            { key: 'localFile', label: 'Local File', text: result.documentation.localFile },
            { key: 'executiveSummary', label: 'Executive Summary', text: result.documentation.executiveSummary },
          ].map((section) => (
            <Card key={section.key} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    {section.label}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      downloadText(
                        `TP_${section.key}_${companyName || 'Company'}.md`,
                        section.text,
                      )
                    }
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {tk('tp.download')}
                  </Button>
                </div>
                <pre className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto font-sans">
                  {section.text}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
