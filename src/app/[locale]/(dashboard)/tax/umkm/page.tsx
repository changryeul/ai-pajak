'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Store, Calculator, CheckCircle, AlertTriangle, TrendingUp,
  Download, Sparkles, ArrowRight,
} from 'lucide-react';
import { cn, fmtRp } from '@/lib/utils';

const UMKM_RATE = 0.005; // 0.5%
const EXEMPTION = 500_000_000; // Rp 500M (PP 55/2022)
const THRESHOLD = 4_800_000_000; // Rp 4.8B


interface MonthlyData {
  month: number;
  revenue: number;
}

export default function UMKMPage() {
  const t = useTranslations('killer');
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }))
  );
  const [calculated, setCalculated] = useState(false);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const updateRevenue = (month: number, value: number) => {
    setMonthlyData(prev => prev.map(d => d.month === month ? { ...d, revenue: value } : d));
    setCalculated(false);
  };

  // Calculate cumulative and tax
  const calculate = () => setCalculated(true);

  let cumulative = 0;
  const results = monthlyData.map(d => {
    const prevCumulative = cumulative;
    cumulative += d.revenue;

    // Taxable amount after Rp 500M exemption
    let taxableRevenue = 0;
    if (cumulative > EXEMPTION) {
      if (prevCumulative >= EXEMPTION) {
        taxableRevenue = d.revenue;
      } else {
        taxableRevenue = cumulative - EXEMPTION;
      }
    }

    const tax = Math.round(taxableRevenue * UMKM_RATE);

    return {
      ...d,
      cumulative,
      taxableRevenue,
      tax,
      exempt: cumulative <= EXEMPTION,
    };
  });

  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
  const totalTax = results.reduce((s, r) => s + r.tax, 0);
  const totalExempt = Math.min(totalRevenue, EXEMPTION);
  const isEligible = totalRevenue <= THRESHOLD;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-800 via-emerald-700 to-teal-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-green-300 text-sm flex items-center gap-2">
            <Store className="h-4 w-4" />PPh Final UMKM
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('umkm.title')}</h1>
          <p className="text-green-300 mt-2 text-sm">{t('umkm.subtitle')}</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-green-300 text-xs">{t('umkm.taxRate')}</p>
              <p className="font-bold text-xl">0.5%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-green-300 text-xs">{t('umkm.exemptionLimit')}</p>
              <p className="font-bold text-lg">Rp 500M</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-green-300 text-xs">{t('umkm.revenueLimit')}</p>
              <p className="font-bold text-lg">Rp 4.8B</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Input */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-green-600" />{t('umkm.monthlyInput', { year })}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {MONTHS.map((label, i) => (
              <div key={i}>
                <Label className="text-[10px] text-gray-400">{label}</Label>
                <Input
                  type="number"
                  value={monthlyData[i].revenue || ''}
                  onChange={e => updateRevenue(i + 1, Number(e.target.value) || 0)}
                  placeholder="0"
                  className="text-sm font-mono h-9"
                  aria-label={`${label} revenue`}
                />
              </div>
            ))}
          </div>
          <Button onClick={calculate} className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600">
            <Calculator className="h-4 w-4 mr-2" />{t('umkm.calculate')}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {calculated && (
        <div className="space-y-4">
          {/* Eligibility Check */}
          <Card className={cn('border-0 shadow-sm border-l-4', isEligible ? 'border-l-green-500' : 'border-l-red-500')}>
            <CardContent className="p-4 flex items-center gap-3">
              {isEligible ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-bold text-sm text-green-800">{t('umkm.eligible')}</p>
                    <p className="text-xs text-gray-500">{t('umkm.eligibleMsg', { amount: fmtRp(totalRevenue) })}</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="font-bold text-sm text-red-800">{t('umkm.exceeded')}</p>
                    <p className="text-xs text-gray-500">{t('umkm.exceedMsg', { amount: fmtRp(totalRevenue) })}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-gray-400">{t('umkm.totalRevenue')}</p>
                <p className="font-bold text-sm">{fmtRp(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" />{t('umkm.exemption')}
                </p>
                <p className="font-bold text-sm text-green-700">{fmtRp(totalExempt)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-600">{t('umkm.annualTax')}</p>
                <p className="font-bold text-lg text-blue-700">{fmtRp(totalTax)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3">{t('umkm.monthlyDetail')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500">월</th>
                      <th className="text-right py-2 text-gray-500">{t('umkm.revenue')}</th>
                      <th className="text-right py-2 text-gray-500">{t('umkm.cumulative')}</th>
                      <th className="text-right py-2 text-gray-500">{t('umkm.taxableRevenue')}</th>
                      <th className="text-right py-2 text-gray-500">{t('umkm.pphFinal')}</th>
                      <th className="text-center py-2 text-gray-500">{t('umkm.statusLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.filter(r => r.revenue > 0).map(r => (
                      <tr key={r.month} className="border-b last:border-0">
                        <td className="py-2 font-medium">{MONTHS[r.month - 1]}</td>
                        <td className="py-2 text-right font-mono">{fmtRp(r.revenue)}</td>
                        <td className="py-2 text-right font-mono text-gray-400">{fmtRp(r.cumulative)}</td>
                        <td className="py-2 text-right font-mono">{fmtRp(r.taxableRevenue)}</td>
                        <td className="py-2 text-right font-mono font-bold">{fmtRp(r.tax)}</td>
                        <td className="py-2 text-center">
                          {r.exempt ? (
                            <Badge className="text-[9px] bg-green-100 text-green-700">{t('umkm.exempt')}</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-blue-100 text-blue-700">0.5%</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legal Basis */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />{t('umkm.legalBasis')}
              </h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>- **PP 55/2022**: PPh Final UMKM 0.5%, 연 매출 Rp 500M까지 면세</p>
                <p>- **PP 23/2018**: UMKM 정의 (매출 Rp 4.8B 이하)</p>
                <p>- 적용 기간: 개인 7년, PT 3년, CV/Firma/Koperasi 4년</p>
                <p>- 납부 기한: 익월 15일, 신고 기한: 익월 20일</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
