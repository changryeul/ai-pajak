'use client';

/**
 * Multi-entity dashboard — Phase 1 upgrade.
 *
 * Gives a user who owns multiple PT/CV/individual profiles one screen
 * with:
 *   - Portfolio rollup (4 KPIs: entities, open filings, overdue, YTD tax)
 *   - Upcoming deadlines table (across all entities, next 45 days)
 *   - Per-entity card: filings by status, YTD tax, overdue badge,
 *     quick-nav buttons to 월신고 / ID Billing / 상세
 *   - Comparison table (when 2+ entities)
 *
 * Data: /api/entities returns pre-aggregated stats so this page is a
 * single round-trip.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Building2, FileText, AlertTriangle, CheckCircle, TrendingUp,
  ArrowRight, Plus, BarChart3, Wallet, Clock, CalendarDays,
} from 'lucide-react';
import { cn, fmtRp } from '@/lib/utils';

interface Entity {
  id: string;
  full_name: string;
  company_name: string | null;
  npwp: string | null;
  customer_type: string;
  created_at: string;
  filingCount: number;
  draftCount: number;
  underReviewCount: number;
  filedCount: number;
  filedThisYear: number;
  openQueueCount: number;
  overdueCount: number;
  ytdTax: number;
  soonestDeadline: { date: string; taxType: string; amount: number } | null;
}

interface Rollup {
  totalEntities: number;
  totalFilings: number;
  totalDrafts: number;
  totalUnderReview: number;
  totalFiledThisYear: number;
  totalOverdue: number;
  totalOpenQueue: number;
  totalYtdTax: number;
}

const TYPE_STYLES: Record<string, { bg: string; label: string }> = {
  INDIVIDUAL: { bg: 'from-blue-500 to-indigo-600', label: 'Orang Pribadi' },
  COMPANY: { bg: 'from-emerald-500 to-green-600', label: 'Badan Usaha' },
  CORPORATE: { bg: 'from-emerald-500 to-green-600', label: 'Badan Usaha' },
};

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

export default function MultiEntityPage() {
  const t = useTranslations('killer');
  const tm = useTranslations('multiEntity');
  const { session, isLoading: sessionLoading } = useSession();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/entities');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const payload = data.data || {};
        setEntities((payload.entities || []) as Entity[]);
        setRollup((payload.rollup || null) as Rollup | null);
      }
    } finally {
      setDataLoading(false);
    }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Flatten upcoming deadlines across entities; keep soonest 5
  const upcomingDeadlines = entities
    .filter((e) => e.soonestDeadline)
    .map((e) => ({
      entityId: e.id,
      name: e.company_name || e.full_name,
      ...e.soonestDeadline!,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 5);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />{t('multiEntity.header')}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('multiEntity.title')}</h1>
          <p className="text-slate-400 mt-2 text-sm">{t('multiEntity.subtitle')}</p>
        </div>
      </div>

      {/* Portfolio KPIs */}
      {rollup && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{tm('kpiEntities')}</p>
                  <p className="text-2xl font-bold mt-1">{rollup.totalEntities}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{tm('kpiOpenFilings')}</p>
                  <p className="text-2xl font-bold mt-1">{rollup.totalOpenQueue + rollup.totalUnderReview}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(
            'border-0 shadow-sm',
            rollup.totalOverdue > 0 && 'bg-gradient-to-br from-red-50 to-rose-50 ring-1 ring-red-200',
          )}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn('text-xs', rollup.totalOverdue > 0 ? 'text-red-600' : 'text-gray-500')}>
                    {tm('kpiOverdue')}
                  </p>
                  <p className={cn('text-2xl font-bold mt-1', rollup.totalOverdue > 0 && 'text-red-700')}>
                    {rollup.totalOverdue}
                  </p>
                </div>
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br',
                  rollup.totalOverdue > 0 ? 'from-red-500 to-rose-600' : 'from-slate-400 to-gray-500',
                )}>
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{tm('kpiYtdTax')}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{fmtRp(rollup.totalYtdTax)}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-5">
            <p className="font-semibold text-sm flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-red-500" />
              {tm('upcomingTitle')}
            </p>
            <div className="space-y-2">
              {upcomingDeadlines.map((d, i) => {
                const days = daysUntil(d.date);
                const urgent = days <= 7;
                const overdue = days < 0;
                return (
                  <div
                    key={`${d.entityId}-${i}`}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                      overdue ? 'bg-red-50 text-red-800' : urgent ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge className="bg-white/60 text-current border border-current/30 text-[10px]">
                        {d.taxType}
                      </Badge>
                      <span className="truncate font-medium">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono">{fmtRp(d.amount)}</span>
                      <span className="font-medium">
                        {overdue ? tm('daysOverdue', { n: Math.abs(days) })
                          : days === 0 ? tm('dueToday')
                          : tm('daysLeft', { n: days })}
                      </span>
                      <span className="text-[11px] text-gray-500">{d.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Entity */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => router.push(`/${locale}/customers`)} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />{t('multiEntity.addEntity')}
        </Button>
      </div>

      {/* Entity cards */}
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
        <div className="grid gap-4 md:grid-cols-2">
          {entities.map((entity) => {
            const typeStyle = TYPE_STYLES[entity.customer_type] || TYPE_STYLES.INDIVIDUAL;
            const displayName = entity.company_name || entity.full_name;
            const hasOverdue = entity.overdueCount > 0;
            return (
              <Card
                key={entity.id}
                className={cn(
                  'border-0 shadow-sm overflow-hidden',
                  hasOverdue && 'ring-1 ring-red-200',
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className={cn('w-2 bg-gradient-to-b', typeStyle.bg)} />
                    <div className="flex-1 p-4 space-y-3">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{displayName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge className="bg-gray-100 text-gray-600 text-[10px]">{typeStyle.label}</Badge>
                            {entity.npwp && (
                              <span className="text-[10px] font-mono text-gray-400 truncate">{entity.npwp}</span>
                            )}
                          </div>
                        </div>
                        {hasOverdue && (
                          <Badge className="bg-red-100 text-red-700 text-[10px] shrink-0">
                            {tm('overdueChip', { n: entity.overdueCount })}
                          </Badge>
                        )}
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-[10px] text-gray-500">{tm('draft')}</p>
                          <p className="font-bold text-gray-900">{entity.draftCount}</p>
                        </div>
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-[10px] text-blue-500">{tm('underReview')}</p>
                          <p className="font-bold text-blue-700">{entity.underReviewCount}</p>
                        </div>
                        <div className="bg-emerald-50 rounded p-2">
                          <p className="text-[10px] text-emerald-500">{tm('filedYear')}</p>
                          <p className="font-bold text-emerald-700">{entity.filedThisYear}</p>
                        </div>
                        <div className="bg-amber-50 rounded p-2">
                          <p className="text-[10px] text-amber-500">{tm('openQueue')}</p>
                          <p className="font-bold text-amber-700">{entity.openQueueCount}</p>
                        </div>
                      </div>

                      {/* YTD tax + soonest deadline */}
                      <div className="flex items-center justify-between text-xs border-t pt-2">
                        <div>
                          <p className="text-[10px] text-gray-500">{tm('ytdTax')}</p>
                          <p className="font-semibold font-mono">{fmtRp(entity.ytdTax)}</p>
                        </div>
                        {entity.soonestDeadline && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">{tm('nextDeadline')}</p>
                            <p className={cn(
                              'font-semibold',
                              daysUntil(entity.soonestDeadline.date) < 0 ? 'text-red-600'
                              : daysUntil(entity.soonestDeadline.date) <= 7 ? 'text-amber-600'
                              : 'text-gray-700',
                            )}>
                              {entity.soonestDeadline.taxType} · {entity.soonestDeadline.date}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" asChild>
                          <Link href={`/${locale}/tax/monthly-dashboard?customerId=${entity.id}`}>
                            {tm('actMonthly')}
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" asChild>
                          <Link href={`/${locale}/tax/billing?customerId=${entity.id}`}>
                            {tm('actBilling')}
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-8 px-2" asChild>
                          <Link href={`/${locale}/customers/${entity.id}`}>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison Table (2+ entities) */}
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
                    <th className="text-center py-2 text-gray-500 font-medium">NPWP</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{tm('filings')}</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{tm('openQueue')}</th>
                    <th className="text-center py-2 text-gray-500 font-medium">{tm('overdueHeader')}</th>
                    <th className="text-right py-2 text-gray-500 font-medium">{tm('ytdTax')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity) => (
                    <tr key={entity.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 font-medium">{entity.company_name || entity.full_name}</td>
                      <td className="py-2 text-center font-mono text-gray-400">{entity.npwp || '-'}</td>
                      <td className="py-2 text-center font-bold">{entity.filingCount}</td>
                      <td className="py-2 text-center">{entity.openQueueCount}</td>
                      <td className={cn('py-2 text-center', entity.overdueCount > 0 && 'text-red-600 font-bold')}>
                        {entity.overdueCount}
                      </td>
                      <td className="py-2 text-right font-mono">{fmtRp(entity.ytdTax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2">Total</td>
                    <td></td>
                    <td className="py-2 text-center">{rollup?.totalFilings ?? 0}</td>
                    <td className="py-2 text-center">{rollup?.totalOpenQueue ?? 0}</td>
                    <td className={cn(
                      'py-2 text-center',
                      (rollup?.totalOverdue ?? 0) > 0 && 'text-red-600',
                    )}>
                      {rollup?.totalOverdue ?? 0}
                    </td>
                    <td className="py-2 text-right font-mono">{fmtRp(rollup?.totalYtdTax ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick distribution chart */}
      {entities.length >= 1 && rollup && (
        <Card className="border-0 shadow-sm mt-6">
          <CardContent className="p-5">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              {tm('statusBreakdown')}
            </p>
            <div className="space-y-2 text-xs">
              {[
                { label: tm('draft'), value: rollup.totalDrafts, color: 'bg-gray-400' },
                { label: tm('underReview'), value: rollup.totalUnderReview, color: 'bg-blue-500' },
                { label: tm('filedYear'), value: rollup.totalFiledThisYear, color: 'bg-emerald-500' },
                { label: tm('openQueue'), value: rollup.totalOpenQueue, color: 'bg-amber-500' },
                { label: tm('overdueHeader'), value: rollup.totalOverdue, color: 'bg-red-500' },
              ].map((r) => {
                const total = rollup.totalDrafts + rollup.totalUnderReview + rollup.totalFiledThisYear + rollup.totalOpenQueue;
                const pct = total ? Math.round((r.value / total) * 100) : 0;
                return (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-24 text-gray-600">{r.label}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono">{r.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {session && <span className="sr-only">{session.fullName}</span>}
      <CheckCircle className="hidden" />
      <FileText className="hidden" />
    </div>
  );
}
