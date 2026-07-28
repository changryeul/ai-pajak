'use client';

/**
 * ID Billing 이관현황 (v13 §8) — 수퍼바이저 read-only 추적.
 * 발행대상(승인완료 미발행) + 발행완료(일련번호·전송·NTPN 상태).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';

const fmtRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

interface Pending {
  sessionId: string; company: string; taxPeriod: string;
  approver: string; consultant: string; estimatedTax: number;
}
interface Issued {
  id: string; serialNo: string; company: string; taxType: string;
  taxPeriod: string; amount: number; sendStatus: string; ntpnStatus: string;
}

export function SupervisorBillingHandover() {
  const t = useTranslations('supervisorErp');
  const [pending, setPending] = useState<Pending[]>([]);
  const [issued, setIssued] = useState<Issued[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/operator/supervisor/billing-handover');
      const j = await r.json();
      if (j.success) {
        setPending(j.data.pending ?? []);
        setIssued(j.data.issued ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={load} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> {t('handoverRefresh')}
        </button>
      </div>

      {/* 발행대상 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-black text-slate-950">{t('handoverPendingTitle')} <span className="text-slate-400">({pending.length})</span></p>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-400">{t('handoverPendingEmpty')}</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">{t('handoverColCompany')}</th>
                  <th className="px-2 py-2">{t('handoverColPeriod')}</th>
                  <th className="px-2 py-2">{t('handoverColApprover')}</th>
                  <th className="px-2 py-2">{t('handoverColConsultant')}</th>
                  <th className="px-2 py-2 text-right">{t('handoverColTax')}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.sessionId} className="border-t border-slate-100">
                    <td className="px-2 py-2.5 font-semibold text-slate-800">{p.company}</td>
                    <td className="px-2 py-2.5">{p.taxPeriod}</td>
                    <td className="px-2 py-2.5">{p.approver}</td>
                    <td className="px-2 py-2.5">{p.consultant}</td>
                    <td className="px-2 py-2.5 text-right">{fmtRp(p.estimatedTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 발행완료 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-black text-slate-950">{t('handoverIssuedTitle')} <span className="text-slate-400">({issued.length})</span></p>
        {issued.length === 0 ? (
          <p className="text-xs text-slate-400">{t('handoverIssuedEmpty')}</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">No.</th>
                  <th className="px-2 py-2">{t('handoverColCompany')}</th>
                  <th className="px-2 py-2">{t('handoverColTaxType')}</th>
                  <th className="px-2 py-2">{t('handoverColPeriod')}</th>
                  <th className="px-2 py-2 text-right">{t('handoverColAmount')}</th>
                  <th className="px-2 py-2">{t('handoverColSend')}</th>
                  <th className="px-2 py-2">{t('handoverColNtpn')}</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((r, i) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-2 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-slate-800">{r.company}</p>
                      <p className="font-mono text-[10px] text-slate-400">{r.serialNo}</p>
                    </td>
                    <td className="px-2 py-2.5">{r.taxType}</td>
                    <td className="px-2 py-2.5">{r.taxPeriod}</td>
                    <td className="px-2 py-2.5 text-right">{fmtRp(r.amount)}</td>
                    <td className="px-2 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.sendStatus === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.sendStatus === 'SENT' ? t('handoverSent') : t('handoverNotSent')}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.ntpnStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {r.ntpnStatus === 'PAID' ? t('handoverPaid') : t('handoverAwaitingNtpn')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-slate-400">{t('handoverFootnote')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
