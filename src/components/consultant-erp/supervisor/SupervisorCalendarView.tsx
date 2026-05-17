'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface CalendarEntry {
  customerId: string;
  customerName: string;
  filingKind: 'MONTHLY' | 'ANNUAL';
  taxPeriod: string;
  deadline: string;
  daysToDeadline: number;
  status: string | null;
  consultantName: string | null;
  riskScore: number;
  sessionId: string | null;
}

function riskColor(score: number) {
  if (score >= 30) return { bg: '#FBE0D0', color: '#A04400' };
  if (score >= 15) return { bg: '#FEF3C7', color: '#92400E' };
  return { bg: '#D0F0E5', color: '#00684D' };
}

function deadlineColor(days: number) {
  if (days < 0) return { bg: '#FBE0D0', color: '#A04400' };
  if (days < 3) return { bg: '#FEF3C7', color: '#92400E' };
  if (days < 7) return { bg: '#FEF9C3', color: '#854D0E' };
  return { bg: '#E0F2FE', color: '#075985' };
}

export function SupervisorCalendarView() {
  const t = useTranslations('supervisorErp');
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const [rows, setRows] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/consultant-erp/supervisor/calendar')
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

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> 불러오는 중…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">{t('calendarEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const risk = riskColor(r.riskScore);
        const dline = deadlineColor(r.daysToDeadline);
        const daysLabel =
          r.daysToDeadline < 0
            ? t('daysOverdue', { n: -r.daysToDeadline })
            : r.daysToDeadline === 0
              ? t('daysToday')
              : t('daysLeft', { n: r.daysToDeadline });
        const inner = (
          <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-slate-950 truncate flex-1">{r.customerName}</p>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: risk.bg, color: risk.color }}
              >
                {t('riskLabel')} {r.riskScore}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {r.filingKind} {r.taxPeriod.slice(0, 7)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className="rounded-full px-2 py-1 text-[11px] font-bold"
                style={{ backgroundColor: dline.bg, color: dline.color }}
              >
                {daysLabel}
              </span>
              <p className="text-[10px] text-slate-500 font-mono">{r.deadline}</p>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              담당: {r.consultantName ?? '—'} · {t('statusLabel')}: {r.status ?? '—'}
            </p>
          </div>
        );
        return r.sessionId ? (
          <Link
            key={r.customerId + r.taxPeriod}
            href={`/${locale}/consultant-erp/work?customerId=${r.customerId}&sessionId=${r.sessionId}`}
          >
            {inner}
          </Link>
        ) : (
          <div key={r.customerId + r.taxPeriod}>{inner}</div>
        );
      })}
    </div>
  );
}
