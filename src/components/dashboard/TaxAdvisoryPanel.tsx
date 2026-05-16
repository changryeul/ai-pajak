'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { AlertTriangle, CheckCircle2, Globe, Loader2, Repeat, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

type PkpStatus = 'NOT_APPLICABLE' | 'OK' | 'APPROACHING' | 'EXCEEDED' | 'REGISTERED';
type Regime = 'PPH_FINAL' | 'PPH25' | 'NOT_DETERMINED';
type TreatyStatus = 'NOT_APPLICABLE' | 'OK' | 'REVIEW_NEEDED';

interface AdvisoryResponse {
  success: boolean;
  data?: {
    isCompany: boolean;
    pkp: {
      status: PkpStatus;
      annualRevenueIdr: number;
      thresholdIdr: number;
      pctOfThreshold: number;
      isPkp: boolean;
    };
    umkmTransition: {
      regime: Regime;
      title: string;
      reason: string;
      yearsOperating: number;
      umkmYearsRemaining: number | null;
      warnings: string[];
      transitionUrgent: boolean;
    };
    taxTreaty: {
      status: TreatyStatus;
      pph26TransactionCount: number;
      missingTreatyCount: number;
    };
  };
  error?: string;
}

const PKP_TONE: Record<PkpStatus, { bg: string; text: string; ring: string; iconTone: string }> = {
  NOT_APPLICABLE: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200', iconTone: 'text-slate-400' },
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', iconTone: 'text-emerald-500' },
  APPROACHING: { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-200', iconTone: 'text-amber-500' },
  EXCEEDED: { bg: 'bg-rose-50', text: 'text-rose-800', ring: 'ring-rose-200', iconTone: 'text-rose-500' },
  REGISTERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', iconTone: 'text-emerald-500' },
};

const TREATY_TONE: Record<TreatyStatus, { bg: string; text: string; ring: string; iconTone: string }> = {
  NOT_APPLICABLE: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200', iconTone: 'text-slate-400' },
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', iconTone: 'text-emerald-500' },
  REVIEW_NEEDED: { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-200', iconTone: 'text-amber-500' },
};

function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export function TaxAdvisoryPanel() {
  const t = useTranslations('taxAdvisory');
  const [data, setData] = useState<AdvisoryResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/advisory');
        const json: AdvisoryResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data) {
          setError(json.error || `HTTP ${res.status}`);
        } else {
          setData(json.data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-black text-slate-950">{t('panelTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-black text-slate-950">{t('panelTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{error ?? t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  const { pkp, umkmTransition, taxTreaty } = data;
  const pkpTone = PKP_TONE[pkp.status];
  const treatyTone = TREATY_TONE[taxTreaty.status];
  const regimeUrgent = umkmTransition.transitionUrgent;
  const regimeTone = regimeUrgent
    ? { bg: 'bg-rose-50', text: 'text-rose-800', ring: 'ring-rose-200', iconTone: 'text-rose-500' }
    : umkmTransition.regime === 'NOT_DETERMINED'
      ? { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200', iconTone: 'text-slate-400' }
      : { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', iconTone: 'text-emerald-500' };

  const pkpBarPct = Math.min(100, Math.max(0, pkp.pctOfThreshold));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-black text-slate-950">{t('panelTitle')}</CardTitle>
        <p className="mt-1 text-xs leading-5 text-slate-500">{t('panelDesc')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* PKP */}
        <div className={cn('rounded-2xl p-4 ring-1', pkpTone.bg, pkpTone.ring)}>
          <div className="flex items-start gap-3">
            <Receipt className={cn('h-5 w-5 mt-0.5 shrink-0', pkpTone.iconTone)} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-slate-950">{t('pkpTitle')}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', pkpTone.text)}>
                  {t(`pkp_${pkp.status}`)}
                </span>
              </div>
              {pkp.status === 'NOT_APPLICABLE' ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">{t('pkpNotApplicableHint')}</p>
              ) : (
                <>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className={cn('h-full rounded-full',
                        pkp.status === 'EXCEEDED' ? 'bg-rose-500'
                        : pkp.status === 'APPROACHING' ? 'bg-amber-500'
                        : 'bg-emerald-500')}
                      style={{ width: `${pkpBarPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {t('pkpProgress', {
                      pct: pkp.pctOfThreshold.toString(),
                      revenue: formatIdr(pkp.annualRevenueIdr),
                      threshold: formatIdr(pkp.thresholdIdr),
                    })}
                  </p>
                  {pkp.status === 'EXCEEDED' && !pkp.isPkp && (
                    <p className={cn('mt-2 text-xs font-bold leading-5', pkpTone.text)}>{t('pkpExceededHint')}</p>
                  )}
                  {pkp.status === 'APPROACHING' && (
                    <p className={cn('mt-2 text-xs font-bold leading-5', pkpTone.text)}>{t('pkpApproachingHint')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* UMKM ↔ PPh25 transition */}
        <div className={cn('rounded-2xl p-4 ring-1', regimeTone.bg, regimeTone.ring)}>
          <div className="flex items-start gap-3">
            <Repeat className={cn('h-5 w-5 mt-0.5 shrink-0', regimeTone.iconTone)} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-slate-950">{t('umkmTitle')}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', regimeTone.text)}>
                  {regimeUrgent ? t('umkmStatusUrgent')
                    : umkmTransition.regime === 'NOT_DETERMINED' ? t('umkmStatusUnknown')
                    : t(`umkmRegime_${umkmTransition.regime}`)}
                </span>
              </div>
              {umkmTransition.regime === 'NOT_DETERMINED' ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">{t('umkmNotDeterminedHint')}</p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{umkmTransition.reason}</p>
                  {umkmTransition.umkmYearsRemaining !== null && umkmTransition.umkmYearsRemaining >= 0 && (
                    <p className="mt-2 text-xs font-bold text-slate-700">
                      {t('umkmYearsRemaining', { years: umkmTransition.umkmYearsRemaining.toString() })}
                    </p>
                  )}
                  {umkmTransition.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {umkmTransition.warnings.map((w) => (
                        <li key={w} className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tax Treaty */}
        <div className={cn('rounded-2xl p-4 ring-1', treatyTone.bg, treatyTone.ring)}>
          <div className="flex items-start gap-3">
            <Globe className={cn('h-5 w-5 mt-0.5 shrink-0', treatyTone.iconTone)} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-slate-950">{t('treatyTitle')}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', treatyTone.text)}>
                  {t(`treaty_${taxTreaty.status}`)}
                </span>
              </div>
              {taxTreaty.status === 'NOT_APPLICABLE' ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">{t('treatyNotApplicableHint')}</p>
              ) : taxTreaty.status === 'REVIEW_NEEDED' ? (
                <p className={cn('mt-2 text-xs font-bold leading-5', treatyTone.text)}>
                  {t('treatyReviewNeededHint', { count: taxTreaty.missingTreatyCount.toString() })}
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {t('treatyOkHint', { count: taxTreaty.pph26TransactionCount.toString() })}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
