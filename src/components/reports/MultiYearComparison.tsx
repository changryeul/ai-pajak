'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
} from 'lucide-react';

interface YearData {
  year: number;
  grossIncome: number;
  netIncome: number;
  deductions: number;
  ptkp: number;
  taxableIncome: number;
  taxDue: number;
  taxWithheld: number;
  status: string;
  filingCount: number;
  employers: string[];
  effectiveRate: number;
}

interface ComparisonData {
  years: YearData[];
  changes: Array<{
    fromYear: number;
    toYear: number;
    grossIncomeChange: number;
    grossIncomeChangePercent: number;
    taxDueChange: number;
    taxDueChangePercent: number;
    effectiveRateChange: number;
  }> | null;
  insights: string[];
}

interface MultiYearComparisonProps {
  customerId?: string;
}

function fmt(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function fmtShort(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${n}`;
}

function ChangeIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus className="h-3 w-3" />0{suffix}</span>;
  if (value > 0) return <span className="text-red-500 text-xs flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+{value.toFixed(1)}{suffix}</span>;
  return <span className="text-green-500 text-xs flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />{value.toFixed(1)}{suffix}</span>;
}

export function MultiYearComparison({ customerId }: MultiYearComparisonProps) {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear - 1, currentYear - 2]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonData | null>(null);

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year)
        ? prev.filter((y) => y !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const loadComparison = useCallback(async () => {
    if (selectedYears.length < 2) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        years: selectedYears.join(','),
        ...(customerId && { customerId }),
      });
      const response = await fetch(`/api/reports/comparison?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to load');
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYears, customerId]);

  return (
    <div className="space-y-6">
      {/* Year Selection */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Perbandingan Pajak Multi-Tahun
          </CardTitle>
          <CardDescription>
            Pilih 2-4 tahun untuk membandingkan data perpajakan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedYears.includes(year)
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
          )}

          <Button
            onClick={loadComparison}
            disabled={isLoading || selectedYears.length < 2}
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memuat...</>
            ) : (
              <><BarChart3 className="h-4 w-4 mr-2" />Bandingkan {selectedYears.length} Tahun</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.years.sort((a, b) => b.year - a.year).map((yr) => {
              const change = data.changes?.find((c) => c.toYear === yr.year);
              return (
                <Card key={yr.year} className="border-0 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-gray-900">{yr.year}</span>
                      <Badge className={
                        yr.status === 'NIHIL' ? 'bg-green-100 text-green-700' :
                        yr.status === 'KURANG_BAYAR' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }>
                        {yr.status === 'NIHIL' ? 'Nihil' : yr.status === 'KURANG_BAYAR' ? 'Kurang Bayar' : 'Lebih Bayar'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bruto</span>
                        <span className="font-mono font-medium">{fmtShort(yr.grossIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">PPh</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{fmtShort(yr.taxDue)}</span>
                          {change && <ChangeIndicator value={change.taxDueChangePercent} suffix="%" />}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tarif Efektif</span>
                        <span className="font-mono">{(yr.effectiveRate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Comparison Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Detail Perbandingan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 text-gray-500 font-medium">Item</th>
                      {data.years.sort((a, b) => b.year - a.year).map((yr) => (
                        <th key={yr.year} className="text-right py-3 px-3 font-bold">{yr.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { label: 'Penghasilan Bruto', key: 'grossIncome' },
                      { label: 'Pengurang', key: 'deductions' },
                      { label: 'Penghasilan Neto', key: 'netIncome' },
                      { label: 'PTKP', key: 'ptkp' },
                      { label: 'PKP', key: 'taxableIncome' },
                      { label: 'PPh Terutang', key: 'taxDue' },
                      { label: 'PPh Dipotong', key: 'taxWithheld' },
                    ].map((row) => (
                      <tr key={row.key} className={row.key === 'taxDue' ? 'bg-blue-50/50 font-medium' : ''}>
                        <td className="py-2.5 px-3 text-gray-600">{row.label}</td>
                        {data.years.sort((a, b) => b.year - a.year).map((yr) => (
                          <td key={yr.year} className="py-2.5 px-3 text-right font-mono">
                            {fmt((yr as unknown as Record<string, number>)[row.key] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold">
                      <td className="py-2.5 px-3 text-gray-900">Tarif Efektif</td>
                      {data.years.sort((a, b) => b.year - a.year).map((yr) => (
                        <td key={yr.year} className="py-2.5 px-3 text-right font-mono">
                          {(yr.effectiveRate * 100).toFixed(2)}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-gray-600">Jumlah Pemberi Kerja</td>
                      {data.years.sort((a, b) => b.year - a.year).map((yr) => (
                        <td key={yr.year} className="py-2.5 px-3 text-right">
                          {yr.employers.length || '-'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Changes */}
          {data.changes && data.changes.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Perubahan Tahun ke Tahun</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.changes.map((change) => (
                    <div key={`${change.fromYear}-${change.toYear}`} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
                      <div className="text-center">
                        <span className="text-sm font-bold text-gray-900">{change.fromYear}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-sm font-bold text-gray-900">{change.toYear}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Penghasilan</p>
                          <div className="flex items-center gap-1">
                            {change.grossIncomeChangePercent > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : change.grossIncomeChangePercent < 0 ? (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium ${change.grossIncomeChangePercent > 0 ? 'text-green-600' : change.grossIncomeChangePercent < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {change.grossIncomeChangePercent > 0 ? '+' : ''}{change.grossIncomeChangePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">PPh Terutang</p>
                          <div className="flex items-center gap-1">
                            {change.taxDueChangePercent > 0 ? (
                              <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : change.taxDueChangePercent < 0 ? (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium ${change.taxDueChangePercent > 0 ? 'text-red-600' : change.taxDueChangePercent < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              {change.taxDueChangePercent > 0 ? '+' : ''}{change.taxDueChangePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Tarif Efektif</p>
                          <span className={`text-sm font-medium ${change.effectiveRateChange > 0 ? 'text-red-600' : change.effectiveRateChange < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {change.effectiveRateChange > 0 ? '+' : ''}{(change.effectiveRateChange * 100).toFixed(2)}pp
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Insights */}
          {data.insights.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-yellow-400">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Insight
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default MultiYearComparison;
