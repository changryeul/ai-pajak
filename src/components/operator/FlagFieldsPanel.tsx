'use client';

/**
 * FlagFieldsPanel — operator-side companion to the customer's AiReviewSection.
 *
 * For a single djp_submission_queue row, lets the operator:
 *   - Run an AI suggestion pass (deterministic checks on submitted data).
 *   - Manually add / edit / delete flag rows (key / label / reason).
 *   - Save → writes review_summary.ai_flagged_fields and parks the row at
 *     DATA_REVIEW so the customer sees it on /tax/billing.
 *
 * Called from /operator/review in a collapsible panel per queue item.
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Sparkles, Trash2, Save, AlertTriangle, CheckCircle } from 'lucide-react';

interface FlaggedField {
  key: string;
  label: string;
  reason: string;
  currentValue?: string | number | null;
  inputType?: 'text' | 'number' | 'date';
}

interface Props {
  queueItemId: string;
  initialFields?: FlaggedField[];
  onSaved?: () => void;
}

function emptyField(): FlaggedField {
  return { key: '', label: '', reason: '', currentValue: '', inputType: 'text' };
}

export default function FlagFieldsPanel({ queueItemId, initialFields, onSaved }: Props) {
  const t = useTranslations('flagFields');
  const [fields, setFields] = useState<FlaggedField[]>(
    initialFields && initialFields.length > 0 ? initialFields : [emptyField()],
  );
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const update = (idx: number, patch: Partial<FlaggedField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const remove = (idx: number) => {
    setFields((prev) => (prev.length <= 1 ? [emptyField()] : prev.filter((_, i) => i !== idx)));
  };
  const add = () => setFields((prev) => [...prev, emptyField()]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const res = await fetch('/api/operator/queue/suggest-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ queueItemId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Suggestion failed');
      }
      const list = (data.data.suggestions as FlaggedField[]) ?? [];
      if (list.length === 0) {
        showMsg('success', t('msg.nothingMissing'));
        return;
      }
      setFields((prev) => {
        const existingKeys = new Set(prev.map((f) => f.key).filter(Boolean));
        const filtered = prev.filter((f) => f.key || f.label || f.reason);
        const additions = list.filter((f) => !existingKeys.has(f.key));
        return [...filtered, ...additions];
      });
      showMsg('success', t('msg.suggested', { n: list.length }));
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : t('msg.suggestFailed'));
    } finally {
      setSuggesting(false);
    }
  }, [queueItemId, t]);

  const save = useCallback(async () => {
    // Drop empty rows before saving
    const clean = fields.filter((f) => f.key.trim() && f.label.trim() && f.reason.trim());
    setSaving(true);
    try {
      const res = await fetch('/api/operator/queue/flag-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          queueItemId,
          fields: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || t('msg.saveFailed'));
      }
      showMsg(
        'success',
        clean.length === 0
          ? t('msg.clearedAll')
          : t('msg.savedRequest', { n: clean.length }),
      );
      if (onSaved) onSaved();
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : t('msg.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [fields, queueItemId, onSaved, t]);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          {t('heading')}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={suggesting}
          onClick={suggest}
        >
          {suggesting ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {t('suggestBtn')}
        </Button>
      </div>

      {message && (
        <div
          className={`p-2 rounded-md text-[11px] flex items-center gap-1.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        {fields.map((f, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[110px_160px_1fr_90px_32px] gap-2 items-start"
          >
            <Input
              className="h-8 text-[11px] font-mono"
              placeholder="key"
              value={f.key}
              onChange={(e) => update(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            />
            <Input
              className="h-8 text-[11px]"
              placeholder={t('labelPlaceholder')}
              value={f.label}
              onChange={(e) => update(idx, { label: e.target.value })}
            />
            <Textarea
              className="min-h-[32px] text-[11px] py-1.5"
              rows={1}
              placeholder={t('reasonPlaceholder')}
              value={f.reason}
              onChange={(e) => update(idx, { reason: e.target.value })}
            />
            <select
              className="h-8 rounded border border-input bg-white px-2 text-[11px]"
              value={f.inputType ?? 'text'}
              onChange={(e) =>
                update(idx, { inputType: e.target.value as FlaggedField['inputType'] })
              }
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="date">date</option>
            </select>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => remove(idx)}
              aria-label={t('removeAria')}
            >
              <Trash2 className="h-3 w-3 text-gray-400" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={add}>
          <Plus className="h-3 w-3 mr-1" />
          {t('addRow')}
        </Button>
        <Button
          size="sm"
          className="h-8 text-[11px] bg-amber-600 hover:bg-amber-700 text-white"
          disabled={saving}
          onClick={save}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          {t('saveBtn')}
        </Button>
      </div>
    </div>
  );
}
