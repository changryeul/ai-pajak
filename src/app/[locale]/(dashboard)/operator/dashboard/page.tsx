'use client';

/**
 * Supervisor Dashboard (PDF p.1-2)
 *
 * - 7 KPIs (total / assigned / unassigned / approval / docs / urgent / completed)
 * - Supervisor auto-balance status — 3 supervisor cards
 * - Operator status 5x2 grid (12)
 * - My auto-balance / urgent / approval case list
 *
 * Status + work-state enum labels are sourced from operatorWorkload and
 * operatorTeam namespaces respectively so the labels stay consistent
 * across pages.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageTitle';
import { OperatorQueueDailyTrend } from '@/components/operator/OperatorQueueDailyTrend';

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  service_label: string | null;
  status: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | null;
  operator_id: string | null;
  supervisor_id: string | null;
  customer: { full_name: string; company_name: string | null } | null;
  operator: { employee_id: string; name: string } | null;
  supervisor: { employee_id: string; name: string } | null;
}

interface OperatorRow {
  id: string;
  employee_id: string;
  name: string;
  work_state: string;
  auto_assign_enabled: boolean;
  last_login_at: string | null;
  active_load: number;
}

interface SupervisorRow {
  id: string;
  employee_id: string;
  name: string;
  managed_count: number;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  PENDING_DOCS: 'bg-amber-100 text-amber-800',
  DATA_REVIEW: 'bg-indigo-100 text-indigo-700',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
};

const WORK_STATE_DOT: Record<string, string> = {
  available: 'bg-emerald-500', consulting: 'bg-blue-500', reviewing: 'bg-indigo-500',
  coretax: 'bg-purple-500', break: 'bg-amber-500', offline: 'bg-slate-400', resigned: 'bg-rose-500',
};

const WORK_STATE_BADGE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  consulting: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-indigo-100 text-indigo-700',
  coretax: 'bg-purple-100 text-purple-700',
  break: 'bg-amber-100 text-amber-800',
  offline: 'bg-slate-100 text-slate-500',
  resigned: 'bg-rose-100 text-rose-700',
};

export default function SupervisorDashboardPage() {
  const t = useTranslations('operatorDashboard');
  const tWorkload = useTranslations('operatorWorkload');
  const tTeam = useTranslations('operatorTeam');
  const params = useParams();
  const locale = params.locale as string;
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const statusLabel = (key: string) => {
    try { return tWorkload(`status.${key}`); } catch { return key; }
  };
  const workStateLabel = (key: string) => {
    try { return tTeam(`workState.${key}`); } catch { return key; }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [casesRes, teamRes] = await Promise.all([
        fetch('/api/operator/cases?scope=all'),
        fetch('/api/operator/team'),
      ]);
      const casesJson = await casesRes.json();
      const teamJson = await teamRes.json();
      if (casesJson.success) setCases(casesJson.data.items as CaseRow[]);
      if (teamJson.success) {
        setOperators(teamJson.data.operators as OperatorRow[]);
        setSupervisors(teamJson.data.supervisors as SupervisorRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const total = cases.length;
  const assigned = cases.filter(c => !!c.operator_id).length;
  const unassigned = cases.filter(c => !c.operator_id).length;
  const pendingApproval = cases.filter(c => c.status === 'PENDING_APPROVAL').length;
  const pendingDocs = cases.filter(c => c.status === 'PENDING_DOCS').length;
  const urgent = cases.filter(c => c.priority === 'URGENT' || c.priority === 'HIGH').length;
  const completed = cases.filter(c => c.status === 'COMPLETED').length;

  const fmtTime = (iso: string | null) => {
    if (!iso) return t('notLoggedIn');
    const d = new Date(iso);
    if (Date.now() - d.getTime() > 24 * 60 * 60 * 1000) return t('notLoggedIn');
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const myCases = cases.filter(c => !c.operator_id || c.priority === 'URGENT' || c.status === 'PENDING_APPROVAL' || c.status === 'PENDING_DOCS');

  if (loading) return <div className="container mx-auto py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1500px]">
      <PageTitle title={t('pageTitle')} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('pageDesc')}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
        </button>
      </div>

      {/* 7 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <Kpi label={t('kpi.total')} value={total} />
        <Kpi label={t('kpi.assigned')} value={assigned} tone="indigo" />
        <Kpi label={t('kpi.unassigned')} value={unassigned} tone="amber" highlight={unassigned > 0} />
        <Kpi label={t('kpi.pendingApproval')} value={pendingApproval} tone="purple" />
        <Kpi label={t('kpi.pendingDocs')} value={pendingDocs} tone="amber" />
        <Kpi label={t('kpi.urgent')} value={urgent} tone="rose" highlight={urgent > 0} />
        <Kpi label={t('kpi.completed')} value={completed} tone="emerald" />
      </div>

      {/* Queue daily activity trend */}
      <OperatorQueueDailyTrend />

      {/* Supervisor auto-balance status */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-base font-black text-slate-900 mb-3">{t('supervisorDist.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {supervisors.map(sv => {
            const svCases = cases.filter(c => c.supervisor_id === sv.id);
            return (
              <div key={sv.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">{sv.name}</p>
                    <p className="text-[11px] text-slate-500">{sv.employee_id} · {t('supervisorDist.managedSuffix', { n: sv.managed_count })}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t('supervisorDist.waiting')}</span>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-3">{t('caseSuffix', { n: svCases.length })}</p>
                <p className="text-[11px] text-slate-500">{t('supervisorDist.currentAssignment')}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Operator status 5x2 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">{t('operatorStatus.title')}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{t('operatorStatus.desc')}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{t('operatorStatus.badge')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {operators.slice(0, 10).map(o => (
            <div key={o.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`h-2 w-2 rounded-full ${WORK_STATE_DOT[o.work_state] || 'bg-slate-400'}`} />
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${WORK_STATE_BADGE[o.work_state] || 'bg-slate-100 text-slate-500'}`}>
                  {workStateLabel(o.work_state)}
                </span>
              </div>
              <p className="text-sm font-black text-slate-900">{o.name}</p>
              <p className="text-[10px] text-slate-400 mb-2">{o.employee_id}</p>
              <div className="space-y-0.5 text-[10px]">
                <Row label={t('operatorStatus.row.assignment')} value={t('caseSuffix', { n: o.active_load })} />
                <Row label={t('operatorStatus.row.login')} value={fmtTime(o.last_login_at)} />
                <Row label={t('operatorStatus.row.auto')} value={o.auto_assign_enabled ? t('operatorStatus.row.autoEnabled') : t('operatorStatus.row.autoDisabled')} />
              </div>
            </div>
          ))}
        </div>
        {operators.length > 10 && (
          <p className="mt-3 text-[11px] text-slate-500">
            {t('operatorStatus.moreHint', { n: operators.length - 10 })}{' '}
            <Link href={`/${locale}/operator/team`} className="text-indigo-600 underline">{t('operatorStatus.moreLink')}</Link>{' '}
            {t('operatorStatus.moreHintTail')}
          </p>
        )}
      </section>

      {/* My cases */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-900 mb-3">{t('myCases.title')}</h2>
        <div className="space-y-2">
          {myCases.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">
              {t('myCases.empty')}
            </p>
          ) : myCases.slice(0, 10).map(c => (
            <Link
              key={c.id}
              href={`/${locale}/operator/workload?caseId=${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">
                  {c.customer?.company_name || c.customer?.full_name || '—'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {c.case_code ?? '-'} · {c.service_label || '-'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('myCases.row.assigneePrefix', { id: c.operator?.employee_id ?? t('myCases.row.unassigned') })} · {c.priority || 'NORMAL'} · {t('myCases.row.reviewNeeded')}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-700'}`}>
                {statusLabel(c.status)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone = 'slate', highlight = false }: { label: string; value: number | string; tone?: 'slate' | 'indigo' | 'amber' | 'purple' | 'rose' | 'emerald'; highlight?: boolean }) {
  const highlightCls: Partial<Record<string, string>> = {
    amber: 'ring-2 ring-amber-200 bg-amber-50',
    rose: 'ring-2 ring-rose-200 bg-rose-50',
  };
  const ring = highlight ? (highlightCls[tone] ?? '') : '';
  return (
    <div className={`rounded-xl bg-white px-4 py-3 shadow-sm ${ring}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  );
}
