'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Loader2, Save, DollarSign, Users, Zap,
  MessageCircle, FileText, ShieldCheck, TrendingUp, AlertTriangle,
  Brain, Camera, BarChart3,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LimitItem {
  type: string; label: string; maxRequests: number;
  windowMs: number; window: string; costPerCall: number;
  estimatedMonthlyCost: number;
}

const typeIcons: Record<string, typeof Sparkles> = {
  chatbot: MessageCircle, ocr: Camera, report: FileText,
  savings: TrendingUp, validation: ShieldCheck, anomaly: AlertTriangle,
  general: Brain,
};

export default function AIUsagePage() {
  const t = useTranslations('aiUsage');
  const [limits, setLimits] = useState<LimitItem[]>([]);
  const [summary, setSummary] = useState<{ activeUsers: number; totalMonthlyCostEstimate: number } | null>(null);
  const [actual, setActual] = useState<{
    monthly: { totalCost: number; totalTokens: number; totalCalls: number; byFeature: Record<string, { calls: number; tokens: number; cost: number; errors: number }> };
    today: { totalCost: number; totalCalls: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/ai-usage');
      const data = await res.json();
      if (data.success) { setLimits(data.data.limits); setSummary(data.data.summary); if (data.data.actual) setActual(data.data.actual); }
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  const saveLimit = async (type: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/ai-usage', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, maxRequests: parseInt(editValue) }),
      });
      const data = await res.json();
      setMessage(data.message || 'Updated');
      setTimeout(() => setMessage(null), 3000);
      setEditingType(null);
      loadData();
    } catch { /* */ }
    finally { setIsSaving(false); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-violet-200 text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />Admin</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">AI Usage & Rate Limits</h1>
          <p className="text-violet-200 text-sm mt-1">{t('subtitle')}</p>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                <p className="text-xs text-violet-300">{t('activeUsers')}</p>
                <p className="text-xl font-bold">{summary.activeUsers}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                <p className="text-xs text-violet-300">{t('estMonthlyCost')}</p>
                <p className="text-xl font-bold">${summary.totalMonthlyCostEstimate}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-yellow-400/30">
                <p className="text-xs text-yellow-300">이번 달 실제 비용</p>
                <p className="text-xl font-bold text-yellow-300">${actual?.monthly.totalCost.toFixed(4) || '0'}</p>
                <p className="text-[10px] text-violet-300">{actual?.monthly.totalCalls || 0}회 호출</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                <p className="text-xs text-violet-300">오늘 비용</p>
                <p className="text-xl font-bold">${actual?.today.totalCost.toFixed(4) || '0'}</p>
                <p className="text-[10px] text-violet-300">{actual?.today.totalCalls || 0}회 호출</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />{message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" /></div>
      ) : (
        <div className="space-y-3">
          {limits.map(limit => {
            const Icon = typeIcons[limit.type] || Sparkles;
            const isEditing = editingType === limit.type;
            const windowLabel = limit.window === 'hour' ? t('perHour') : t('perDay');

            return (
              <Card key={limit.type} className="border-0 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                      <Icon className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{limit.label}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="w-20 h-8 text-sm font-mono"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              min={1} max={1000}
                            />
                            <span className="text-xs text-gray-500">{windowLabel}{t('perUser')}</span>
                            <Button size="sm" className="h-8" onClick={() => saveLimit(limit.type)} disabled={isSaving}>
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingType(null)}>
                              {t('cancelBtn')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Badge className="bg-purple-100 text-purple-700 font-mono">
                              {limit.maxRequests}{windowLabel}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              ${limit.costPerCall}{t('perCall')}
                            </span>
                            <button
                              onClick={() => { setEditingType(limit.type); setEditValue(limit.maxRequests.toString()); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {t('change')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${limit.estimatedMonthlyCost}</p>
                      <p className="text-[10px] text-gray-400">{t('estMonthly')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cost Breakdown */}
      {!isLoading && limits.length > 0 && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-purple-600" />{t('costBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {limits.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost).map(l => {
                const maxCost = Math.max(...limits.map(x => x.estimatedMonthlyCost));
                const width = maxCost > 0 ? (l.estimatedMonthlyCost / maxCost) * 100 : 0;
                return (
                  <div key={l.type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 truncate">{l.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-violet-500 to-purple-600 h-2 rounded-full transition-all" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-xs font-mono text-gray-700 w-16 text-right">${l.estimatedMonthlyCost}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              {t('costNote')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actual Usage by Feature */}
      {actual && Object.keys(actual.monthly.byFeature).length > 0 && (
        <Card className="mt-6 border-0 shadow-sm border-l-4 border-l-yellow-400">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />이번 달 실제 사용량
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500 font-medium">기능</th>
                    <th className="text-right py-2 text-gray-500 font-medium">호출</th>
                    <th className="text-right py-2 text-gray-500 font-medium">토큰</th>
                    <th className="text-right py-2 text-gray-500 font-medium">비용 (USD)</th>
                    <th className="text-right py-2 text-gray-500 font-medium">에러</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(actual.monthly.byFeature)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([feature, data]) => (
                      <tr key={feature} className="border-b last:border-0">
                        <td className="py-2 font-medium">{feature}</td>
                        <td className="py-2 text-right font-mono">{data.calls}</td>
                        <td className="py-2 text-right font-mono text-gray-400">{data.tokens.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono font-bold">${data.cost.toFixed(4)}</td>
                        <td className="py-2 text-right">
                          {data.errors > 0 ? (
                            <Badge className="text-[10px] bg-red-100 text-red-600">{data.errors}</Badge>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  <tr className="border-t-2 font-bold">
                    <td className="py-2">합계</td>
                    <td className="py-2 text-right font-mono">{actual.monthly.totalCalls}</td>
                    <td className="py-2 text-right font-mono text-gray-400">{actual.monthly.totalTokens.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-yellow-600">${actual.monthly.totalCost.toFixed(4)}</td>
                    <td className="py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <div>
          <p className="font-medium">{t('warningTitle')}</p>
          <p>{t('warningText')}</p>
        </div>
      </div>
    </div>
  );
}
