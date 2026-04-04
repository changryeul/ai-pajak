'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaxResolutionBadge } from '@/components/invoice/TaxResolutionBadge';
import {
  Loader2, Inbox, Camera, Trash2, FileText, Sparkles, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaxCalculation {
  id: string;
  tax_type: string;
  tax_period: string;
  tax_year: number;
  income_data: {
    recipient_name?: string;
    gross_amount?: number;
    invoice_number?: string;
    invoice_date?: string;
    description?: string;
  };
  calculation_result: {
    taxType?: string;
    taxRate?: number;
    calculatedTax?: number;
    isFinal?: boolean;
    reason?: string;
  };
  source: string;
  created_at: string;
}

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function TaxCalculationsPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [calculations, setCalculations] = useState<TaxCalculation[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/customer/tax-calculations');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.success) {
        setCalculations(data.data || []);
      }
    } catch { /* */ }
    finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/customer/tax-calculations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCalculations(prev => prev.filter(c => c.id !== id));
      }
    } catch { /* */ }
  };

  // Group by period
  const grouped = calculations.reduce<Record<string, TaxCalculation[]>>((acc, c) => {
    (acc[c.tax_period] ??= []).push(c);
    return acc;
  }, {});
  const periods = Object.keys(grouped).sort().reverse();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-teal-300 text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />Draft Calculations
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">초안 계산 목록</h1>
          <p className="text-teal-300 mt-2 text-sm">AI가 분류한 인보이스 초안을 확인하고 관리합니다</p>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-teal-300 text-xs">총 초안</p>
              <p className="font-bold text-lg">{calculations.length}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-teal-300 text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />AI 분류
              </p>
              <p className="font-bold text-lg">{calculations.filter(c => c.source === 'CUSTOMER_OCR').length}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => router.push(`/${locale}/invoice-capture`)} className="bg-gradient-to-r from-purple-500 to-indigo-600">
          <Camera className="h-4 w-4 mr-2" />인보이스 촬영
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : calculations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Inbox className="h-10 w-10 mx-auto mb-3" />
          <p className="text-sm">아직 초안이 없습니다</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/${locale}/invoice-capture`)}
          >
            <Plus className="h-4 w-4 mr-2" />첫 인보이스 촬영하기
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {periods.map(period => (
            <div key={period}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{period}</h3>
              <div className="space-y-2">
                {grouped[period].map(calc => (
                  <Card key={calc.id} className="border-0 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <TaxResolutionBadge
                              taxType={calc.calculation_result?.taxType || calc.tax_type}
                              rate={calc.calculation_result?.taxRate || 0}
                              isFinal={calc.calculation_result?.isFinal}
                            />
                            {calc.source === 'CUSTOMER_OCR' && (
                              <Badge className="text-[10px] bg-purple-100 text-purple-600">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">
                            {calc.income_data?.recipient_name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            {calc.income_data?.invoice_number && (
                              <span>#{calc.income_data.invoice_number}</span>
                            )}
                            <span>{fmtRp(calc.income_data?.gross_amount || 0)}</span>
                            <span>Tax: {fmtRp(calc.calculation_result?.calculatedTax || 0)}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => handleDelete(calc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
