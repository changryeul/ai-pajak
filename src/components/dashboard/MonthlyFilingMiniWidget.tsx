'use client';

/**
 * 대시보드 미니 위젯 — 이번 달 신고 보드 요약 (2026-08-30).
 * 세목 4칩(현재 단계) + 가장 급한 납부 D-day. 클릭 시 보드로 이동.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react';
import { PAY_DAY, TAX_COLOR, deadlineOf, ddayText, defaultFilingPeriod } from '@/lib/tax/monthly-board-shared';

interface TaxState {
  key: keyof typeof PAY_DAY;
  applicable: boolean;
  doneThrough: number;
  currentStep: number | null;
}

const STEP_KEYS = ['stepData', 'stepReview', 'stepApprove', 'stepBilling', 'stepPay'] as const;

export function MonthlyFilingMiniWidget({ customerId, locale }: { customerId: string; locale: string }) {
  const t = useTranslations('monthlyBoard');
  const [taxes, setTaxes] = useState<TaxState[] | null>(null);
  const period = defaultFilingPeriod();

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/tax/monthly-board?period=${period}&customerId=${customerId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setTaxes(j.data.taxes as TaxState[]); })
      .catch(() => {});
  }, [customerId, period]);

  if (!taxes) return null;

  const active = taxes.filter(x => x.applicable);
  const pending = active.filter(x => x.doneThrough < 5);
  // 가장 급한 마감 = 미완료 세목 중 최솟값
  const worst = pending
    .map(x => ddayText(deadlineOf(period, PAY_DAY[x.key])))
    .sort((a, b) => (a.passed ? -1 : 1) - (b.passed ? -1 : 1) || (a.urgent ? -1 : 1) - (b.urgent ? -1 : 1))[0] ?? null;

  return (
    <Link href={`/${locale}/tax/monthly-board`} className="block group">
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden transition-shadow group-hover:shadow-md">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{t('title')} · {period}</p>
              <p className="text-xs text-gray-500">
                {pending.length === 0 ? t('allDone') : t('miniPendingCount', { n: pending.length })}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {worst && pending.length > 0 && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${worst.passed ? 'bg-red-100 text-red-700' : worst.urgent ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  <CalendarClock className="h-3 w-3" />{t('payBy')} {worst.text}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
            </div>
          </div>

          {/* 세목 4칩 — 현재 단계 */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {taxes.map(x => {
              const done = x.doneThrough >= 5;
              const stepLabel = !x.applicable ? t('notApplicable')
                : done ? t('allDone')
                : t(STEP_KEYS[(x.currentStep ?? 1) - 1]);
              return (
                <div key={x.key} className={`flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 ${!x.applicable ? 'opacity-50' : ''}`}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TAX_COLOR[x.key] }} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{t(`mini_${x.key}`)}</p>
                    <p className={`text-[10px] truncate flex items-center gap-0.5 ${done ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                      {done && <CheckCircle2 className="h-3 w-3" />}{stepLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
