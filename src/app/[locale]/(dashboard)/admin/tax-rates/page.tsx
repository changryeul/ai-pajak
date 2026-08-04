'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings, Save, Loader2, CheckCircle, AlertTriangle,
  TrendingUp, Percent, DollarSign, Shield, Building2, FileText,
  Hammer, ClipboardList, BarChart3,
} from 'lucide-react';

interface TaxRate {
  id: string; category: string; code: string; label: string;
  description?: string; rate_value?: number; amount_value?: number;
  threshold_min?: number; threshold_max?: number;
  legal_basis?: string; effective_date: string; sort_order: number;
}

interface CategoryInfo { code: string; label: string; }

function fmt(n: number | null | undefined) { return n != null ? `Rp ${n.toLocaleString('id-ID')}` : '-'; }
function pct(n: number | null | undefined) { return n != null ? `${(n * 100).toFixed(1)}%` : '-'; }

const categoryIcons: Record<string, typeof TrendingUp> = {
  PPH21_BRACKET: TrendingUp, PPH21_TER_A: BarChart3, PPH21_TER_B: BarChart3, PPH21_TER_C: BarChart3,
  PPH23: Percent, PPH23_SERVICE: ClipboardList, PPH42_CONSTRUCTION: Hammer,
  PTKP: DollarSign, PPN: Percent, PPH_FINAL: Shield, CORPORATE: Building2,
  PPH22: FileText, NPWP_SURCHARGE: AlertTriangle, LIMITS: Settings,
};

export default function TaxRatesAdmin() {
  const t = useTranslations('admin');
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [grouped, setGrouped] = useState<Record<string, TaxRate[]>>({});
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/tax-rates');
      const data = await res.json();
      if (data.success) {
        setRates(data.data.rates);
        setGrouped(data.data.grouped);
        setCategories(data.data.categories);
      }
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const startEdit = (rate: TaxRate) => {
    setEditingId(rate.id);
    setEditValues({
      rateValue: rate.rate_value?.toString() || '',
      amountValue: rate.amount_value?.toString() || '',
      thresholdMin: rate.threshold_min?.toString() || '',
      thresholdMax: rate.threshold_max?.toString() || '',
      label: rate.label,
      legalBasis: rate.legal_basis || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/tax-rates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          rateValue: editValues.rateValue ? parseFloat(editValues.rateValue) : undefined,
          amountValue: editValues.amountValue ? parseFloat(editValues.amountValue) : undefined,
          thresholdMin: editValues.thresholdMin ? parseFloat(editValues.thresholdMin) : undefined,
          thresholdMax: editValues.thresholdMax ? parseFloat(editValues.thresholdMax) : undefined,
          label: editValues.label,
          legalBasis: editValues.legalBasis,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(t('savedSuccess'));
        setTimeout(() => setMessage(null), 3000);
        setEditingId(null);
        loadRates();
      } else {
        setMessage(data.error || t('saveFailed'));
      }
    } catch { setMessage('Error'); }
    finally { setIsSaving(false); }
  };

  const visibleRates = selectedCategory ? (grouped[selectedCategory] || []) : rates;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-orange-200 text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />{t('admin')} - {t('taxConfig')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('taxRatesTitle')}</h1>
          <p className="text-orange-200 mt-2 text-sm">
            {t('taxRatesSubtitle')}
          </p>
        </div>
      </div>

      {/* Success message */}
      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />{message}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setSelectedCategory(null)}
          className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${!selectedCategory ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {t('allCategory')} ({rates.length})
        </button>
        {categories.map(cat => {
          const Icon = categoryIcons[cat.code] || Settings;
          const count = (grouped[cat.code] || []).length;
          if (count === 0) return null;
          return (
            <button key={cat.code} onClick={() => setSelectedCategory(selectedCategory === cat.code ? null : cat.code)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat.code ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Icon className="h-3.5 w-3.5" />{cat.label.split(' - ')[0]} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
      ) : (
        <div className="space-y-3">
          {(selectedCategory ? [selectedCategory] : Object.keys(grouped)).map(catCode => {
            const catInfo = categories.find(c => c.code === catCode);
            const items = grouped[catCode] || [];
            if (items.length === 0) return null;
            const Icon = categoryIcons[catCode] || Settings;

            return (
              <Card key={catCode} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    {catInfo?.label || catCode}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-gray-500 text-xs">
                          <th className="text-left py-2 px-2">{t('code')}</th>
                          <th className="text-left py-2 px-2">{t('description')}</th>
                          <th className="text-right py-2 px-2">{t('rate')}</th>
                          <th className="text-right py-2 px-2">{t('amount')}</th>
                          <th className="text-right py-2 px-2">{t('minThreshold')}</th>
                          <th className="text-right py-2 px-2">{t('maxThreshold')}</th>
                          <th className="text-left py-2 px-2">{t('legalBasis')}</th>
                          <th className="text-center py-2 px-2">{t('action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map(rate => {
                          const isEditing = editingId === rate.id;
                          return (
                            <tr key={rate.id} className={`${isEditing ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                              <td className="py-2 px-2 font-mono text-xs">{rate.code}</td>
                              <td className="py-2 px-2">
                                {isEditing ? (
                                  <Input className="text-xs h-7" value={editValues.label} onChange={e => setEditValues({ ...editValues, label: e.target.value })} />
                                ) : rate.label}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {isEditing ? (
                                  <Input className="text-xs h-7 w-20 ml-auto font-mono" value={editValues.rateValue} onChange={e => setEditValues({ ...editValues, rateValue: e.target.value })} />
                                ) : pct(rate.rate_value)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {isEditing ? (
                                  <Input className="text-xs h-7 w-28 ml-auto font-mono" value={editValues.amountValue} onChange={e => setEditValues({ ...editValues, amountValue: e.target.value })} />
                                ) : fmt(rate.amount_value)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {isEditing ? (
                                  <Input className="text-xs h-7 w-24 ml-auto font-mono" value={editValues.thresholdMin} onChange={e => setEditValues({ ...editValues, thresholdMin: e.target.value })} />
                                ) : fmt(rate.threshold_min)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs">
                                {isEditing ? (
                                  <Input className="text-xs h-7 w-24 ml-auto font-mono" value={editValues.thresholdMax} onChange={e => setEditValues({ ...editValues, thresholdMax: e.target.value })} />
                                ) : fmt(rate.threshold_max)}
                              </td>
                              <td className="py-2 px-2 text-xs text-gray-500">
                                {isEditing ? (
                                  <Input className="text-xs h-7" value={editValues.legalBasis} onChange={e => setEditValues({ ...editValues, legalBasis: e.target.value })} />
                                ) : rate.legal_basis}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {isEditing ? (
                                  <div className="flex gap-1 justify-center">
                                    <Button size="sm" variant="ghost" onClick={saveEdit} disabled={isSaving}>
                                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-green-600" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                      <span className="text-xs text-gray-400">X</span>
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => startEdit(rate)}>
                                    <Settings className="h-3 w-3 text-gray-400" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <div>
          <p className="font-medium">{t('taxRateWarningTitle')}</p>
          <p>{t('taxRateWarningDesc')}</p>
        </div>
      </div>
    </div>
  );
}
