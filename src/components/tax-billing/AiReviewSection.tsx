'use client';

/**
 * AiReviewSection — shown at the top of /tax/billing when the AI/operator
 * has flagged fields on the customer's submitted data and is waiting for a
 * correction.
 *
 * Per keynote slide-21:
 *   "AI가 입력한 양식을 띄워서 수정을 원하는 란에 빨간 테두리로 표기를 해서
 *    고객이 인지하여 데이터 값을 수정하거나 입력하게 합니다."
 *
 * Each flagged field renders as an inline editable input bordered in red,
 * with the AI's reason as a hint. When the customer saves, the section
 * posts to /api/customer/ai-review which merges the corrections and
 * advances the queue row to PENDING_APPROVAL.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, Sparkles, CheckCircle } from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface FlaggedField {
  key: string;
  label: string;
  reason: string;
  currentValue?: string | number | null;
  suggestedValue?: string | number | null;
  inputType?: 'text' | 'number' | 'date';
}

interface ReviewItem {
  id: string;
  taxType: string;
  period: string;
  amount: number;
  counterpartyName: string | null;
  flaggedFields: FlaggedField[];
  submittedData: Record<string, unknown>;
}

export default function AiReviewSection({ onDone }: { onDone?: () => void }) {
  const t = useTranslations('aiReview');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/ai-review', { credentials: 'include' });
      const data = await res.json();
      if (data?.success) {
        const next = (data.data.items as ReviewItem[]) ?? [];
        setItems(next);
        const seed: Record<string, Record<string, string>> = {};
        for (const it of next) {
          seed[it.id] = {};
          for (const f of it.flaggedFields) {
            seed[it.id][f.key] = String(f.currentValue ?? '');
          }
        }
        setEdits(seed);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(
    async (item: ReviewItem) => {
      setSaving(item.id);
      try {
        const payload = edits[item.id] || {};
        const res = await fetch('/api/customer/ai-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ queueItemId: item.id, updatedFields: payload }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || t('submitFailed'));
        showMsg('success', t('submitSuccess'));
        setItems((prev) => prev.filter((p) => p.id !== item.id));
        if (onDone) onDone();
      } catch (e) {
        showMsg('error', e instanceof Error ? e.message : t('submitFailed'));
      } finally {
        setSaving(null);
      }
    },
    [edits, t, onDone],
  );

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <Card className="mb-5 border border-amber-200 bg-amber-50/40 shadow-none">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-0.5 rounded-full bg-amber-100 p-1.5">
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-amber-900">{t('sectionTitle')}</p>
            <p className="text-xs text-amber-700 mt-1">{t('sectionSubtitle')}</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-3 p-2.5 rounded-md text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-200 bg-white p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.taxType}
                    <span className="ml-2 text-[11px] text-gray-500 font-normal">
                      {item.period}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {item.counterpartyName ?? '—'} · {fmtRp(item.amount)}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                  {t('flaggedCount', { n: item.flaggedFields.length })}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {item.flaggedFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="block text-[11px] font-medium text-gray-700">
                      {f.label}
                    </label>
                    <Input
                      type={f.inputType === 'number' ? 'number' : f.inputType === 'date' ? 'date' : 'text'}
                      className="h-9 text-xs border-red-400 focus-visible:ring-red-500 focus-visible:border-red-500 bg-red-50/30"
                      value={edits[item.id]?.[f.key] ?? ''}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [item.id]: { ...(prev[item.id] ?? {}), [f.key]: e.target.value },
                        }))
                      }
                    />
                    <p className="text-[10px] text-red-700 flex items-start gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                      <span>{f.reason}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  size="sm"
                  className="h-8 px-4 text-[11px] bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={saving === item.id}
                  onClick={() => submit(item)}
                >
                  {saving === item.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {t('submitBtn')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
