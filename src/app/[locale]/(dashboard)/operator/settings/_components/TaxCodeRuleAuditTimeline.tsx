'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuditRowDTO } from '@/types/tax-code-rule';

interface Props {
  initialRows: AuditRowDTO[];
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaxCodeRuleAuditTimeline({ initialRows }: Props) {
  const t = useTranslations('operatorSettings.audit');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (initialRows.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-4 text-center">{t('empty')}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {initialRows.map((row) => {
        const expanded = expandedId === row.id;
        const fields = Object.keys(row.diff);
        return (
          <li key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {row.category}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t('changedFields')}: <code className="font-mono text-slate-800">{fields.join(', ')}</code>
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  {formatTs(row.createdAt)} · {row.actorEmail ?? row.actorUserId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  {t('stateApplied')}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-900"
                  aria-expanded={expanded}
                >
                  {expanded ? `▲ ${t('collapseToggle')}` : `▼ ${t('expandToggle')}`}
                </button>
              </div>
            </div>
            {expanded && (
              <div className="mt-3 space-y-2">
                {fields.map((f) => (
                  <div key={f} className="rounded-lg border border-slate-100 overflow-hidden">
                    <p className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 font-mono">{f}</p>
                    <div className="grid grid-cols-[60px_1fr] text-[11px]">
                      <p className="bg-rose-50 px-3 py-2 text-rose-700 font-bold">{t('colBefore')}</p>
                      <p className="bg-rose-50 px-3 py-2 text-rose-900 whitespace-pre-wrap break-words">{row.diff[f].before}</p>
                      <p className="bg-emerald-50 px-3 py-2 text-emerald-700 font-bold">{t('colAfter')}</p>
                      <p className="bg-emerald-50 px-3 py-2 text-emerald-900 whitespace-pre-wrap break-words">{row.diff[f].after}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
