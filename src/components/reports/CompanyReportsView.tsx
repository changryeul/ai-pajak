'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClosingApiRow {
  kind: 'CLOSING';
  sessionId: string;
  fiscalYear: number;
  closingType: 'UMKM' | 'PPH25';
  sessionStatus: string;
  submission: { status: string; bpeNumber: string | null; ntpn: string | null; completedAt: string | null } | null;
  idBilling: { billingCode: string; amount: number; status: string; ntpn: string | null } | null;
}

type Tab = 'monthly' | 'annual' | 'financial' | 'aiRisk';

const TABS: Tab[] = ['monthly', 'annual', 'financial', 'aiRisk'];
const STEP_KEYS: Tab[] = ['monthly', 'annual', 'financial', 'aiRisk'];
const STATUS_KEYS: Tab[] = ['monthly', 'annual', 'financial', 'aiRisk'];

interface ReportRow {
  id: string;
  name: string;
  period: string;
  date: string;
  amount: string;
  summary: string;
  status: 'complete' | 'inProgress' | 'aiReview' | 'signedUploaded';
}

const RISK_ITEMS: ('umkm' | 'benefit' | 'omission' | 'tpDoc')[] = ['umkm', 'benefit', 'omission', 'tpDoc'];

export function CompanyReportsView() {
  const t = useTranslations('reportsPage');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [tab, setTab] = useState<Tab>('aiRisk');
  const [closingReportRows, setClosingReportRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tax/closing-filings', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const rows = ((json?.data ?? []) as ClosingApiRow[]).map((r): ReportRow => {
          const completed = r.submission?.status === 'COMPLETED';
          const paid = r.idBilling?.status === 'PAID';
          const status: ReportRow['status'] = completed ? 'complete' : paid ? 'inProgress' : 'aiReview';
          const amount = r.idBilling?.amount != null
            ? `Rp ${r.idBilling.amount.toLocaleString('id-ID')}`
            : '—';
          const name = r.closingType === 'UMKM'
            ? t('closingReportTitle', { year: r.fiscalYear, type: 'UMKM' })
            : t('closingReportTitle', { year: r.fiscalYear, type: 'PPh25' });
          const summary = r.submission?.bpeNumber
            ? `BPE ${r.submission.bpeNumber} · NTPN ${r.submission.ntpn ?? '—'}`
            : r.idBilling?.billingCode
              ? `ID Billing ${r.idBilling.billingCode}`
              : t('closingInProgress');
          return {
            id: `closing-${r.sessionId}`,
            name,
            period: String(r.fiscalYear),
            date: r.submission?.completedAt?.slice(0, 10) ?? '—',
            amount,
            summary,
            status,
          };
        });
        if (!cancelled) setClosingReportRows(rows);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const counts: Record<Tab, number> = {
    monthly: 1,
    annual: 1 + closingReportRows.length,
    financial: 1,
    aiRisk: 4,
  };

  const rowsByTab: Record<Tab, ReportRow[]> = {
    monthly: [
      {
        id: 'monthly',
        name: t('rows.monthly.name'),
        period: t('rows.monthly.period'),
        date: t('rows.monthly.date'),
        amount: t('rows.monthly.amount'),
        summary: t('rows.monthly.summary'),
        status: 'complete',
      },
    ],
    annual: [
      ...closingReportRows,
      {
        id: 'annual',
        name: t('rows.annual.name'),
        period: t('rows.annual.period'),
        date: t('rows.annual.date'),
        amount: t('rows.annual.amount'),
        summary: t('rows.annual.summary'),
        status: 'aiReview',
      },
    ],
    financial: [
      {
        id: 'financial',
        name: t('rows.financial.name'),
        period: t('rows.financial.period'),
        date: t('rows.financial.date'),
        amount: t('rows.financial.amount'),
        summary: t('rows.financial.summary'),
        status: 'signedUploaded',
      },
    ],
    aiRisk: [
      {
        id: 'aiRisk',
        name: t('rows.aiRisk.name'),
        period: t('rows.aiRisk.period'),
        date: t('rows.aiRisk.date'),
        amount: t('rows.aiRisk.amount'),
        summary: t('rows.aiRisk.summary'),
        status: 'complete',
      },
    ],
  };

  const rows = rowsByTab[tab];

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

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STATUS_KEYS.map((k) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">{t(`statusCards.${k}.title`)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t(`statusCards.${k}.sub`)}</p>
            <p className="text-base font-medium text-slate-700 mt-3">
              {t(`statusCards.${k}.value`, { count: counts[k] })}
            </p>
          </div>
        ))}
      </div>

      {/* Reports card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-base font-bold text-slate-900">{t('reports.title')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('reports.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  tab === tb
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                )}
              >
                {t(`tabs.${tb}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">{t('columns.name')}</th>
                <th className="px-4 py-3">{t('columns.period')}</th>
                <th className="px-4 py-3">{t('columns.status')}</th>
                <th className="px-4 py-3">{t('columns.date')}</th>
                <th className="px-4 py-3">{t('columns.taxAmount')}</th>
                <th className="px-4 py-3">{t('columns.summary')}</th>
                <th className="px-4 py-3 w-44">{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t('emptyRow')}
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="text-sm">
                  <td className="px-4 py-4 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-4 text-slate-700">{row.period}</td>
                  <td className="px-4 py-4">
                    {row.status === 'aiReview' ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {t('statusAiReview')}
                      </span>
                    ) : row.status === 'inProgress' ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t('statusInProgress')}
                      </span>
                    ) : row.status === 'signedUploaded' ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {t('statusSignedUploaded')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {t('statusComplete')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-500 tabular-nums">{row.date}</td>
                  <td className="px-4 py-4 text-slate-500">{row.amount}</td>
                  <td className="px-4 py-4 text-slate-600 max-w-md">{row.summary}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.info(tc('comingSoon'))}>
                        {t('ctaPreview')}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.info(tc('invoiceComing'))}>
                        {t('ctaPdf')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Risk comments — only on aiRisk tab */}
      {tab === 'aiRisk' && (
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <p className="text-base font-bold text-slate-900">{t('aiRisk.title')}</p>
        <div className="space-y-3 mt-5">
          {RISK_ITEMS.map((id) => {
            const level = t(`aiRisk.items.${id}.level`) as 'caution' | 'review' | 'conditional';
            const badgeClass =
              level === 'caution'
                ? 'bg-rose-50 text-rose-700'
                : level === 'review'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-blue-50 text-blue-700';
            return (
              <div key={id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t(`aiRisk.items.${id}.title`)}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t(`aiRisk.items.${id}.body`)}</p>
                  </div>
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0', badgeClass)}>
                    {t(`aiRisk.badges.${level}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Footer note */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
        <p className="text-xs text-slate-600 leading-relaxed">{t('footerNote')}</p>
      </div>
    </div>
  );
}
