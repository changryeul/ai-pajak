'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tab = 'systems' | 'sync' | 'mapping' | 'logs';
type CardStatus = 'ready' | 'disconnected' | 'available';

interface IntegrationCard {
  id: 'coretax' | 'accurate' | 'jurnal' | 'banking' | 'excel';
  status: CardStatus;
  bgClass: string;
  textClass?: string;
  cta: 'connect' | 'manage';
  href?: string;
  hasExtraBadge?: boolean;
  hasSubtitle?: boolean;
}

const STEP_KEYS: ('coretax' | 'accounting' | 'banking' | 'sync')[] = [
  'coretax', 'accounting', 'banking', 'sync',
];

const STATUS_CARD_KEYS: ('coretax' | 'accounting' | 'banking' | 'excel')[] = [
  'coretax', 'accounting', 'banking', 'excel',
];

const TAB_KEYS: Tab[] = ['systems', 'sync', 'mapping', 'logs'];

const CARDS: IntegrationCard[] = [
  {
    id: 'coretax',
    status: 'ready',
    bgClass: 'bg-slate-900',
    textClass: 'text-white',
    cta: 'connect',
    hasExtraBadge: true,
    hasSubtitle: true,
  },
  {
    id: 'accurate',
    status: 'disconnected',
    bgClass: 'bg-blue-600',
    textClass: 'text-white',
    cta: 'connect',
    href: '/settings/accurate?provider=ACCURATE',
  },
  {
    id: 'jurnal',
    status: 'disconnected',
    bgClass: 'bg-emerald-600',
    textClass: 'text-white',
    cta: 'connect',
    href: '/settings/accurate?provider=MEKARI',
  },
  {
    id: 'banking',
    status: 'disconnected',
    bgClass: 'bg-orange-500',
    textClass: 'text-white',
    cta: 'connect',
    hasSubtitle: true,
  },
  {
    id: 'excel',
    status: 'available',
    bgClass: 'bg-slate-500',
    textClass: 'text-white',
    cta: 'manage',
  },
];

type SyncTaskId = 'employees' | 'payroll' | 'invoices' | 'bank' | 'financials' | 'coretax';

const SYNC_TASKS: { id: SyncTaskId; ctaKey: 'syncCta' | 'lookupCta' | 'statusCta' }[] = [
  { id: 'employees', ctaKey: 'syncCta' },
  { id: 'payroll', ctaKey: 'syncCta' },
  { id: 'invoices', ctaKey: 'syncCta' },
  { id: 'bank', ctaKey: 'syncCta' },
  { id: 'financials', ctaKey: 'lookupCta' },
  { id: 'coretax', ctaKey: 'statusCta' },
];

function SyncTabPanel() {
  const t = useTranslations('integrationsPage.syncTab');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-base font-bold text-slate-900">{t('title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {SYNC_TASKS.map((task) => (
          <div key={task.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{t(`tasks.${task.id}.title`)}</p>
                <p className="text-xs text-slate-500 mt-1">{t(`tasks.${task.id}.source`)}</p>
                <p className="text-xs text-slate-500 mt-2">{t(`tasks.${task.id}.desc`)}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                {t(task.ctaKey)}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type MappingRowId = 'salesRev' | 'salaryExp' | 'rentExp' | 'taxPayment' | 'vendorKbli';

const MAPPING_ROWS: MappingRowId[] = ['salesRev', 'salaryExp', 'rentExp', 'taxPayment', 'vendorKbli'];

function MappingTabPanel() {
  const t = useTranslations('integrationsPage.mappingTab');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-base font-bold text-slate-900">{t('title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">{t('columns.source')}</th>
              <th className="px-4 py-3">{t('columns.target')}</th>
              <th className="px-4 py-3">{t('columns.purpose')}</th>
              <th className="px-4 py-3 w-24">{t('columns.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MAPPING_ROWS.map((row) => (
              <tr key={row} className="text-sm">
                <td className="px-4 py-4 font-medium text-slate-900">{t(`rows.${row}.source`)}</td>
                <td className="px-4 py-4 text-slate-700">{t(`rows.${row}.target`)}</td>
                <td className="px-4 py-4 text-slate-500">{t(`rows.${row}.purpose`)}</td>
                <td className="px-4 py-4">
                  <Button size="sm" variant="outline" className="h-8 text-xs">{t('editCta')}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
        {t('footer')}
      </div>
    </div>
  );
}

type LogResult = 'done' | 'ready' | 'pending' | 'attention';
type LogEventId = 'excelPayroll' | 'coretaxIdBilling' | 'bankConnect' | 'accurateMapping';

const LOG_ROWS: { time: string; system: string; eventId: LogEventId; result: LogResult }[] = [
  { time: '2026-04-30 14:30', system: 'Excel Import', eventId: 'excelPayroll', result: 'done' },
  { time: '2026-04-30 14:22', system: 'Coretax', eventId: 'coretaxIdBilling', result: 'ready' },
  { time: '2026-04-29 19:05', system: 'Open Banking', eventId: 'bankConnect', result: 'pending' },
  { time: '2026-04-29 11:18', system: 'Accurate', eventId: 'accurateMapping', result: 'attention' },
];

function LogsTabPanel() {
  const t = useTranslations('integrationsPage.logsTab');
  const resultClass: Record<LogResult, string> = {
    done: 'bg-emerald-50 text-emerald-700',
    ready: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-50 text-amber-700',
    attention: 'bg-rose-50 text-rose-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-base font-bold text-slate-900">{t('title')}</p>
      <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">{t('columns.time')}</th>
              <th className="px-4 py-3">{t('columns.system')}</th>
              <th className="px-4 py-3">{t('columns.event')}</th>
              <th className="px-4 py-3">{t('columns.result')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {LOG_ROWS.map((row) => (
              <tr key={row.time + row.eventId} className="text-sm">
                <td className="px-4 py-4 font-medium text-slate-900 tabular-nums">{row.time}</td>
                <td className="px-4 py-4 text-slate-700">{row.system}</td>
                <td className="px-4 py-4 text-slate-700">{t(`events.${row.eventId}`)}</td>
                <td className="px-4 py-4">
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', resultClass[row.result])}>
                    {t(`results.${row.result}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: CardStatus; t: (k: string) => string }) {
  const className =
    status === 'ready'
      ? 'bg-slate-100 text-slate-600'
      : status === 'available'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-slate-100 text-slate-500';
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}>
      {t(`statusBadge.${status}`)}
    </span>
  );
}

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations('integrationsPage');
  const [tab, setTab] = useState<Tab>('systems');

  const handleConnect = (card: IntegrationCard) => {
    if (card.href) {
      window.location.href = `/${locale}${card.href}`;
    }
  };

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
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
          {t('currentStep')}
        </span>
        {STEP_KEYS.map((s) => (
          <span key={s} className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
            {t(`steps.${s}`)}
          </span>
        ))}
      </div>

      {/* Hero banner */}
      <div className="rounded-2xl bg-slate-900 p-7 md:p-9 text-white mb-6">
        <p className="text-slate-400 text-sm mb-2">{t('heroLabel')}</p>
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{t('heroTitle')}</h2>
        <p className="text-slate-300 text-sm mt-3 max-w-4xl">{t('heroSubtitle')}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STATUS_CARD_KEYS.map((k) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{t(`statusCards.${k}.title`)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t(`statusCards.${k}.sub`)}</p>
            <p className="text-sm font-medium text-slate-700 mt-3">{t(`statusCards.${k}.value`)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TAB_KEYS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              'rounded-md px-4 py-2 text-xs font-semibold transition-colors',
              tab === tb
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {t(`tabs.${tb}`)}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {tab === 'systems' && (
        <div className="space-y-4">
          {CARDS.map((card) => {
            const syncData = t.raw(`cards.${card.id}.sync`) as string[];
            const reqs = t.raw(`cards.${card.id}.reqs`) as string[];
            return (
              <div key={card.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col md:flex-row">
                  {/* Left brand panel */}
                  <div className={cn('flex w-full md:w-56 flex-col items-center justify-center px-4 py-8', card.bgClass, card.textClass)}>
                    <p className="text-xl font-bold text-center leading-tight">{t(`cards.${card.id}.title`)}</p>
                    {card.hasSubtitle && (
                      <p className="text-xl font-bold text-center leading-tight">{t(`cards.${card.id}.subtitle`)}</p>
                    )}
                    <p className="mt-2 text-xs opacity-90">{t(`statusBadge.${card.status}`)}</p>
                  </div>

                  {/* Right detail panel */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-bold text-slate-900">{t(`cards.${card.id}.headline`)}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <StatusBadge status={card.status} t={t} />
                          {card.hasExtraBadge && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {t(`cards.${card.id}.extraBadge`)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => handleConnect(card)}
                      >
                        {t(`cta.${card.cta}`)}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">{t('syncDataLabel')}</p>
                        <ul className="space-y-1">
                          {syncData.map((d) => (
                            <li key={d} className="text-sm text-slate-600">✓ {d}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">{t('requirementsLabel')}</p>
                        <ul className="space-y-1">
                          {reqs.map((r) => (
                            <li key={r} className="text-sm text-slate-600">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sync' && <SyncTabPanel />}
      {tab === 'mapping' && <MappingTabPanel />}
      {tab === 'logs' && <LogsTabPanel />}
    </div>
  );
}
