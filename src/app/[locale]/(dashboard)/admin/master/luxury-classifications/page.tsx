'use client';

/**
 * /admin/master/luxury-classifications — MASTER CRUD for luxury_item_classifications.
 *
 * Phase 3.3 의 classifyLuxuryBatch() 가 description substring 으로 자동 분류하기
 * 위해 사용하는 seed 테이블. 분류 정확도 튜닝을 위해 MASTER 가 직접 관리.
 *
 * Pattern: TaxCodeRulesTable (commit 4ec1a0e) 의 inline-edit 패턴을 차용
 * — react-query 없이 fetch + useState 로 plain React. 추가로 신규 추가 modal
 * + 삭제 confirm 까지 포함.
 *
 * RBAC:
 *   - 페이지 진입 자체는 useEffect role guard 로 MASTER 가 아니면 /dashboard 로.
 *   - 모든 PATCH/POST/DELETE 는 서버에서 MASTER 만 통과 (이중 게이트).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import type {
  LuxuryCategory,
  LuxuryClassification,
  LuxuryClassificationCreate,
  LuxuryClassificationPatch,
} from '@/types/luxury-classification';

const CATEGORIES: LuxuryCategory[] = ['LUXURY', 'ESSENTIAL', 'SPECIAL'];

interface CategoryStyle {
  badge: string;
  emoji: string;
}
const CATEGORY_STYLES: Record<LuxuryCategory, CategoryStyle> = {
  LUXURY:    { badge: 'bg-amber-100 text-amber-800 border-amber-200', emoji: '💎' },
  ESSENTIAL: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', emoji: '' },
  SPECIAL:   { badge: 'bg-blue-100 text-blue-800 border-blue-200', emoji: '' },
};

export default function LuxuryClassificationsPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const t = useTranslations('luxuryClassifications');

  const [rows, setRows] = useState<LuxuryClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LuxuryClassificationPatch>({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ id: string; kind: 'saved' | 'error' } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<LuxuryClassificationCreate>({
    item_name: '',
    category: 'LUXURY',
    hs_code: '',
    ppn_treatment: '',
    legal_basis: '',
  });
  const [creating, setCreating] = useState(false);

  // ── Role guard: master-only ─────────────────────────────────────────
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (!hasRole(session, UserRole.TAX_OPERATOR_MASTER)) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  // ── Load ───────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch('/api/admin/master/luxury-classifications');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      setRows((j.data ?? []) as LuxuryClassification[]);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Flash helpers ──────────────────────────────────────────────────
  const showFlash = (id: string, kind: 'saved' | 'error') => {
    setFlash({ id, kind });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 2200);
  };

  // ── Inline edit ────────────────────────────────────────────────────
  const startEdit = (row: LuxuryClassification) => {
    setEditingId(row.id);
    setDraft({
      item_name: row.item_name,
      hs_code: row.hs_code ?? '',
      category: row.category,
      ppn_treatment: row.ppn_treatment ?? '',
      legal_basis: row.legal_basis ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const original = rows.find((r) => r.id === editingId);
    if (!original) return;
    const diff: LuxuryClassificationPatch = {};
    for (const k of ['item_name', 'hs_code', 'category', 'ppn_treatment', 'legal_basis'] as const) {
      const draftVal = draft[k] === '' ? null : draft[k];
      const origVal = original[k];
      // category never null, item_name validated server-side
      if (draftVal !== undefined && draftVal !== origVal) {
        // For nullable fields turn empty string into null.
        (diff as Record<string, unknown>)[k] = draftVal;
      }
    }
    if (Object.keys(diff).length === 0) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(
        `/api/admin/master/luxury-classifications?id=${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(diff),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      const updated = j.data as LuxuryClassification;
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
      setDraft({});
      showFlash(updated.id, 'saved');
    } catch (e) {
      console.error('PATCH failed', e);
      showFlash(editingId, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const onDelete = async (row: LuxuryClassification) => {
    if (!confirm(t('confirmDelete', { name: row.item_name }))) return;
    try {
      const r = await fetch(
        `/api/admin/master/luxury-classifications?id=${row.id}`,
        { method: 'DELETE' },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      alert(t('saveFailed') + ': ' + (e as Error).message);
    }
  };

  // ── Create ─────────────────────────────────────────────────────────
  const onCreate = async () => {
    if (!createDraft.item_name.trim()) {
      alert(t('itemNameRequired'));
      return;
    }
    setCreating(true);
    try {
      const body: LuxuryClassificationCreate = {
        item_name: createDraft.item_name.trim(),
        category: createDraft.category,
        hs_code: createDraft.hs_code?.toString().trim() || null,
        ppn_treatment: createDraft.ppn_treatment?.toString().trim() || null,
        legal_basis: createDraft.legal_basis?.toString().trim() || null,
      };
      const r = await fetch('/api/admin/master/luxury-classifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      const created = j.data as LuxuryClassification;
      setRows((rs) => [created, ...rs]);
      setShowCreate(false);
      setCreateDraft({
        item_name: '',
        category: 'LUXURY',
        hs_code: '',
        ppn_treatment: '',
        legal_basis: '',
      });
      showFlash(created.id, 'saved');
    } catch (e) {
      alert(t('saveFailed') + ': ' + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (sessionLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    );
  }

  // Group by category for visual organization.
  const grouped: Record<LuxuryCategory, LuxuryClassification[]> = {
    LUXURY: [],
    ESSENTIAL: [],
    SPECIAL: [],
  };
  for (const r of rows) grouped[r.category].push(r);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/${locale}/admin/master`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('backToMaster')}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-600" />
              {t('title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('desc')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addNew')}
          </button>
        </div>
      </div>

      {/* Count summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {CATEGORIES.map((cat) => {
          const style = CATEGORY_STYLES[cat];
          return (
            <div key={cat} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                {style.emoji && <span className="text-base">{style.emoji}</span>}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t(`cat_${cat}` as 'cat_LUXURY')}
                </span>
              </div>
              <p className="text-2xl font-bold">{grouped[cat].length}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2.5 font-bold">{t('colItemName')}</th>
                <th className="text-left px-3 py-2.5 font-bold w-28">{t('colHsCode')}</th>
                <th className="text-left px-3 py-2.5 font-bold w-32">{t('colCategory')}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t('colPpnTreatment')}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t('colLegalBasis')}</th>
                <th className="px-3 py-2.5 w-28 text-right">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    {t('emptyList')}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const editing = editingId === row.id;
                const flashState = flash?.id === row.id ? flash.kind : null;
                const rowCls =
                  flashState === 'saved'
                    ? 'bg-emerald-50/70'
                    : flashState === 'error'
                    ? 'bg-red-50/70'
                    : editing
                    ? 'bg-amber-50'
                    : undefined;
                const style = CATEGORY_STYLES[row.category];

                return (
                  <tr key={row.id} className={rowCls}>
                    {editing ? (
                      <>
                        <td className="px-2 py-2">
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.item_name ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, item_name: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                            value={draft.hs_code ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, hs_code: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.category ?? 'LUXURY'}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                category: e.target.value as LuxuryCategory,
                              }))
                            }
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {t(`cat_${c}` as 'cat_LUXURY')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <textarea
                            rows={2}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.ppn_treatment ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, ppn_treatment: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <textarea
                            rows={2}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.legal_basis ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, legal_basis: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={saveEdit}
                              className="inline-flex items-center justify-center gap-0.5 rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              {saving ? t('saving') : t('saveButton')}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={cancelEdit}
                              className="inline-flex items-center justify-center gap-0.5 rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" />
                              {t('cancelButton')}
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {row.item_name}
                          {flashState === 'saved' && (
                            <span className="ml-2 text-[10px] text-emerald-600">
                              ✓ {t('savedToast')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700">
                          {row.hs_code || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}
                          >
                            {style.emoji}
                            {t(`cat_${row.category}` as 'cat_LUXURY')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {row.ppn_treatment || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {row.legal_basis || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              disabled={editingId !== null}
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-0.5 rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                            >
                              <Pencil className="h-3 w-3" />
                              {t('editButton')}
                            </button>
                            <button
                              type="button"
                              disabled={editingId !== null}
                              onClick={() => onDelete(row)}
                              className="inline-flex items-center gap-0.5 rounded border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-30"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              {t('createTitle')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('colItemName')} *
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={createDraft.item_name}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, item_name: e.target.value }))
                  }
                  placeholder={t('itemNamePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('colCategory')} *
                  </label>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={createDraft.category}
                    onChange={(e) =>
                      setCreateDraft((d) => ({
                        ...d,
                        category: e.target.value as LuxuryCategory,
                      }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`cat_${c}` as 'cat_LUXURY')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('colHsCode')}
                  </label>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
                    value={createDraft.hs_code ?? ''}
                    onChange={(e) =>
                      setCreateDraft((d) => ({ ...d, hs_code: e.target.value }))
                    }
                    placeholder="HS code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('colPpnTreatment')}
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={createDraft.ppn_treatment ?? ''}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, ppn_treatment: e.target.value }))
                  }
                  placeholder="Full 12% PPN"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('colLegalBasis')}
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={createDraft.legal_basis ?? ''}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, legal_basis: e.target.value }))
                  }
                  placeholder="PMK 131/2024 Lampiran A"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => setShowCreate(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('cancelButton')}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={onCreate}
                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {creating ? t('saving') : t('createButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
