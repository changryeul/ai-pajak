'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Building2, FileText, AlertTriangle, CheckCircle,
  TrendingUp, ArrowRight, Plus, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Entity {
  id: string;
  full_name: string;
  company_name: string | null;
  npwp: string | null;
  customer_type: string;
  filing_count: number;
  created_at: string;
}

interface EntityStats {
  entityId: string;
  totalFilings: number;
  draftCount: number;
  submittedCount: number;
  overdueCount: number;
  totalTax: number;
}

function fmtRp(n: number) {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}K`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

const TYPE_STYLES: Record<string, { bg: string; label: string }> = {
  INDIVIDUAL: { bg: 'from-blue-500 to-indigo-600', label: 'Orang Pribadi' },
  CORPORATE: { bg: 'from-emerald-500 to-green-600', label: 'Badan Usaha' },
  CV: { bg: 'from-amber-500 to-orange-500', label: 'CV' },
  PT: { bg: 'from-purple-500 to-violet-600', label: 'PT' },
};

export default function MultiEntityPage() {
  const t = useTranslations('killer');
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [stats, setStats] = useState<Record<string, EntityStats>>({});
  const [dataLoading, setDataLoading] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/entities');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.success) {
        setEntities(data.data || []);
      }
    } catch { /* */ }
    finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate totals
  const totalEntities = entities.length;
  const totalFilings = entities.reduce((sum, e) => sum + (e.filing_count || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />{t('multiEntity.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('multiEntity.title')}</h1>
          <p className="text-slate-400 mt-2 text-sm">{t('multiEntity.subtitle')}</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs">{t('multiEntity.registered')}</p>
              <p className="font-bold text-lg">{totalEntities}개</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs">{t('multiEntity.totalFilings')}</p>
              <p className="font-bold text-lg">{totalFilings}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />{t('multiEntity.status')}
              </p>
              <p className="font-bold text-lg text-green-400">{t('multiEntity.normal')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Entity */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => router.push(`/${locale}/customers`)} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />{t('multiEntity.addEntity')}
        </Button>
      </div>

      {/* Entity List */}
      {isLoading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : entities.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center text-gray-400">
            <Building2 className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm">{t('multiEntity.empty')}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push(`/${locale}/customers`)}>
              <Plus className="h-4 w-4 mr-2" />{t('multiEntity.firstEntity')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entities.map(entity => {
            const typeStyle = TYPE_STYLES[entity.customer_type] || TYPE_STYLES.INDIVIDUAL;
            const displayName = entity.company_name || entity.full_name;

            return (
              <Card key={entity.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => router.push(`/${locale}/customers/${entity.id}`)}>
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Type indicator */}
                    <div className={`w-2 bg-gradient-to-b ${typeStyle.bg} rounded-l-lg`} />

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">{displayName}</h3>
                            <Badge className="text-[10px] bg-gray-100 text-gray-600">{typeStyle.label}</Badge>
                          </div>
                          {entity.npwp && (
                            <p className="text-xs text-gray-400 font-mono">{entity.npwp}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Filing stats */}
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3 text-gray-400" />
                              <span className="text-sm font-bold">{entity.filing_count || 0}</span>
                              <span className="text-xs text-gray-400">{t('multiEntity.filings')}</span>
                            </div>
                          </div>

                          <ArrowRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </div>

                      {/* Quick status indicators */}
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-green-50 text-green-600 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <CheckCircle className="h-2.5 w-2.5" />{t('multiEntity.sptNormal')}
                        </span>
                        {entity.filing_count === 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />{t('multiEntity.noFilings')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison Table (if 2+ entities) */}
      {entities.length >= 2 && (
        <Card className="border-0 shadow-sm mt-6">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />{t('multiEntity.comparison')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500 font-medium">{t('multiEntity.entityName')}</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{t('multiEntity.type')}</th>
                    <th className="text-center py-2 text-gray-500 font-medium">NPWP</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{t('multiEntity.filingCount')}</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{t('multiEntity.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map(entity => {
                    const typeStyle = TYPE_STYLES[entity.customer_type] || TYPE_STYLES.INDIVIDUAL;
                    return (
                      <tr key={entity.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 font-medium">{entity.company_name || entity.full_name}</td>
                        <td className="py-2 text-center">
                          <Badge className="text-[9px]" variant="outline">{typeStyle.label}</Badge>
                        </td>
                        <td className="py-2 text-center font-mono text-gray-400">{entity.npwp || '-'}</td>
                        <td className="py-2 text-center font-bold">{entity.filing_count || 0}</td>
                        <td className="py-2 text-center">
                          <Badge className={cn('text-[9px]', entity.filing_count > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                            {entity.filing_count > 0 ? t('multiEntity.active') : t('multiEntity.waiting')}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
