'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TaxCodeRule, TaxCodeRulePatch } from '@/types/tax-code-rule';

interface Props {
  initialRules: TaxCodeRule[];
  canEdit: boolean;
}

async function patchRule(id: string, patch: TaxCodeRulePatch): Promise<TaxCodeRule> {
  const r = await fetch(`/api/admin/tax-code-rule/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
  return j.data as TaxCodeRule;
}

function isRecentlyUpdated(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

export function TaxCodeRulesTable({ initialRules, canEdit }: Props) {
  const t = useTranslations('operatorSettings.rules');
  const router = useRouter();
  const [rules, setRules] = useState<TaxCodeRule[]>(initialRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaxCodeRulePatch>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (row: TaxCodeRule) => {
    setEditingId(row.id);
    setDraft({
      tax_code: row.tax_code,
      rate_rule: row.rate_rule,
      condition_text: row.condition_text,
      doc_required: row.doc_required,
      review_note: row.review_note,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const original = rules.find((r) => r.id === editingId);
    if (!original) return;
    const diff: TaxCodeRulePatch = {};
    for (const k of ['tax_code', 'rate_rule', 'condition_text', 'doc_required', 'review_note'] as const) {
      if (draft[k] !== undefined && draft[k] !== original[k]) {
        diff[k] = draft[k];
      }
    }
    if (Object.keys(diff).length === 0) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const updated = await patchRule(editingId, diff);
      setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
      setDraft({});
      toast.success(t('saveSuccess'));
      // Refresh the server component so SSR also reflects the new value next visit.
      router.refresh();
    } catch (err) {
      toast.error(t('saveError', { message: (err as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-3 py-2">{t('colCategory')}</th>
            <th className="text-left px-3 py-2">{t('colCode')}</th>
            <th className="text-left px-3 py-2">{t('colRate')}</th>
            <th className="text-left px-3 py-2">{t('colCondition')}</th>
            <th className="text-left px-3 py-2">{t('colDoc')}</th>
            <th className="text-left px-3 py-2">{t('colReview')}</th>
            {canEdit && (
              <th className="px-3 py-2 w-20">
                <span className="sr-only">{t('editButton')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rules.map((r) => {
            const editing = editingId === r.id;
            const recent = isRecentlyUpdated(r.updated_at);
            return (
              <tr key={r.id} className={editing ? 'bg-amber-50' : undefined}>
                <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                  {r.category}
                  {recent && (
                    <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                      {t('recentlyUpdated')}
                    </span>
                  )}
                </td>
                {editing ? (
                  <>
                    <td className="px-2 py-2"><input aria-label={t('colCode')} className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs" value={draft.tax_code ?? ''} onChange={(e) => setDraft((d) => ({ ...d, tax_code: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea aria-label={t('colRate')}      className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.rate_rule ?? ''}      onChange={(e) => setDraft((d) => ({ ...d, rate_rule: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea aria-label={t('colCondition')} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.condition_text ?? ''} onChange={(e) => setDraft((d) => ({ ...d, condition_text: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea aria-label={t('colDoc')}       className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.doc_required ?? ''}   onChange={(e) => setDraft((d) => ({ ...d, doc_required: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea aria-label={t('colReview')}    className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.review_note ?? ''}    onChange={(e) => setDraft((d) => ({ ...d, review_note: e.target.value }))} /></td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <button type="button" disabled={saving} onClick={saveEdit} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          {saving ? t('savingLabel') : t('saveButton')}
                        </button>
                        <button type="button" disabled={saving} onClick={cancelEdit} className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {t('cancelButton')}
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 font-mono text-slate-700">{r.tax_code}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.rate_rule}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.condition_text}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.doc_required}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.review_note}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={editingId !== null}
                          onClick={() => startEdit(r)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                        >
                          {t('editButton')}
                        </button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!canEdit && (
        <p className="mt-2 text-[10px] text-slate-400">{t('masterOnlyTooltip')}</p>
      )}
    </div>
  );
}
