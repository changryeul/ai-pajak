'use client';

/**
 * 상담원 본인 상태 카드 (PDF 「AI Pajak 백오피스_상담원」 1p 우상단).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface Me {
  operator: {
    id: string;
    employee_id: string;
    name: string;
    work_state: string | null;
    auto_assign_enabled: boolean | null;
    last_login_at: string | null;
    status: string | null;
  } | null;
  activeCount: number;
  lastLoginAt: string | null;
}

interface LastCase {
  id: string;
  case_code: string | null;
  customer_name: string;
  status: string | null;
}

const WORK_STATE_CLASS: Record<string, string> = {
  available:  'bg-emerald-100 text-emerald-700',
  consulting: 'bg-blue-100 text-blue-700',
  reviewing:  'bg-indigo-100 text-indigo-700',
  coretax:    'bg-violet-100 text-violet-700',
  break:      'bg-amber-100 text-amber-700',
  offline:    'bg-slate-100 text-slate-500',
  resigned:   'bg-rose-100 text-rose-700',
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
};

export function MyStatusCard() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('operatorStaff.myStatus');
  const tWork = useTranslations('operatorStaff.workState');
  const tStatus = useTranslations('operatorStaff.caseStatus');
  const [me, setMe] = useState<Me | null>(null);
  const [lastCase, setLastCase] = useState<LastCase | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/operator/me');
      const j = await r.json();
      if (j.success) setMe(j.data as Me);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('aip.operator.lastCase');
      if (raw) setLastCase(JSON.parse(raw) as LastCase);
    } catch { /* ignore */ }
  }, [pathname]);

  if (!me) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  const op = me.operator;
  const stateCls = op?.work_state ? WORK_STATE_CLASS[op.work_state] : null;
  const stateText = op?.work_state ? tWork(op.work_state as 'available') : null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('title')}</p>
        {stateText && stateCls && (
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold', stateCls)}>
            {stateText}
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
        <span className="text-base font-black text-slate-900">{op?.name ?? '—'}</span>
        <span className="text-xs font-bold text-slate-400">{op?.employee_id ?? ''}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Cell label={t('loginAt')} value={fmtTime(me.lastLoginAt ?? op?.last_login_at ?? null)} />
        <Cell label={t('myAssignments')} value={`${me.activeCount}${t('casesUnit')}`} highlight />
        <Cell label={t('autoAssign')} value={op?.auto_assign_enabled ? t('autoAssignOn') : t('autoAssignOff')} />
      </div>

      {lastCase && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <select
            defaultValue={lastCase.status ?? ''}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600"
            onChange={() => { /* 단계는 stepper에서 자동 추적 */ }}
          >
            <option value={lastCase.status ?? ''}>
              {lastCase.status ? tStatus(lastCase.status as 'PENDING') : '—'}
            </option>
          </select>
          <button
            onClick={() => router.push(`/${locale}/operator/review-case/${lastCase.id}`)}
            className="ml-auto rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            {lastCase.customer_name}
          </button>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={cn('text-sm font-black', highlight ? 'text-blue-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}
