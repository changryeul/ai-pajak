'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, TrendingDown, Loader2, DollarSign, Users, Building2,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';
import { CHART_ACCENT_POSITIVE } from '@/lib/charts/palette';
import { TrendBadge } from '@/components/ui/TrendBadge';

interface OptimizationResult {
  currentTax: number;
  optimizedTax: number;
  savings: number;
  savingsPercent: number;
  recommendations: Recommendation[];
}

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  savings: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  legalBasis: string;
}

const PTKP_AMOUNTS: Record<string, number> = {
  'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
  'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
  'K/I/0': 112500000, 'K/I/1': 117000000, 'K/I/2': 121500000, 'K/I/3': 126000000,
};


function calculateTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  const brackets = [
    { limit: 60000000, rate: 0.05 },
    { limit: 250000000, rate: 0.15 },
    { limit: 500000000, rate: 0.25 },
    { limit: 5000000000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];
  let remaining = taxableIncome;
  let prev = 0;
  for (const b of brackets) {
    const taxable = Math.min(remaining, b.limit - prev);
    tax += taxable * b.rate;
    remaining -= taxable;
    prev = b.limit;
    if (remaining <= 0) break;
  }
  return Math.round(tax);
}

// Okabe-Ito-safe difficulty palette. EASY uses bluish-green family
// (CHART_ACCENT_POSITIVE), HARD uses vermillion family
// (CHART_ACCENT_NEGATIVE), MEDIUM stays amber/yellow (no red-green pair
// so no colorblind collision).
const DIFFICULTY_STYLES: Record<'EASY' | 'MEDIUM' | 'HARD', React.CSSProperties> = {
  EASY: { backgroundColor: '#D0F0E5', color: '#00684D' },
  MEDIUM: { backgroundColor: '#FEF3C7', color: '#92400E' },
  HARD: { backgroundColor: '#FBE0D0', color: '#A04400' },
};

export default function TaxOptimizerPage() {
  const t = useTranslations('taxOptimizer');

  const PTKP_OPTIONS = [
    { value: 'TK/0', label: 'TK/0 — ' + t('ptkpSingleNoDep'), amount: 54000000 },
    { value: 'TK/1', label: 'TK/1 — ' + t('ptkpSingleDep1'), amount: 58500000 },
    { value: 'TK/2', label: 'TK/2 — ' + t('ptkpSingleDep2'), amount: 63000000 },
    { value: 'TK/3', label: 'TK/3 — ' + t('ptkpSingleDep3'), amount: 67500000 },
    { value: 'K/0', label: 'K/0 — ' + t('ptkpMarriedNoDep'), amount: 58500000 },
    { value: 'K/1', label: 'K/1 — ' + t('ptkpMarriedDep1'), amount: 63000000 },
    { value: 'K/2', label: 'K/2 — ' + t('ptkpMarriedDep2'), amount: 67500000 },
    { value: 'K/3', label: 'K/3 — ' + t('ptkpMarriedDep3'), amount: 72000000 },
    { value: 'K/I/0', label: 'K/I/0 — ' + t('ptkpCombined'), amount: 112500000 },
    { value: 'K/I/1', label: 'K/I/1 — ' + t('ptkpCombinedPlus1'), amount: 117000000 },
    { value: 'K/I/2', label: 'K/I/2 — ' + t('ptkpCombinedPlus2'), amount: 121500000 },
    { value: 'K/I/3', label: 'K/I/3 — ' + t('ptkpCombinedPlus3'), amount: 126000000 },
  ];

  const DIFFICULTY_LABELS: Record<string, string> = {
    EASY: t('difficultyEasy'),
    MEDIUM: t('difficultyMedium'),
    HARD: t('difficultyHard'),
  };

  const [grossIncome, setGrossIncome] = useState(0);
  const [ptkpStatus, setPtkpStatus] = useState('TK/0');
  const [hasBusinessIncome, setHasBusinessIncome] = useState(false);
  const [businessRevenue, setBusinessRevenue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const optimize = () => {
    setIsLoading(true);

    setTimeout(() => {
      const ptkp = PTKP_OPTIONS.find(p => p.value === ptkpStatus)?.amount || 54000000;
      const positionCost = Math.min(grossIncome * 0.05, 6000000);
      const pensionCost = Math.min(grossIncome * 0.01, 2400000);
      const netIncome = grossIncome - positionCost - pensionCost;
      const taxableIncome = Math.max(netIncome - ptkp, 0);
      const currentTax = calculateTax(taxableIncome);

      const recommendations: Recommendation[] = [];
      let optimizedSavings = 0;

      // PTKP optimization
      if (!ptkpStatus.startsWith('K') && grossIncome > 100000000) {
        recommendations.push({
          id: 'ptkp_marriage', category: 'PTKP',
          title: t('recPtkpMarriageTitle'),
          description: t('recPtkpMarriageDesc'),
          savings: calculateTax(taxableIncome) - calculateTax(Math.max(taxableIncome - 4500000, 0)),
          difficulty: 'EASY', legalBasis: 'UU PPh Pasal 7',
        });
        optimizedSavings += recommendations[recommendations.length - 1].savings;
      }

      // BPJS deduction
      const bpjsMax = Math.min(grossIncome * 0.04, 8000000 * 12 * 0.04);
      if (bpjsMax > 0) {
        const bpjsSavings = calculateTax(taxableIncome) - calculateTax(Math.max(taxableIncome - bpjsMax, 0));
        recommendations.push({
          id: 'bpjs', category: 'DEDUCTION',
          title: t('recBpjsTitle'),
          description: t('recBpjsDesc', { amount: fmtRp(bpjsMax) }),
          savings: bpjsSavings, difficulty: 'EASY', legalBasis: 'PMK 101/PMK.010/2016',
        });
        optimizedSavings += bpjsSavings;
      }

      // Zakat deduction
      const zakatAmount = grossIncome * 0.025;
      if (zakatAmount > 1000000) {
        const zakatSavings = calculateTax(taxableIncome) - calculateTax(Math.max(taxableIncome - zakatAmount, 0));
        recommendations.push({
          id: 'zakat', category: 'DEDUCTION',
          title: t('recZakatTitle'),
          description: t('recZakatDesc', { amount: fmtRp(zakatAmount) }),
          savings: zakatSavings, difficulty: 'EASY', legalBasis: 'UU PPh Pasal 9(1)(g)',
        });
        optimizedSavings += zakatSavings;
      }

      // UMKM scheme
      if (hasBusinessIncome && businessRevenue > 0 && businessRevenue <= 4800000000) {
        const umkmTax = Math.max(businessRevenue - 500000000, 0) * 0.005;
        const normalTax = calculateTax(Math.max(businessRevenue - ptkp, 0));
        if (umkmTax < normalTax) {
          recommendations.push({
            id: 'umkm', category: 'STRUCTURE',
            title: t('recUmkmTitle'),
            description: t('recUmkmDesc', { revenue: fmtRp(businessRevenue), savings: fmtRp(normalTax - umkmTax) }),
            savings: normalTax - umkmTax, difficulty: 'MEDIUM', legalBasis: 'PP 55/2022',
          });
          optimizedSavings += normalTax - umkmTax;
        }
      }

      // Pension fund
      if (grossIncome > 200000000) {
        recommendations.push({
          id: 'pension', category: 'DEDUCTION',
          title: t('recPensionTitle'),
          description: t('recPensionDesc'),
          savings: Math.round(grossIncome * 0.003), difficulty: 'MEDIUM', legalBasis: 'UU PPh Pasal 6(1)(c)',
        });
        optimizedSavings += recommendations[recommendations.length - 1].savings;
      }

      const optimizedTax = Math.max(currentTax - optimizedSavings, 0);

      setResult({
        currentTax,
        optimizedTax,
        savings: optimizedSavings,
        savingsPercent: currentTax > 0 ? Math.round((optimizedSavings / currentTax) * 100) : 0,
        recommendations: recommendations.sort((a, b) => b.savings - a.savings),
      });
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-700 via-orange-600 to-red-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-amber-200 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />{t('optimizer.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('optimizer.title')}</h1>
          <p className="text-amber-200 mt-2 text-sm">{t('optimizer.subtitle')}</p>
        </div>
      </div>

      {/* Input */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" />{t('optimizer.annualIncome')}</Label>
              <Input type="number" value={grossIncome || ''} onChange={e => setGrossIncome(Number(e.target.value) || 0)} placeholder="0" className="font-mono mt-1" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />{t('optimizer.ptkpStatus')}</Label>
              <Select value={ptkpStatus} onValueChange={setPtkpStatus}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PTKP_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={hasBusinessIncome} onChange={e => setHasBusinessIncome(e.target.checked)} className="rounded" />
              <Building2 className="h-3.5 w-3.5 text-gray-400" />{t('optimizer.hasBusinessIncome')}
            </label>
            {hasBusinessIncome && (
              <Input type="number" value={businessRevenue || ''} onChange={e => setBusinessRevenue(Number(e.target.value) || 0)} placeholder={t('optimizer.businessRevenue')} className="font-mono text-sm w-48" aria-label="Business revenue" />
            )}
          </div>

          <Button onClick={optimize} disabled={isLoading || grossIncome <= 0} className="w-full bg-gradient-to-r from-amber-500 to-orange-600">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t('optimizer.startOptimize')}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Before vs After */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-gray-400">{t('optimizer.currentTax')}</p>
                <p className="font-bold text-lg">{fmtRp(result.currentTax)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" style={{ backgroundColor: '#E6F6F0' }}>
              <CardContent className="p-3 text-center">
                <p
                  className="text-xs flex items-center justify-center gap-1 font-semibold"
                  style={{ color: CHART_ACCENT_POSITIVE }}
                >
                  <TrendingDown className="h-3 w-3" />
                  {t('optimizer.savings')}
                </p>
                <p
                  className="font-bold text-lg"
                  style={{ color: CHART_ACCENT_POSITIVE }}
                >
                  {fmtRp(result.savings)}
                </p>
                {/* Percent reduction in tax — directionally 'tax went down' = good,
                    so up-bad direction with a negative value renders bluish-green. */}
                <div className="flex justify-center mt-0.5">
                  <TrendBadge
                    value={-result.savingsPercent}
                    suffix="%"
                    direction="up-bad"
                    size="text-[10px]"
                    precision={1}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-600">{t('optimizer.optimizedTax')}</p>
                <p className="font-bold text-lg text-blue-700">{fmtRp(result.optimizedTax)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />{t('optimizer.strategies')} ({result.recommendations.length})
              </h3>
              <div className="space-y-3">
                {result.recommendations.map(rec => {
                  const diffStyle = DIFFICULTY_STYLES[rec.difficulty];
                  const diffLabel = DIFFICULTY_LABELS[rec.difficulty];
                  return (
                    <div key={rec.id} className="border rounded-xl p-4 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{rec.category}</Badge>
                          <Badge className="text-[10px]" style={diffStyle}>{diffLabel}</Badge>
                        </div>
                        <TrendBadge
                          value={rec.savings}
                          valueString={fmtRp(rec.savings)}
                          direction="up-good"
                          size="text-sm"
                        />
                      </div>
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{rec.description}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{rec.legalBasis}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
