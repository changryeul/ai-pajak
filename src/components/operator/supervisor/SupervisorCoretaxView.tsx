'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Stage = 'ID_BILLING_PENDING' | 'NTPN_PENDING' | 'BPE_PENDING' | 'COMPLETED';

interface CoretaxRow {
  sessionId: string;
  customerId: string;
  customerName: string;
  npwp: string | null;
  consultantName: string | null;
  taxPartnerName: string | null;
  filingKind: 'MONTHLY' | 'ANNUAL';
  taxPeriod: string;
  sessionStatus: string;
  stage: Stage;
  idBilling: string | null;
  ntpn: string | null;
  bpeFilePath: string | null;
  recordedAt: string | null;
  bpeUploadedAt: string | null;
}

const STAGE_STYLE: Record<Stage, { bg: string; color: string; key: string }> = {
  ID_BILLING_PENDING: { bg: '#FEF3C7', color: '#92400E', key: 'coretaxStageIdBilling' },
  NTPN_PENDING:       { bg: '#E0F2FE', color: '#075985', key: 'coretaxStageNtpn' },
  BPE_PENDING:        { bg: '#FAE8FF', color: '#86198F', key: 'coretaxStageBpe' },
  COMPLETED:          { bg: '#D0F0E5', color: '#00684D', key: 'coretaxStageCompleted' },
};

export function SupervisorCoretaxView() {
  const t = useTranslations('supervisorErp');
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const [rows, setRows] = useState<CoretaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/operator/supervisor/coretax')
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

  const filtered = useMemo(
    () => (pendingOnly ? rows.filter((r) => r.stage !== 'COMPLETED') : rows),
    [rows, pendingOnly],
  );

  const counts = useMemo(() => {
    const c = { ID_BILLING_PENDING: 0, NTPN_PENDING: 0, BPE_PENDING: 0, COMPLETED: 0 };
    for (const r of rows) c[r.stage]++;
    return c;
  }, [rows]);

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">{t('coretaxEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage counts strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(STAGE_STYLE) as Stage[]).map((s) => {
          const style = STAGE_STYLE[s];
          return (
            <div key={s} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                {t(style.key)}
              </p>
              <p className="mt-2 text-3xl font-black" style={{ color: style.color }}>
                {counts[s]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filter chip */}
      <div className="flex items-center justify-end gap-1 rounded-full bg-slate-100 p-1 w-fit ml-auto">
        <button
          onClick={() => setPendingOnly(false)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            !pendingOnly ? 'bg-slate-950 text-white' : 'text-slate-600'
          }`}
        >
          {t('coretaxFilterAll')}
        </button>
        <button
          onClick={() => setPendingOnly(true)}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            pendingOnly ? 'bg-orange-600 text-white' : 'text-slate-600'
          }`}
        >
          {t('coretaxFilterPending')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left py-3 px-3 text-xs font-bold">{t('thCustomer')}</th>
              <th className="text-left py-3 px-3 text-xs font-bold">{t('thAssignee')}</th>
              <th className="text-left py-3 px-3 text-xs font-bold">{t('thPeriod')}</th>
              <th className="text-left py-3 px-3 text-xs font-bold">{t('thStage')}</th>
              <th className="text-center py-3 px-3 text-xs font-bold">{t('thIdBilling')}</th>
              <th className="text-center py-3 px-3 text-xs font-bold">{t('thNtpn')}</th>
              <th className="text-center py-3 px-3 text-xs font-bold">{t('thBpe')}</th>
              <th className="text-left py-3 px-3 text-xs font-bold">{t('thRecordedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const style = STAGE_STYLE[r.stage];
              return (
                <tr key={r.sessionId} className="hover:bg-slate-50">
                  <td className="py-3 px-3 align-top">
                    <Link
                      href={`/${locale}/consultant-erp/work?customerId=${r.customerId}&sessionId=${r.sessionId}`}
                      className="font-bold text-slate-950 hover:underline"
                    >
                      {r.customerName}
                    </Link>
                    <p className="text-[10px] text-slate-500">{r.npwp ?? '—'}</p>
                  </td>
                  <td className="py-3 px-3 align-top text-xs text-slate-700">
                    {r.consultantName ?? '—'}
                    {r.taxPartnerName && (
                      <p className="text-[10px] text-slate-500">{r.taxPartnerName}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-xs text-slate-700">
                    {r.filingKind} {r.taxPeriod.slice(0, 7)}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {t(style.key)}
                    </span>
                  </td>
                  <td className="py-3 px-3 align-top text-center">
                    {r.idBilling ? (
                      <span className="text-xs font-mono text-slate-700" title={r.idBilling}>
                        {r.idBilling.slice(0, 10)}…
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-center">
                    {r.ntpn ? (
                      <Check className="h-4 w-4 inline" style={{ color: '#009E73' }} />
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-center">
                    {r.bpeFilePath ? (
                      <Check className="h-4 w-4 inline" style={{ color: '#009E73' }} />
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-[10px] text-slate-500 font-mono">
                    {r.recordedAt ? new Date(r.recordedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
