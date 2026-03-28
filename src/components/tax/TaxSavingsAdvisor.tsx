'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import {
  Lightbulb,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';

interface TaxSavingsAdvisorProps {
  customerId: string;
  customerName: string;
  defaultTaxYear?: number;
  defaultPtkpStatus?: PTKPStatus;
  /** Pre-loaded income sources from OCR */
  incomeSources?: Array<{
    employerNpwp: string;
    employerName: string;
    periodStart: string;
    periodEnd: string;
    taxYear: number;
    grossIncome: number;
    positionCosts: number;
    pensionContribution: number;
    netIncome: number;
    ptkpAmount: number;
    taxableIncome: number;
    taxDue: number;
    taxWithheld: number;
  }>;
}

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  potentialSavings: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  legalBasis: string;
  actionItems: string[];
}

interface SavingsResult {
  currentTax: number;
  optimizedTax: number;
  totalPotentialSavings: number;
  effectiveRate: { current: number; optimized: number };
  recommendations: Recommendation[];
  summary: string;
  disclaimer: string;
}

const PTKP_OPTIONS: { value: PTKPStatus; label: string }[] = [
  { value: 'TK/0', label: 'TK/0 - Tidak Kawin, 0 Tanggungan' },
  { value: 'TK/1', label: 'TK/1 - Tidak Kawin, 1 Tanggungan' },
  { value: 'TK/2', label: 'TK/2 - Tidak Kawin, 2 Tanggungan' },
  { value: 'TK/3', label: 'TK/3 - Tidak Kawin, 3 Tanggungan' },
  { value: 'K/0', label: 'K/0 - Kawin, 0 Tanggungan' },
  { value: 'K/1', label: 'K/1 - Kawin, 1 Tanggungan' },
  { value: 'K/2', label: 'K/2 - Kawin, 2 Tanggungan' },
  { value: 'K/3', label: 'K/3 - Kawin, 3 Tanggungan' },
  { value: 'K/I/0', label: 'K/I/0 - Kawin + Istri Gabung, 0 Tanggungan' },
  { value: 'K/I/1', label: 'K/I/1 - Kawin + Istri Gabung, 1 Tanggungan' },
  { value: 'K/I/2', label: 'K/I/2 - Kawin + Istri Gabung, 2 Tanggungan' },
  { value: 'K/I/3', label: 'K/I/3 - Kawin + Istri Gabung, 3 Tanggungan' },
];

function formatCurrency(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const difficultyConfig = {
  EASY: { label: 'Mudah', color: 'bg-green-100 text-green-700' },
  MEDIUM: { label: 'Sedang', color: 'bg-yellow-100 text-yellow-700' },
  HARD: { label: 'Sulit', color: 'bg-red-100 text-red-700' },
};

const categoryConfig: Record<string, { label: string; icon: string }> = {
  PTKP_OPTIMIZATION: { label: 'Optimasi PTKP', icon: '👥' },
  DEDUCTION_OPTIMIZATION: { label: 'Optimasi Pengurangan', icon: '📉' },
  INCOME_SPLITTING: { label: 'Pembagian Penghasilan', icon: '💑' },
  TAX_CREDIT: { label: 'Kredit Pajak', icon: '💰' },
  INVESTMENT: { label: 'Investasi', icon: '📈' },
  BUSINESS_STRUCTURE: { label: 'Struktur Usaha', icon: '🏢' },
  COMPLIANCE: { label: 'Kepatuhan', icon: '✅' },
};

export function TaxSavingsAdvisor({
  customerId,
  customerName,
  defaultTaxYear = new Date().getFullYear() - 1,
  defaultPtkpStatus = 'TK/0',
  incomeSources,
}: TaxSavingsAdvisorProps) {
  const ts = useTranslations('taxSavingsPage');
  const currentYear = new Date().getFullYear();
  const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const [ptkpStatus, setPtkpStatus] = useState<PTKPStatus>(defaultPtkpStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SavingsResult | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const analyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax/savings-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          taxYear,
          ptkpStatus,
          incomeSources,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, taxYear, ptkpStatus, incomeSources]);

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI Tax Savings Advisor
          </CardTitle>
          <CardDescription>
            {ts('subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-500">Wajib Pajak:</span>{' '}
            <span className="font-medium">{customerName}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tahun Pajak</Label>
              <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taxYearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status PTKP</Label>
              <Select value={ptkpStatus} onValueChange={(v) => setPtkpStatus(v as PTKPStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PTKP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <Button onClick={analyze} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {ts('analyzing')}
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                {ts('analyze')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{ts('currentTax')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(result.currentTax)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ts('effectiveRate')}: {formatPercent(result.effectiveRate.current)}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">{ts('potentialSavings')}</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(result.totalPotentialSavings)}
                  </p>
                  <TrendingDown className="h-4 w-4 mx-auto mt-1 text-green-600" />
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{ts('optimizedTax')}</p>
                  <p className="text-lg font-bold text-blue-700">
                    {formatCurrency(result.optimizedTax)}
                  </p>
                  <p className="text-xs text-blue-500">
                    {ts('effectiveRate')}: {formatPercent(result.effectiveRate.optimized)}
                  </p>
                </div>
              </div>

              {/* Savings Progress Bar */}
              {result.currentTax > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{ts('savingsPercent')}</span>
                    <span>
                      {formatPercent(result.totalPotentialSavings / result.currentTax)} {ts('fromCurrentTax')}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (result.totalPotentialSavings / result.currentTax) * 100)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Summary */}
          {result.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  {ts('aiAnalysis')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {result.summary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {ts('recommendations')} ({result.recommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.recommendations.map((rec) => {
                const isExpanded = expandedItems.has(rec.id);
                const cat = categoryConfig[rec.category] || { label: rec.category, icon: '📋' };
                const diff = difficultyConfig[rec.difficulty];

                return (
                  <div key={rec.id} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full p-4 text-left flex items-start gap-3 hover:bg-gray-50 transition-colors"
                      onClick={() => toggleExpand(rec.id)}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{rec.title}</span>
                          <Badge variant="outline" className={diff.color}>
                            {diff.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {cat.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-green-700 font-medium mt-1">
                          {ts('save')} {formatCurrency(rec.potentialSavings)}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
                        <p className="text-sm text-gray-700 pt-3">{rec.description}</p>

                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            {ts('stepsToTake')}:
                          </p>
                          <ul className="space-y-1">
                            {rec.actionItems.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <p className="text-xs text-gray-400">
                          {ts('legalBasis')}: {rec.legalBasis}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {result.recommendations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">{ts('noSavings')}</p>
                  <p className="text-sm">{ts('noSavingsDesc')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-gray-500 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p>{result.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default TaxSavingsAdvisor;
