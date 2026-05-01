'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEP_KEYS: ('monthlyFee' | 'annualFee' | 'prepayment' | 'receipt')[] = [
  'monthlyFee', 'annualFee', 'prepayment', 'receipt',
];

type PlanId = 'umkm' | 'basic' | 'pro' | 'enterprise';
type AnnualPlanId = 'none' | 'umkm' | 'pph25' | 'complex';

const PLAN_IDS: PlanId[] = ['umkm', 'basic', 'pro', 'enterprise'];
const ANNUAL_PLAN_IDS: AnnualPlanId[] = ['none', 'umkm', 'pph25', 'complex'];

const PLAN_BG: Record<PlanId, string> = {
  umkm: 'bg-white border-slate-200',
  basic: 'bg-blue-50 border-blue-300 ring-1 ring-blue-200',
  pro: 'bg-white border-slate-200',
  enterprise: 'bg-white border-slate-200',
};

const ENTERPRISE_FEE_KEYS: ('employee' | 'withholding' | 'apar' | 'docs')[] = [
  'employee', 'withholding', 'apar', 'docs',
];

export function CompanyBillingView() {
  const t = useTranslations('billingPage');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('basic');
  const [selectedAnnual, setSelectedAnnual] = useState<AnnualPlanId>('umkm');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('pageTitle')}</h1>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/dashboard`)}>
          {t('backToDashboard')}
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {t('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {t(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-6">
        <p className="text-sm font-bold text-amber-900">{t('notice.title')}</p>
        <p className="text-sm text-amber-800 mt-1">{t('notice.body')}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(['monthly', 'paid', 'annual', 'total'] as const).map((k) => {
          const sub =
            k === 'paid' && billingCycle === 'annual'
              ? t('statusCards.paid.subAnnual')
              : t(`statusCards.${k}.sub`);
          const value =
            k === 'paid' && billingCycle === 'annual'
              ? t('statusCards.paid.valueAnnual')
              : k === 'total' && billingCycle === 'annual'
              ? t('statusCards.total.valueAnnual')
              : t(`statusCards.${k}.value`);
          return (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{t(`statusCards.${k}.title`)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              <p className="text-base font-medium text-slate-700 mt-3">{value}</p>
            </div>
          );
        })}
      </div>

      {/* Monthly plan selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-base font-bold text-slate-900">{t('monthlyPlans.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('monthlyPlans.subtitle')}</p>

        <div className="inline-flex items-center rounded-lg border border-slate-200 p-1 mt-4">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              billingCycle === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t('monthlyPlans.toggleMonthly')}
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              billingCycle === 'annual' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t('monthlyPlans.toggleAnnual')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {PLAN_IDS.map((p) => {
            const isSelected = selectedPlan === p;
            const bg = isSelected
              ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
              : PLAN_BG[p];
            const criteria = t.raw(`monthlyPlans.plans.${p}.criteria`) as string[];
            const features = t.raw(`monthlyPlans.plans.${p}.features`) as string[];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className={cn(
                  'flex flex-col rounded-xl border p-5 text-left transition-shadow hover:shadow-sm',
                  bg
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">{t(`monthlyPlans.plans.${p}.name`)}</p>
                    <p className="text-xs text-slate-500 mt-1">{t(`monthlyPlans.plans.${p}.sub`)}</p>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white shrink-0">
                      {t('monthlyPlans.selected')}
                    </span>
                  )}
                </div>

                {billingCycle === 'annual' ? (
                  <>
                    <p className="text-xl font-bold text-slate-900 mt-4">{t(`monthlyPlans.plans.${p}.annualPrice`)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('monthlyPlans.annualTerm')}</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{t('monthlyPlans.breakdown.original')}</span>
                        <span className="text-slate-700 tabular-nums">{t(`monthlyPlans.plans.${p}.priceOriginal`)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{t('monthlyPlans.breakdown.discounted')}</span>
                        <span className="text-slate-700 tabular-nums">{t(`monthlyPlans.plans.${p}.priceDiscounted`)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-700">{t('monthlyPlans.breakdown.savings')}</span>
                        <span className="text-emerald-700 font-medium tabular-nums">{t(`monthlyPlans.plans.${p}.annualSavings`)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-slate-900 mt-4">{t(`monthlyPlans.plans.${p}.price`)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t(`monthlyPlans.plans.${p}.term`)}</p>
                  </>
                )}

                <div className="rounded-lg border border-slate-200 bg-white/60 p-3 mt-4">
                  <p className="text-xs font-semibold text-slate-700">{t('monthlyPlans.criteria')}</p>
                  <ul className="space-y-1 mt-2">
                    {criteria.map((c) => (
                      <li key={c} className="text-xs text-slate-600">· {c}</li>
                    ))}
                  </ul>
                </div>

                <ul className="space-y-1 mt-4">
                  {features.map((f) => (
                    <li key={f} className="text-xs text-slate-700">✓ {f}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pro+ value comparison */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-6 mt-6">
        <p className="text-base font-bold text-slate-900">{t('proValue.title')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {(['consulting', 'pro', 'enterprise'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900">{t(`proValue.columns.${k}.title`)}</p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t(`proValue.columns.${k}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-4 leading-relaxed">{t('proValue.footer')}</p>
      </div>

      {/* Enterprise base + overage */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 mt-6">
        <p className="text-base font-bold text-slate-900">{t('enterpriseFees.title')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {ENTERPRISE_FEE_KEYS.map((k) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900">{t(`enterpriseFees.items.${k}.title`)}</p>
              <p className="text-xs text-slate-500 mt-2">{t(`enterpriseFees.items.${k}.base`)}</p>
              <p className="text-xs font-medium text-slate-700 mt-1">{t(`enterpriseFees.items.${k}.overage`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Annual plan selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
        <p className="text-base font-bold text-slate-900">{t('annualPlans.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('annualPlans.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {ANNUAL_PLAN_IDS.map((p) => {
            const isSelected = selectedAnnual === p;
            const bg = isSelected
              ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200'
              : 'bg-white border-slate-200';
            const criteria = t.raw(`annualPlans.plans.${p}.criteria`) as string[];
            const features = t.raw(`annualPlans.plans.${p}.features`) as string[];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedAnnual(p)}
                className={cn(
                  'flex flex-col rounded-xl border p-5 text-left transition-shadow hover:shadow-sm',
                  bg
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">{t(`annualPlans.plans.${p}.name`)}</p>
                    <p className="text-xs text-slate-500 mt-1">{t(`annualPlans.plans.${p}.sub`)}</p>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white shrink-0">
                      {t('annualPlans.selected')}
                    </span>
                  )}
                </div>

                <p className="text-xl font-bold text-slate-900 mt-4">{t(`annualPlans.plans.${p}.price`)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t(`annualPlans.plans.${p}.term`)}</p>

                <div className="rounded-lg border border-slate-200 bg-white/60 p-3 mt-4">
                  <p className="text-xs font-semibold text-slate-700">{t('annualPlans.criteria')}</p>
                  <ul className="space-y-1 mt-2">
                    {criteria.map((c) => (
                      <li key={c} className="text-xs text-slate-600">· {c}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/60 p-3 mt-3">
                  <p className="text-xs font-semibold text-slate-700">{t('annualPlans.contents')}</p>
                  <ul className="space-y-1 mt-2">
                    {features.map((f) => (
                      <li key={f} className="text-xs text-slate-700">✓ {f}</li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        {/* Annual notice */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 mt-5">
          <p className="text-sm font-bold text-slate-900">{t('annualNotice.title')}</p>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('annualNotice.body1')}</p>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('annualNotice.body2')}</p>
        </div>
      </div>

      {/* Payment + summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* Payment method */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-base font-bold text-slate-900">{t('payment.method.title')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('payment.method.subtitle')}</p>

          <div className="rounded-lg border border-slate-200 p-4 mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t('payment.method.cardName')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('payment.method.cardDetail')}</p>
              </div>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 shrink-0">
                {t('payment.method.defaultBadge')}
              </span>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 mt-4 cursor-pointer">
            <span className="text-sm text-slate-700">{t('payment.method.autoLabel')}</span>
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          </label>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => toast.info(tc('methodComing'))}
            >
              {t('payment.method.changeCta')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info(tc('payComing'))}
            >
              {t('payment.method.manualCta')}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-base font-bold text-slate-900">{t('payment.summary.title')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('payment.summary.subtitle')}</p>

          <div className="mt-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-slate-700">{t('payment.summary.monthlyLabel')}</p>
              <p className="text-sm font-medium text-slate-900 tabular-nums">
                {billingCycle === 'annual'
                  ? t('payment.summary.monthlyAmountAnnual')
                  : t('payment.summary.monthlyAmount')}
              </p>
            </div>
            {billingCycle === 'annual' ? (
              <div className="space-y-1.5 pl-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('payment.summary.breakdown.originalLabel')}</span>
                  <span className="text-slate-700 tabular-nums">{t('payment.summary.breakdown.originalAmount')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('payment.summary.breakdown.discountedLabel')}</span>
                  <span className="text-slate-700 tabular-nums">{t('payment.summary.breakdown.discountedAmount')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('payment.summary.breakdown.annualTotalLabel')}</span>
                  <span className="text-slate-700 tabular-nums">{t('payment.summary.breakdown.annualTotalAmount')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700">{t('payment.summary.breakdown.savingsLabel')}</span>
                  <span className="text-emerald-700 font-medium tabular-nums">{t('payment.summary.breakdown.savingsAmount')}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 pl-2">{t('payment.summary.monthlyTerm')}</p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">{t('payment.summary.annualLabel')}</p>
              <p className="text-sm font-medium text-slate-900 tabular-nums">{t('payment.summary.annualAmount')}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">{t('payment.summary.ppnLabel')}</p>
              <p className="text-sm text-slate-500">{t('payment.summary.ppnAmount')}</p>
            </div>
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{t('payment.summary.totalLabel')}</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">
                {billingCycle === 'annual'
                  ? t('payment.summary.totalAmountAnnual')
                  : t('payment.summary.totalAmount')}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 px-4 py-3 mt-4">
            <p className="text-xs text-slate-600 leading-relaxed">{t('payment.summary.notice')}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info(tc('quoteComing'))}
            >
              {t('payment.summary.quoteCta')}
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => toast.info(tc('payComing'))}
            >
              {t('payment.summary.payCta')}
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice / payment history */}
      <InvoiceHistory />
    </div>
  );
}

const INVOICE_ROWS: ('basic' | 'umkm')[] = ['basic', 'umkm'];

function InvoiceHistory() {
  const t = useTranslations('billingPage.invoices');
  const tc = useTranslations('common');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{t('title')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => toast.info(tc('invoiceComing'))}>
          {t('downloadAll')}
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">{t('columns.number')}</th>
              <th className="px-4 py-3">{t('columns.date')}</th>
              <th className="px-4 py-3">{t('columns.item')}</th>
              <th className="px-4 py-3">{t('columns.amount')}</th>
              <th className="px-4 py-3">{t('columns.status')}</th>
              <th className="px-4 py-3">{t('columns.method')}</th>
              <th className="px-4 py-3 w-28">{t('columns.receipt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {INVOICE_ROWS.map((row) => (
              <tr key={row} className="text-sm">
                <td className="px-4 py-4 font-medium text-slate-900 tabular-nums">{t(`rows.${row}.number`)}</td>
                <td className="px-4 py-4 text-slate-700 tabular-nums">{t(`rows.${row}.date`)}</td>
                <td className="px-4 py-4 text-slate-700">{t(`rows.${row}.item`)}</td>
                <td className="px-4 py-4 text-slate-900 tabular-nums">{t(`rows.${row}.amount`)}</td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {t('statusPaid')}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-700">{t(`rows.${row}.method`)}</td>
                <td className="px-4 py-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => toast.info(tc('invoiceComing'))}
                  >
                    {t('downloadCta')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
