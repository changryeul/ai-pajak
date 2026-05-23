'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

interface CustomerSummary {
  customerId: string;
  customerName: string;
  npwp: string | null;
  consultantName: string | null;
  requiredFilled: number;
  requiredTotal: number;
  missingCount: number;
  fileCount: number;
  hasCoretax: boolean;
  expiringCount: number;
  completionPct: number;
}
type CategoryGroup = 'AKTA' | 'PERMIT' | 'TAX';
interface Doc {
  id: string;
  category: string;
  category_group: CategoryGroup;
  isRequired: boolean;
  storagePath: string | null;
  originalFilename: string | null;
  validUntil: string | null;
  note: string | null;
  uploadedAt: string;
  version: number;
}
interface Resp {
  customers: CustomerSummary[];
  documents: Record<string, Doc[]>;
  expiringSoon: Array<{ customerId: string; customerName: string; category: string; validUntil: string }>;
}

function completionPillStyle(pct: number) {
  if (pct >= 100) return { bg: '#D0F0E5', color: '#00684D' };
  if (pct >= 50) return { bg: '#FEF3C7', color: '#92400E' };
  return { bg: '#FBE0D0', color: '#A04400' };
}

export function SupervisorLegalityView() {
  const t = useTranslations('supervisorErp');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/consultant-erp/supervisor/legality')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) {
          setError(j.error || 'failed');
          return;
        }
        setData(j.data as Resp);
        if (j.data.customers?.[0]) setExpandedId(j.data.customers[0].customerId);
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

  const filtered = useMemo(() => {
    if (!data) return [] as CustomerSummary[];
    if (!q.trim()) return data.customers;
    const needle = q.toLowerCase();
    return data.customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(needle) ||
        (c.npwp ?? '').toLowerCase().includes(needle) ||
        (c.consultantName ?? '').toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-rose-600">{error ?? 'no data'}</p>;
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] text-slate-600 mb-1">{t('legSearch')}</p>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('legSearchPlaceholder')}
            />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 self-end">
            {t('legSearchResultCount', { n: filtered.length, total: data.customers.length })}
          </div>
        </div>
      </section>

      {/* Customer list with inline detail */}
      <section className="rounded-2xl border border-slate-200 bg-slate-950 text-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em]">{t('legCustomerListHeading')}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{t('legCustomerListHint')}</p>
      </section>

      <div className="space-y-3">
        {filtered.map((c) => {
          const isExpanded = expandedId === c.customerId;
          const docs = data.documents[c.customerId] ?? [];
          const completion = completionPillStyle(c.completionPct);
          const selectedDoc = docs.find((d) => d.id === docId) ?? docs[0];

          return (
            <div key={c.customerId} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.customerId)}
                className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 mt-1 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 mt-1 text-slate-500" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-slate-950">{c.customerName}</p>
                      <p className="text-[10px] text-slate-500">{c.npwp ?? '—'} · {c.consultantName ?? '—'}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={completion}
                    >
                      {c.completionPct}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10px]">
                    <StatBox label={t('legSummaryRequired')} value={`${c.requiredFilled}/${c.requiredTotal}`} />
                    <StatBox label={t('legSummaryMissing')} value={String(c.missingCount)} tone={c.missingCount > 0 ? '#A04400' : '#475569'} />
                    <StatBox label={t('legSummaryFiles')} value={String(c.fileCount)} />
                    <StatBox label={t('legSummaryCoretax')} value={c.hasCoretax ? 'OK' : 'NO'} tone={c.hasCoretax ? '#00684D' : '#A04400'} />
                    <StatBox label={t('legSummaryExpiry')} value={String(c.expiringCount)} tone={c.expiringCount > 0 ? '#A04400' : '#475569'} />
                  </div>
                  {c.missingCount > 0 && (
                    <p
                      className="mt-2 rounded-md px-3 py-1.5 text-[11px]"
                      style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                    >
                      {t('legAiHint', { n: c.missingCount })}
                    </p>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                  {/* Docs list */}
                  <div className="space-y-3">
                    {(['AKTA', 'PERMIT', 'TAX'] as const).map((group) => {
                      const groupDocs = docs.filter((d) => d.category_group === group);
                      return (
                        <div key={group}>
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
                            {group === 'AKTA'
                              ? t('legCategoryGroupAkta')
                              : group === 'PERMIT'
                                ? t('legCategoryGroupPermit')
                                : t('legCategoryGroupTax')}
                          </p>
                          {groupDocs.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">{t('legNoDocs')}</p>
                          ) : (
                            <ul className="space-y-1">
                              {groupDocs.map((d) => {
                                const isSelected = d.id === selectedDoc?.id;
                                return (
                                  <li key={d.id}>
                                    <button
                                      onClick={() => setDocId(d.id)}
                                      className={`w-full text-left rounded-lg border p-2 transition ${
                                        isSelected
                                          ? 'border-emerald-400 bg-emerald-50/50'
                                          : 'border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-900">{d.category}</span>
                                        <span
                                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                          style={
                                            d.storagePath
                                              ? { backgroundColor: '#D0F0E5', color: '#00684D' }
                                              : { backgroundColor: '#FBE0D0', color: '#A04400' }
                                          }
                                        >
                                          {d.storagePath ? 'OK' : 'EMPTY'}
                                        </span>
                                      </div>
                                      {d.originalFilename && (
                                        <p className="text-[10px] text-slate-500 truncate">
                                          {d.originalFilename}
                                        </p>
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline preview metadata */}
                  {selectedDoc && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">{selectedDoc.category}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {selectedDoc.originalFilename ?? '—'}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={
                            selectedDoc.storagePath
                              ? { backgroundColor: '#D0F0E5', color: '#00684D' }
                              : { backgroundColor: '#FBE0D0', color: '#A04400' }
                          }
                        >
                          {selectedDoc.storagePath ? 'STORED' : 'EMPTY'}
                        </span>
                      </div>

                      <div className="mt-3 rounded-lg bg-slate-950 text-white p-4 text-center">
                        <FileText className="h-6 w-6 mx-auto text-slate-400" />
                        <p className="text-[11px] mt-2 text-slate-300">{t('legDocPreviewHeading')}</p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {selectedDoc.storagePath ? selectedDoc.originalFilename : '—'}
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                        <Meta label={t('legGroup')} value={
                          selectedDoc.category_group === 'AKTA'
                            ? t('legCategoryGroupAkta')
                            : selectedDoc.category_group === 'PERMIT'
                              ? t('legCategoryGroupPermit')
                              : t('legCategoryGroupTax')
                        } />
                        <Meta label={t('legRequiredYes')} value={selectedDoc.isRequired ? t('legRequiredYes') : t('legRequiredNo')} />
                        <Meta label={t('legVersion')} value={`v${selectedDoc.version}`} />
                        <Meta label={t('legUpdated')} value={new Date(selectedDoc.uploadedAt).toLocaleDateString()} />
                        <Meta label={t('legExpiry')} value={selectedDoc.validUntil ?? '—'} />
                        <Meta label={t('legNote')} value={selectedDoc.note ?? '—'} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expiring */}
      {data.expiringSoon.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <p className="text-sm font-black text-amber-900 mb-3">{t('legExpiringHeading')}</p>
          <ul className="space-y-1.5">
            {data.expiringSoon.map((e, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-center justify-between">
                <span className="font-bold">{e.customerName}</span>
                <span className="font-mono text-amber-800">{e.category} · {e.validUntil}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-sm font-black mt-0.5" style={{ color: tone ?? '#0f172a' }}>{value}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5 border border-slate-200">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-[11px] font-bold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}
