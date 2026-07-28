'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Kind = 'SUBMIT' | 'REJECT' | 'APPROVE' | 'WITHDRAW';

interface RevisionEvent {
  id: string;
  kind: Kind;
  at: string;
  customerName: string;
  customerId: string;
  taxPeriod: string;
  filingKind: 'MONTHLY' | 'ANNUAL' | null;
  actorName: string | null;
  actorRole: string;
  comment: string | null;
}

const KIND_STYLE: Record<Kind, { bg: string; color: string }> = {
  SUBMIT: { bg: '#DBEAFE', color: '#1D4ED8' },         // blue-100 / blue-700
  APPROVE: { bg: '#D0F0E5', color: '#00684D' },        // bluish-green
  REJECT: { bg: '#FBE0D0', color: '#A04400' },         // vermillion
  WITHDRAW: { bg: '#F1F5F9', color: '#475569' },       // slate
};

export function SupervisorRevisionsView() {
  const t = useTranslations('supervisorErp');
  const [rows, setRows] = useState<RevisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/operator/supervisor/revisions')
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
        <p className="text-sm text-slate-500">{t('revisionEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thKind')}</th>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thAt')}</th>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thCustomer')}</th>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thPeriod')}</th>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thActor')}</th>
            <th className="text-left py-3 px-3 text-xs font-bold">{t('thComment')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const style = KIND_STYLE[r.kind];
            return (
              <tr key={r.id}>
                <td className="py-3 px-3 align-top">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    {t(`kind${r.kind}`)}
                  </span>
                </td>
                <td className="py-3 px-3 align-top text-xs text-slate-700 font-mono">
                  {new Date(r.at).toLocaleString()}
                </td>
                <td className="py-3 px-3 align-top font-bold text-slate-950">
                  {r.customerName}
                </td>
                <td className="py-3 px-3 align-top text-xs text-slate-700">
                  {r.filingKind ?? ''} {r.taxPeriod?.slice(0, 7) ?? ''}
                </td>
                <td className="py-3 px-3 align-top text-xs text-slate-700">
                  {r.actorName ?? '—'}
                  <p className="text-[10px] text-slate-500">{r.actorRole}</p>
                </td>
                <td className="py-3 px-3 align-top text-xs text-slate-700 max-w-md">
                  {r.comment ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
