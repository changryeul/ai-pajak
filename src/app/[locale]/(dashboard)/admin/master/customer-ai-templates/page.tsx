'use client';

/**
 * /admin/master/customer-ai-templates — MASTER CRUD for customer_ai_template.
 *
 * Phase 2.4: operator 가 customer-inbox dropdown 에서 한 번 클릭으로 답변에
 * 적용. MASTER 가 여기서 직접 add/edit/delete.
 *
 * Pattern: luxury-classifications/page.tsx (commit f242e9f) 미러.
 * body 가 multi-line 이므로 inline edit + create modal 둘 다 textarea.
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
  MessageSquare,
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
  CustomerAiTemplate,
  CustomerAiTemplateCreate,
  CustomerAiTemplatePatch,
} from '@/types/customer-ai-template';

export default function CustomerAiTemplatesPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const t = useTranslations('customerAiTemplates');

  const [rows, setRows] = useState<CustomerAiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerAiTemplatePatch>({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ id: string; kind: 'saved' | 'error' } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<CustomerAiTemplateCreate>({
    title: '',
    body: '',
    category: '',
    is_active: true,
    display_order: 0,
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
      const r = await fetch('/api/admin/master/customer-ai-templates');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      setRows((j.data ?? []) as CustomerAiTemplate[]);
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
  const startEdit = (row: CustomerAiTemplate) => {
    setEditingId(row.id);
    setDraft({
      title: row.title,
      body: row.body,
      category: row.category ?? '',
      is_active: row.is_active,
      display_order: row.display_order,
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
    const diff: CustomerAiTemplatePatch = {};
    for (const k of ['title', 'body', 'category', 'is_active', 'display_order'] as const) {
      let draftVal = draft[k];
      // Normalize empty string in nullable category → null
      if (k === 'category' && draftVal === '') draftVal = null;
      const origVal = original[k];
      if (draftVal !== undefined && draftVal !== origVal) {
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
        `/api/admin/master/customer-ai-templates?id=${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(diff),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      const updated = j.data as CustomerAiTemplate;
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
  const onDelete = async (row: CustomerAiTemplate) => {
    if (!confirm(t('confirmDelete', { name: row.title }))) return;
    try {
      const r = await fetch(
        `/api/admin/master/customer-ai-templates?id=${row.id}`,
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
    if (!createDraft.title.trim()) {
      alert(t('titleRequired'));
      return;
    }
    if (!createDraft.body.trim()) {
      alert(t('bodyRequired'));
      return;
    }
    setCreating(true);
    try {
      const body: CustomerAiTemplateCreate = {
        title: createDraft.title.trim(),
        body: createDraft.body.trim(),
        category: createDraft.category?.toString().trim() || null,
        is_active: createDraft.is_active ?? true,
        display_order: createDraft.display_order ?? 0,
      };
      const r = await fetch('/api/admin/master/customer-ai-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
      const created = j.data as CustomerAiTemplate;
      // Insert in correct sorted position (by display_order, then title).
      setRows((rs) =>
        [...rs, created].sort(
          (a, b) =>
            a.display_order - b.display_order ||
            a.title.localeCompare(b.title),
        ),
      );
      setShowCreate(false);
      setCreateDraft({
        title: '',
        body: '',
        category: '',
        is_active: true,
        display_order: 0,
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
              <MessageSquare className="h-6 w-6 text-indigo-600" />
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
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('countTotal')}
          </div>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            {t('countActive')}
          </div>
          <p className="text-2xl font-bold text-emerald-700">
            {rows.filter((r) => r.is_active).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2.5 font-bold w-12">{t('colOrder')}</th>
                <th className="text-left px-3 py-2.5 font-bold w-40">{t('colTitle')}</th>
                <th className="text-left px-3 py-2.5 font-bold w-24">{t('colCategory')}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t('colBody')}</th>
                <th className="text-left px-3 py-2.5 font-bold w-16">{t('colActive')}</th>
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
                    : !row.is_active
                    ? 'opacity-50'
                    : undefined;

                return (
                  <tr key={row.id} className={rowCls}>
                    {editing ? (
                      <>
                        <td className="px-2 py-2 align-top">
                          <input
                            type="number"
                            className="w-14 rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.display_order ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                display_order: parseInt(e.target.value || '0', 10),
                              }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.title ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, title: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={draft.category ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, category: e.target.value }))
                            }
                            placeholder={t('placeholderCategory')}
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <textarea
                            rows={4}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                            value={draft.body ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, body: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-2 py-2 align-top text-center">
                          <input
                            type="checkbox"
                            checked={draft.is_active ?? true}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, is_active: e.target.checked }))
                            }
                            className="h-4 w-4"
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
                        <td className="px-3 py-2.5 font-mono text-slate-500">
                          {row.display_order}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900 align-top">
                          {row.title}
                          {flashState === 'saved' && (
                            <span className="ml-2 text-[10px] text-emerald-600">
                              ✓ {t('savedToast')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {row.category ? (
                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                              {row.category}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 align-top">
                          <div className="whitespace-pre-wrap leading-relaxed max-w-xl">
                            {row.body}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center align-top">
                          {row.is_active ? (
                            <span className="text-emerald-600 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-300">·</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top">
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
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              {t('createTitle')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('colTitle')} *
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={createDraft.title}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder={t('placeholderTitle')}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('colBody')} *
                </label>
                <textarea
                  rows={6}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
                  value={createDraft.body ?? ''}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, body: e.target.value }))
                  }
                  placeholder={t('placeholderBody')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('colCategory')}
                  </label>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={createDraft.category ?? ''}
                    onChange={(e) =>
                      setCreateDraft((d) => ({ ...d, category: e.target.value }))
                    }
                    placeholder={t('placeholderCategory')}
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('colOrder')}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={createDraft.display_order ?? 0}
                    onChange={(e) =>
                      setCreateDraft((d) => ({
                        ...d,
                        display_order: parseInt(e.target.value || '0', 10),
                      }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={createDraft.is_active ?? true}
                  onChange={(e) =>
                    setCreateDraft((d) => ({ ...d, is_active: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                <span className="font-bold text-slate-700">{t('colActive')}</span>
              </label>
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
