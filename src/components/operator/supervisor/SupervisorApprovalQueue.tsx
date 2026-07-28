'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Row {
  sessionId: string | null;
  customerId: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  npwp: string | null;
  consultantName: string | null;
  taxPartnerName: string | null;
  taxPeriod: string | null;
  filingKind: 'MONTHLY' | 'ANNUAL' | null;
  status: string | null;
  updatedAt: string | null;
}

export function SupervisorApprovalQueue() {
  const t = useTranslations('supervisorErp');
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/consultant-erp/sessions/board?status=PENDING_APPROVAL')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) setError(j.error || 'failed');
        else setRows(j.data?.rows ?? []);
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
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">{t('approvalEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 text-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em]">{t('approvalQueue')}</p>
      </div>
      <div className="grid gap-3">
        {rows.map((r) => {
          if (!r.sessionId) return null;
          return (
            <Link
              key={r.sessionId}
              href={`/${locale}/operator/supervisor/approval/${r.sessionId}`}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{r.customerName}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {r.filingKind} {r.taxPeriod?.slice(0, 7)} · {r.consultantName ?? '—'}
                    {r.taxPartnerName && ` · ${r.taxPartnerName}`}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                >
                  대기
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
