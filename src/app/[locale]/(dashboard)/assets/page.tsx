'use client';

/**
 * /assets — INDIVIDUAL customer balance-sheet editor.
 *
 * Inline CRUD over /api/customer/snapshots (asset + liability kinds).
 * This is the lightweight destination for the "항목 추가" CTAs on
 * AssetsLiabilitiesCard — users can maintain their year-end balance
 * sheet without going through the full SPT 1770 flow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Landmark, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/layout/PageTitle';

type AssetCategory =
  | 'CASH_BANK' | 'RECEIVABLE' | 'INVENTORY' | 'INVESTMENT'
  | 'VEHICLE' | 'LAND' | 'BUILDING' | 'BUSINESS_ASSET' | 'OTHER';

type LiabilityCategory =
  | 'BANK_LOAN' | 'CREDIT_CARD' | 'PERSONAL_LOAN' | 'BUSINESS_LIABILITY' | 'OTHER';

const ASSET_CATEGORIES: readonly AssetCategory[] = [
  'CASH_BANK', 'RECEIVABLE', 'INVENTORY', 'INVESTMENT',
  'VEHICLE', 'LAND', 'BUILDING', 'BUSINESS_ASSET', 'OTHER',
];
const LIABILITY_CATEGORIES: readonly LiabilityCategory[] = [
  'BANK_LOAN', 'CREDIT_CARD', 'PERSONAL_LOAN', 'BUSINESS_LIABILITY', 'OTHER',
];

interface AssetRow {
  id: string;
  snapshot_year: number;
  category: AssetCategory;
  amount_idr: number;
  label?: string | null;
  is_foreign: boolean;
}

interface LiabilityRow {
  id: string;
  snapshot_year: number;
  category: LiabilityCategory;
  amount_idr: number;
  label?: string | null;
  creditor_name?: string | null;
}

function fmtIdr(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function AssetsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const currentYear = new Date().getFullYear() - 1; // Prior tax year

  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [addingAsset, setAddingAsset] = useState(false);
  const [addingLia, setAddingLia] = useState(false);
  const [assetDraft, setAssetDraft] = useState({
    category: 'CASH_BANK' as AssetCategory,
    amount_idr: '',
    label: '',
    is_foreign: false,
  });
  const [liaDraft, setLiaDraft] = useState({
    category: 'BANK_LOAN' as LiabilityCategory,
    amount_idr: '',
    label: '',
    creditor_name: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/snapshots', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        setAssets((j.data?.assets ?? []) as AssetRow[]);
        setLiabilities((j.data?.liabilities ?? []) as LiabilityRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assetsAtYear = useMemo(
    () => assets.filter((r) => r.snapshot_year === year),
    [assets, year],
  );
  const liabilitiesAtYear = useMemo(
    () => liabilities.filter((r) => r.snapshot_year === year),
    [liabilities, year],
  );
  const assetTotal = assetsAtYear.reduce((s, r) => s + r.amount_idr, 0);
  const liaTotal = liabilitiesAtYear.reduce((s, r) => s + r.amount_idr, 0);

  async function addAsset() {
    const amt = Number(assetDraft.amount_idr);
    if (!(amt > 0)) return;
    setSubmitting(true);
    try {
      await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'asset',
          snapshot_year: year,
          category: assetDraft.category,
          amount_idr: amt,
          label: assetDraft.label.trim() || null,
          is_foreign: assetDraft.is_foreign,
        }),
      });
      setAssetDraft({ category: 'CASH_BANK', amount_idr: '', label: '', is_foreign: false });
      setAddingAsset(false);
      await load();
    } finally { setSubmitting(false); }
  }

  async function addLiability() {
    const amt = Number(liaDraft.amount_idr);
    if (!(amt > 0)) return;
    setSubmitting(true);
    try {
      await fetch('/api/customer/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'liability',
          snapshot_year: year,
          category: liaDraft.category,
          amount_idr: amt,
          label: liaDraft.label.trim() || null,
          creditor_name: liaDraft.creditor_name.trim() || null,
        }),
      });
      setLiaDraft({ category: 'BANK_LOAN', amount_idr: '', label: '', creditor_name: '' });
      setAddingLia(false);
      await load();
    } finally { setSubmitting(false); }
  }

  async function remove(kind: 'asset' | 'liability', id: string) {
    setSubmitting(true);
    try {
      await fetch('/api/customer/snapshots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, id }),
      });
      await load();
    } finally { setSubmitting(false); }
  }

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now - 2, now - 3, now - 4, now - 5];
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <PageTitle title="Harta dan Kewajiban" />
      <div className="mb-6">
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> {t('assetsPage.backToDashboard')}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('assetsPage.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('assetsPage.subtitle')}</p>
        </div>
        <label className="text-sm">
          <span className="text-gray-500 mr-2">{t('assetsPage.taxYear')}</span>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* ASSETS */}
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-100 via-green-50 to-teal-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{t('assetsLiabilities.assets')}</div>
                    <div className="text-xs text-gray-500">{t('assetsPage.total')}: <span className="font-bold text-emerald-700">{fmtIdr(assetTotal)}</span></div>
                  </div>
                </div>
                {!addingAsset && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm border-0"
                    onClick={() => setAddingAsset(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('assetsPage.addAsset')}
                  </Button>
                )}
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {assetsAtYear.length === 0 && !addingAsset && (
                  <div className="p-6 text-center text-sm text-gray-500">
                    {t('assetsLiabilities.emptyAssets')}
                  </div>
                )}

                {assetsAtYear.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        {t(`assetsLiabilities.assetCategory.${a.category}`)}
                        {a.is_foreign && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded">
                            {t('assetsPage.foreign')}
                          </span>
                        )}
                      </div>
                      {a.label && <div className="text-xs text-gray-500 truncate">{a.label}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-900">{fmtIdr(a.amount_idr)}</span>
                      <button
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        onClick={() => void remove('asset', a.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {addingAsset && (
                  <div className="p-4 bg-emerald-50/40 border-t border-dashed border-emerald-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="text-gray-500">{t('assetsPage.category')}</span>
                        <select
                          className="mt-0.5 w-full p-2 border rounded text-sm"
                          value={assetDraft.category}
                          onChange={(e) => setAssetDraft({ ...assetDraft, category: e.target.value as AssetCategory })}
                        >
                          {ASSET_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t(`assetsLiabilities.assetCategory.${c}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        <span className="text-gray-500">{t('assetsPage.amountIdr')}</span>
                        <input
                          className="mt-0.5 w-full p-2 border rounded text-sm font-mono"
                          type="number"
                          inputMode="numeric"
                          value={assetDraft.amount_idr}
                          onChange={(e) => setAssetDraft({ ...assetDraft, amount_idr: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <label className="text-xs block">
                      <span className="text-gray-500">{t('assetsPage.label')}</span>
                      <input
                        className="mt-0.5 w-full p-2 border rounded text-sm"
                        value={assetDraft.label}
                        onChange={(e) => setAssetDraft({ ...assetDraft, label: e.target.value })}
                        placeholder={t('assetsPage.labelPlaceholder')}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={assetDraft.is_foreign}
                        onChange={(e) => setAssetDraft({ ...assetDraft, is_foreign: e.target.checked })}
                      />
                      {t('assetsPage.isForeign')}
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setAddingAsset(false)}>{t('common.cancel')}</Button>
                      <Button
                        size="sm"
                        disabled={submitting || !(Number(assetDraft.amount_idr) > 0)}
                        onClick={() => void addAsset()}
                        className={cn(
                          'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0',
                        )}
                      >
                        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.save')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* LIABILITIES */}
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-rose-100 via-pink-50 to-red-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
                    <Landmark className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{t('assetsLiabilities.liabilities')}</div>
                    <div className="text-xs text-gray-500">{t('assetsPage.total')}: <span className="font-bold text-rose-700">{fmtIdr(liaTotal)}</span></div>
                  </div>
                </div>
                {!addingLia && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-sm border-0"
                    onClick={() => setAddingLia(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t('assetsPage.addLiability')}
                  </Button>
                )}
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {liabilitiesAtYear.length === 0 && !addingLia && (
                  <div className="p-6 text-center text-sm text-gray-500">
                    {t('assetsLiabilities.emptyLiabilities')}
                  </div>
                )}
                {liabilitiesAtYear.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800">{t(`assetsLiabilities.liabilityCategory.${l.category}`)}</div>
                      {(l.label || l.creditor_name) && (
                        <div className="text-xs text-gray-500 truncate">
                          {[l.label, l.creditor_name].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-900">{fmtIdr(l.amount_idr)}</span>
                      <button
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        onClick={() => void remove('liability', l.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {addingLia && (
                  <div className="p-4 bg-rose-50/40 border-t border-dashed border-rose-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="text-gray-500">{t('assetsPage.category')}</span>
                        <select
                          className="mt-0.5 w-full p-2 border rounded text-sm"
                          value={liaDraft.category}
                          onChange={(e) => setLiaDraft({ ...liaDraft, category: e.target.value as LiabilityCategory })}
                        >
                          {LIABILITY_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t(`assetsLiabilities.liabilityCategory.${c}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        <span className="text-gray-500">{t('assetsPage.amountIdr')}</span>
                        <input
                          className="mt-0.5 w-full p-2 border rounded text-sm font-mono"
                          type="number"
                          inputMode="numeric"
                          value={liaDraft.amount_idr}
                          onChange={(e) => setLiaDraft({ ...liaDraft, amount_idr: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <label className="text-xs block">
                      <span className="text-gray-500">{t('assetsPage.creditor')}</span>
                      <input
                        className="mt-0.5 w-full p-2 border rounded text-sm"
                        value={liaDraft.creditor_name}
                        onChange={(e) => setLiaDraft({ ...liaDraft, creditor_name: e.target.value })}
                        placeholder={t('assetsPage.creditorPlaceholder')}
                      />
                    </label>
                    <label className="text-xs block">
                      <span className="text-gray-500">{t('assetsPage.label')}</span>
                      <input
                        className="mt-0.5 w-full p-2 border rounded text-sm"
                        value={liaDraft.label}
                        onChange={(e) => setLiaDraft({ ...liaDraft, label: e.target.value })}
                        placeholder={t('assetsPage.liaLabelPlaceholder')}
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setAddingLia(false)}>{t('common.cancel')}</Button>
                      <Button
                        size="sm"
                        disabled={submitting || !(Number(liaDraft.amount_idr) > 0)}
                        onClick={() => void addLiability()}
                        className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-0"
                      >
                        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.save')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400 text-center">
        {t('assetsPage.footnote')}
      </p>
    </div>
  );
}
