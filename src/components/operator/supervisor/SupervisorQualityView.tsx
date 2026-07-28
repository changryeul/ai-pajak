'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface QualitySummary {
  totalRegistered: number;
  avgTrust: number;
  needsRemediation: number;
  manageable: number;
  verified: number;
  evidenceNeeded: number;
  pendingCandidates: number;
  completedToday: number;
}
interface QualityAction {
  step: 1 | 2 | 3 | 4;
  titleKey: string;
  count: number;
}
interface FieldTrust {
  fieldName: string;
  fieldValue: string | null;
  source: string | null;
  trustScore: number;
}
type QualityStatus = 'remediation' | 'manageable' | 'verified' | 'evidence-needed';
interface QualityRow {
  counterpartyId: string;
  name: string;
  npwp: string | null;
  country: string;
  trustScore: number;
  pkpStatus: string | null;
  suggestedPph: string | null;
  status: QualityStatus;
  insight: string;
  lastVerifiedAt: string | null;
  fieldTrust: FieldTrust[];
}

const STATUS_STYLE: Record<QualityStatus, { bg: string; color: string; key: string }> = {
  remediation: { bg: '#FBE0D0', color: '#A04400', key: 'qualityStatRemediation' },
  manageable: { bg: '#FEF3C7', color: '#92400E', key: 'qualityStatManageable' },
  verified: { bg: '#D0F0E5', color: '#00684D', key: 'qualityStatVerified' },
  'evidence-needed': { bg: '#FAE8FF', color: '#86198F', key: 'qualityStatEvidence' },
};

function trustPillStyle(trust: number) {
  if (trust >= 90) return { bg: '#D0F0E5', color: '#00684D' };
  if (trust >= 75) return { bg: '#E0F2FE', color: '#075985' };
  if (trust >= 40) return { bg: '#FEF3C7', color: '#92400E' };
  return { bg: '#FBE0D0', color: '#A04400' };
}

export function SupervisorQualityView() {
  const t = useTranslations('supervisorErp');
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [queue, setQueue] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | QualityStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/operator/supervisor/quality')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) {
          setError(j.error || 'failed');
          return;
        }
        setSummary(j.data.summary);
        setActions(j.data.actions);
        setQueue(j.data.queue);
        if (j.data.queue?.[0]) setSelectedId(j.data.queue[0].counterpartyId);
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
    () => (filter === 'ALL' ? queue : queue.filter((r) => r.status === filter)),
    [queue, filter],
  );
  const selected = useMemo(
    () => queue.find((r) => r.counterpartyId === selectedId) ?? filtered[0] ?? null,
    [queue, selectedId, filtered],
  );

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error || !summary) {
    return <p className="text-sm text-rose-600">{error ?? 'no data'}</p>;
  }

  return (
    <div className="space-y-5">
      {/* Quality Health + actions */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {t('qualityHealthHeading')}
          </p>
          <div className="mt-3 flex items-start gap-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-center min-w-[140px]">
              <p className="text-[10px] text-slate-500">{t('qualityAvgTrust')}</p>
              <p className="text-4xl font-black mt-1 text-slate-900">{summary.avgTrust}</p>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${summary.avgTrust}%`, backgroundColor: '#009E73' }}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{t('qualityHealthHint')}</p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
              <Pill label={`${t('qualityDistRegistered')} ${summary.totalRegistered}`} bg="#DBEAFE" color="#1D4ED8" />
              <Pill label={`${t('qualityDistRemediation')} ${summary.needsRemediation}`} bg="#FBE0D0" color="#A04400" />
              <Pill label={`${t('qualityDistManageable')} ${summary.manageable}`} bg="#FEF3C7" color="#92400E" />
              <Pill label={`${t('qualityDistVerified')} ${summary.verified}`} bg="#D0F0E5" color="#00684D" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {t('qualityActionsHeading')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <div key={a.step} className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-black text-slate-500">STEP {a.step}</p>
                <p className="mt-1 text-[11px] text-slate-700 leading-tight">
                  {t(a.titleKey)}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">{a.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 stat cards */}
      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label={t('qualityStatRemediation')} value={summary.needsRemediation} hint={t('qualityTrustBelow75')} accent="#A04400" />
        <StatCard label={t('qualityStatManageable')} value={summary.manageable} hint={t('qualityTrust7589')} accent="#075985" />
        <StatCard label={t('qualityStatVerified')} value={summary.verified} hint={t('qualityTrust90Plus')} accent="#00684D" />
        <StatCard label={t('qualityStatEvidence')} value={summary.evidenceNeeded} hint={t('qualityEvidenceLabel')} accent="#86198F" />
      </section>

      {/* Queue + detail */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-slate-950">{t('qualityQueueHeading')}</p>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs">
            {(['ALL', 'remediation', 'manageable', 'verified'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 font-bold transition ${
                  filter === f ? 'bg-slate-950 text-white' : 'text-slate-600'
                }`}
              >
                {f === 'ALL'
                  ? t('qualityFilterAll')
                  : f === 'remediation'
                    ? t('qualityFilterRemediation')
                    : f === 'manageable'
                      ? t('qualityFilterManageable')
                      : t('qualityFilterVerified')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-3">{t('thCounterparty')}</th>
                <th className="text-center py-2 px-3">{t('thTrust')}</th>
                <th className="text-left py-2 px-3">{t('thProfile')}</th>
                <th className="text-left py-2 px-3">{t('thQualityStatus')}</th>
                <th className="text-left py-2 px-3">{t('thLastVerified')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    {t('qualityEmpty')}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const trust = trustPillStyle(r.trustScore);
                const status = STATUS_STYLE[r.status];
                const isSelected = r.counterpartyId === selected?.counterpartyId;
                return (
                  <tr
                    key={r.counterpartyId}
                    onClick={() => setSelectedId(r.counterpartyId)}
                    className={`cursor-pointer ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2 px-3">
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <p className="text-[10px] text-slate-500">{r.npwp ?? '—'} · {r.country}</p>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: trust.bg, color: trust.color }}
                      >
                        {r.trustScore}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {r.suggestedPph ?? '—'}
                      {r.pkpStatus && (
                        <p className="text-[10px] text-slate-500">PKP {r.pkpStatus}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {t(status.key)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[10px] text-slate-500 font-mono">
                      {r.lastVerifiedAt ? new Date(r.lastVerifiedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-black text-slate-950">{selected.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selected.npwp ?? '—'} · {selected.country}
                </p>
                <p className="mt-2 text-[11px] text-slate-700">{selected.insight}</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={trustPillStyle(selected.trustScore)}
              >
                Trust {selected.trustScore}
              </span>
            </div>
            <p className="mt-4 text-xs font-bold text-slate-900">{t('qualityDetailHeading')}</p>
            {selected.fieldTrust.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">{t('qualityFieldEmpty')}</p>
            ) : (
              <table className="w-full text-xs mt-2">
                <thead className="text-slate-600">
                  <tr>
                    <th className="text-left py-1.5">{t('qualityFieldField')}</th>
                    <th className="text-left py-1.5">{t('qualityFieldValue')}</th>
                    <th className="text-left py-1.5">{t('qualityFieldSource')}</th>
                    <th className="text-right py-1.5">{t('qualityFieldTrust')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.fieldTrust.map((f, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="py-1.5 font-bold text-slate-900">{f.fieldName}</td>
                      <td className="py-1.5 text-slate-700">{f.fieldValue ?? '—'}</td>
                      <td className="py-1.5 text-slate-500">{f.source ?? '—'}</td>
                      <td className="py-1.5 text-right">
                        <span
                          className="rounded-full px-2 py-0.5 font-bold"
                          style={trustPillStyle(f.trustScore)}
                        >
                          {f.trustScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[11px] font-bold inline-flex items-center justify-center"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: number; hint: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">{label}</p>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          Trust
        </span>
      </div>
      <p className="mt-2 text-3xl font-black" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{hint}</p>
    </div>
  );
}
