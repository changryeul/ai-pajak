'use client';

/**
 * 상담원 업무 화면 — 내 업무 (오늘 처리할 고객).
 *
 * PDF 「AI Pajak 백오피스_상담원」 p.1-2 그대로 재현.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertTriangle, FileText, ShieldCheck, Hourglass } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { cn } from '@/lib/utils';

interface CaseItem {
  id: string;
  case_code: string | null;
  service_label: string;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  due_date: string | null;
  d_day: string;
  customer: { id: string; name: string; type: string | null };
  operator_emp_id: string;
  metrics: {
    review_required: number;
    doc_requested: number;
    approval: '미요청' | '요청중' | '승인됨' | '반려';
    ntpn: string | null;
  };
  next_action: string;
}

interface Kpi {
  urgent: number;
  needsReview: number;
  awaitingApproval: number;
  coretaxReady: number;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING:            'bg-slate-100 text-slate-600',
  PENDING_DOCS:       'bg-amber-100 text-amber-700',
  DATA_REVIEW:        'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL:   'bg-violet-100 text-violet-700',
  APPROVED:           'bg-emerald-100 text-emerald-700',
  EBILLING_GENERATED: 'bg-blue-100 text-blue-700',
  PAYMENT_PENDING:    'bg-amber-100 text-amber-700',
  PAYMENT_UPLOADED:   'bg-blue-100 text-blue-700',
  PAYMENT_VERIFIED:   'bg-emerald-100 text-emerald-700',
  DJP_SUBMITTED:      'bg-blue-100 text-blue-700',
  BPE_UPLOADED:       'bg-cyan-100 text-cyan-700',
};

type FilterKey = 'ALL' | 'APPROVAL' | 'CORETAX' | 'DOCS_PENDING';

export default function MyWorkPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.myWork');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const tPriority = useTranslations('operatorStaff.priority');
  const tApproval = useTranslations('operatorStaff.approvalState');
  const tNext = useTranslations('operatorStaff.nextAction');
  const tMy = useTranslations('operatorStaff.myStatus');
  const [items, setItems] = useState<CaseItem[]>([]);
  const [kpi, setKpi] = useState<Kpi>({ urgent: 0, needsReview: 0, awaitingApproval: 0, coretaxReady: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/my-cases');
      const j = await r.json();
      if (j.success) {
        setItems(j.data.items as CaseItem[]);
        setKpi(j.data.kpi as Kpi);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickCase = (c: CaseItem) => {
    try {
      window.localStorage.setItem('aip.operator.lastCase', JSON.stringify({
        id: c.id, case_code: c.case_code, customer_name: c.customer.name, status: c.status,
      }));
    } catch { /* ignore */ }
    router.push(`/${locale}/operator/review-case/${c.id}`);
  };

  const filtered = useMemo(() => {
    if (filter === 'APPROVAL') return items.filter(i => i.status === 'PENDING_APPROVAL');
    if (filter === 'CORETAX') return items.filter(i => ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(i.status));
    if (filter === 'DOCS_PENDING') return items.filter(i => i.status === 'PENDING_DOCS');
    return items;
  }, [items, filter]);

  const counts = useMemo(() => ({
    APPROVAL: items.filter(i => i.status === 'PENDING_APPROVAL').length,
    CORETAX: items.filter(i => ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(i.status)).length,
    DOCS_PENDING: items.filter(i => i.status === 'PENDING_DOCS').length,
  }), [items]);

  const unit = tMy('casesUnit');

  if (loading) return (
    <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" /></div>
  );

  return (
    <div>
      <PageTitle title={t('pageTitle')} />
      <h1 className="mb-1 text-2xl font-black text-slate-900">{t('title')}</h1>
      <p className="mb-6 text-sm text-slate-500">{t('subtitle')}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <section className="mb-3 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">{t('todayHeader')}</h2>
                <p className="text-xs text-slate-500">{t('todayHint')}</p>
              </div>
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{items.length}{unit}</span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <KpiCell icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}    label={t('kpiUrgent')}            value={`${kpi.urgent}${unit}`} />
              <KpiCell icon={<FileText className="h-4 w-4 text-indigo-500" />}        label={t('kpiNeedsReview')}        value={`${kpi.needsReview}${unit}`} />
              <KpiCell icon={<ShieldCheck className="h-4 w-4 text-violet-500" />}     label={t('kpiAwaitingApproval')}   value={`${kpi.awaitingApproval}${unit}`} />
              <KpiCell icon={<Hourglass className="h-4 w-4 text-blue-500" />}         label={t('kpiCoretaxReady')}       value={`${kpi.coretaxReady}${unit}`} />
            </div>
          </section>

          {filtered.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
              {filter === 'ALL' ? t('emptyAll') : t('emptyFiltered')}
            </section>
          ) : (
            <ul className="space-y-3">
              {filtered.map(c => {
                const nextKey = ['PENDING','PENDING_DOCS','DATA_REVIEW','PENDING_APPROVAL','APPROVED','EBILLING_GENERATED','PAYMENT_PENDING','PAYMENT_UPLOADED','PAYMENT_VERIFIED','DJP_SUBMITTED','BPE_UPLOADED'].includes(c.status) ? c.status as 'PENDING' : 'default';
                return (
                  <CaseCard key={c.id} c={c} onPick={pickCase}
                    statusLabel={tStatus(c.status as 'PENDING')}
                    priorityLabel={tPriority((c.priority ?? 'NORMAL') as 'NORMAL')}
                    approvalLabel={tApproval(c.metrics.approval)}
                    metricLabels={{
                      reviewRequired: t('metricReviewRequired'),
                      docRequested: t('metricDocRequested'),
                      approval: t('metricApproval'),
                      ntpn: t('metricNtpn'),
                    }}
                    assigneeLabel={t('assignee')}
                    nextActionPrefix={t('nextActionPrefix')}
                    nextActionText={tNext(nextKey)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('filterTitle')}</h3>
            <div className="space-y-2">
              <FilterButton active={filter === 'APPROVAL'}
                onClick={() => setFilter(filter === 'APPROVAL' ? 'ALL' : 'APPROVAL')}
                label={t('filterApproval')} count={counts.APPROVAL} unit={unit}
                emptyLabel={t('filterEmpty')}
                pendingLabel={t('filterPending', { count: counts.APPROVAL })} />
              <FilterButton active={filter === 'CORETAX'}
                onClick={() => setFilter(filter === 'CORETAX' ? 'ALL' : 'CORETAX')}
                label={t('filterCoretax')} count={counts.CORETAX} unit={unit}
                emptyLabel={t('filterEmpty')}
                pendingLabel={t('filterPending', { count: counts.CORETAX })} />
              <FilterButton active={filter === 'DOCS_PENDING'}
                onClick={() => setFilter(filter === 'DOCS_PENDING' ? 'ALL' : 'DOCS_PENDING')}
                label={t('filterDocsPending')} count={counts.DOCS_PENDING} unit={unit}
                emptyLabel={t('filterEmpty')}
                pendingLabel={t('filterPending', { count: counts.DOCS_PENDING })} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-black text-slate-900">{t('guideTitle')}</h3>
            <ol className="space-y-1.5 text-xs text-slate-600">
              <li>{t('guide1')}</li>
              <li>{t('guide2')}</li>
              <li>{t('guide3')}</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function KpiCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1.5">{icon}<span className="text-[11px] font-bold text-slate-500">{label}</span></div>
      <p className="mt-0.5 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label, count, unit, emptyLabel, pendingLabel }: { active: boolean; onClick: () => void; label: string; count: number; unit: string; emptyLabel: string; pendingLabel: string }) {
  return (
    <button onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
        active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50',
      )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className={cn('text-[11px] font-bold', count > 0 ? 'text-blue-600' : 'text-slate-400')}>{count}{unit}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">{count === 0 ? emptyLabel : pendingLabel}</p>
    </button>
  );
}

interface CaseCardProps {
  c: CaseItem;
  onPick: (c: CaseItem) => void;
  statusLabel: string;
  priorityLabel: string;
  approvalLabel: string;
  metricLabels: { reviewRequired: string; docRequested: string; approval: string; ntpn: string };
  assigneeLabel: string;
  nextActionPrefix: string;
  nextActionText: string;
}

function CaseCard({ c, onPick, statusLabel, priorityLabel, approvalLabel, metricLabels, assigneeLabel, nextActionPrefix, nextActionText }: CaseCardProps) {
  const statusCls = STATUS_CLASS[c.status] ?? 'bg-slate-100 text-slate-600';
  return (
    <li onClick={() => onPick(c)}
      className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-blue-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">{c.customer.name}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusCls)}>{statusLabel}</span>
            {(c.priority === 'URGENT' || c.priority === 'HIGH') && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold',
                c.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                {priorityLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{c.case_code ?? '—'} · {c.service_label}</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-black', c.d_day.startsWith('D-') && Number(c.d_day.slice(2)) <= 1 ? 'text-rose-600' : 'text-slate-700')}>
            {c.d_day}
          </p>
          <p className="text-[10px] text-slate-400">{assigneeLabel} {c.operator_emp_id}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Metric label={metricLabels.reviewRequired} value={`${c.metrics.review_required}`} highlight={c.metrics.review_required > 0} />
        <Metric label={metricLabels.docRequested} value={`${c.metrics.doc_requested}`} highlight={c.metrics.doc_requested > 0} />
        <Metric label={metricLabels.approval} value={approvalLabel} />
        <Metric label={metricLabels.ntpn} value={c.metrics.ntpn ?? '—'} mono />
      </div>

      <div className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white">
        {nextActionPrefix} {nextActionText}
      </div>
    </li>
  );
}

function Metric({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn(
        'mt-0.5 truncate font-black',
        mono ? 'text-[11px] font-mono text-slate-700' : 'text-sm',
        highlight ? 'text-blue-600' : 'text-slate-800',
      )}>{value}</p>
    </div>
  );
}
