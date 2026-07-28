'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface CustomerOverviewRow {
  customerId: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  npwp: string | null;
  consultantName: string | null;
  taxPartnerName: string | null;
  currentFilingKind: 'MONTHLY' | 'ANNUAL' | null;
  currentTaxPeriod: string | null;
  status: string | null;
  docReview: { filled: number; total: number };
  riskScore: number;
  deadline: string | null;
  daysToDeadline: number | null;
  sessionId: string | null;
}

type SortKey = 'name' | 'assignee' | 'task' | 'risk' | 'deadline';
type SortDir = 'asc' | 'desc';

function riskColor(score: number) {
  if (score >= 30) return { bg: '#FBE0D0', color: '#A04400' }; // vermillion-tinted
  if (score >= 15) return { bg: '#FEF3C7', color: '#92400E' }; // amber
  return { bg: '#D0F0E5', color: '#00684D' }; // bluish-green
}

export function SupervisorCustomersView() {
  const t = useTranslations('supervisorErp');
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const [rows, setRows] = useState<CustomerOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('risk');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/operator/supervisor/customers')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) setError(j.error || 'failed');
        else setRows(j.data.rows ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSortBy((prev) => {
      if (prev !== key) {
        setSortDir(key === 'risk' ? 'desc' : 'asc');
        return key;
      }
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return prev;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case 'assignee':
          cmp = (a.consultantName ?? '').localeCompare(b.consultantName ?? '');
          break;
        case 'task':
          cmp = (a.currentTaxPeriod ?? '').localeCompare(b.currentTaxPeriod ?? '');
          break;
        case 'risk':
          cmp = a.riskScore - b.riskScore;
          break;
        case 'deadline': {
          const ad = a.deadline ?? '9999-12-31';
          const bd = b.deadline ?? '9999-12-31';
          cmp = ad.localeCompare(bd);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sortBy, sortDir]);

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        <Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> 불러오는 중…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <Th label={t('thCustomer')} active={sortBy === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
            <Th label={t('thAssignee')} active={sortBy === 'assignee'} dir={sortDir} onClick={() => toggleSort('assignee')} />
            <Th label={t('thTask')} active={sortBy === 'task'} dir={sortDir} onClick={() => toggleSort('task')} />
            <th className="text-center py-3 px-3 text-xs font-bold">{t('thDocReview')}</th>
            <Th label={t('thRisk')} active={sortBy === 'risk'} dir={sortDir} onClick={() => toggleSort('risk')} align="center" />
            <Th label={t('thDeadline')} active={sortBy === 'deadline'} dir={sortDir} onClick={() => toggleSort('deadline')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedRows.map((r) => {
            const risk = riskColor(r.riskScore);
            const taskLabel = r.currentFilingKind && r.currentTaxPeriod
              ? `${r.currentFilingKind} ${r.currentTaxPeriod.slice(0, 7)}`
              : null;
            return (
              <tr key={r.customerId} className="hover:bg-slate-50">
                <td className="py-3 px-3 align-top">
                  {r.sessionId ? (
                    <Link
                      href={`/${locale}/consultant-erp/work?customerId=${r.customerId}&sessionId=${r.sessionId}`}
                      className="font-bold text-slate-950 hover:underline"
                    >
                      {r.customerName}
                    </Link>
                  ) : (
                    <p className="font-bold text-slate-950">{r.customerName}</p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    {r.customerType === 'COMPANY' ? t('customerTypeCompany') : t('customerTypeIndividual')}
                    {r.npwp ? ` · ${r.npwp}` : ''}
                  </p>
                </td>
                <td className="py-3 px-3 align-top text-slate-700">
                  {r.consultantName ?? '—'}
                  {r.taxPartnerName && (
                    <p className="text-[10px] text-slate-500">{r.taxPartnerName}</p>
                  )}
                </td>
                <td className="py-3 px-3 align-top">
                  {taskLabel ? (
                    <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
                      {taskLabel}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">{t('taskNone')}</span>
                  )}
                </td>
                <td className="py-3 px-3 align-top text-center text-xs text-slate-700">
                  {taskLabel ? `${r.docReview.filled}/${r.docReview.total}` : '—'}
                </td>
                <td className="py-3 px-3 align-top text-center">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: risk.bg, color: risk.color }}
                  >
                    {r.riskScore}
                  </span>
                </td>
                <td className="py-3 px-3 align-top text-slate-700 text-xs">
                  {r.deadline ?? '—'}
                </td>
              </tr>
            );
          })}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'center';
}) {
  return (
    <th className={`py-3 px-3 text-xs font-bold ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
      >
        {label}
        {active && (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}
