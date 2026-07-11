'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface Props {
  initial: { enabled: boolean; updatedAt: string | null; updatedBy: string | null };
  canEdit: boolean;
}

export function MfaPolicyCard({ initial, canEdit }: Props) {
  const t = useTranslations('operatorSettings.header');
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/security/operator-mfa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setEnabled(j.data.enabled);
      toast.success(t(j.data.enabled ? 'mfaPolicyOn' : 'mfaPolicyOff'));
      router.refresh();
    } catch (e) {
      toast.error(`${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const cls = enabled
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-amber-50 border-amber-200';
  const valueLabel = t(enabled ? 'mfaPolicyOn' : 'mfaPolicyOff');

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{t('mfaPolicy')}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-base font-black text-slate-900">{valueLabel}</p>
        {canEdit && (
          <button
            type="button"
            disabled={saving}
            onClick={toggle}
            className={`rounded px-2 py-1 text-[10px] font-bold border ${enabled ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-amber-700 text-white border-amber-800'} disabled:opacity-50`}
            aria-pressed={enabled}
            aria-busy={saving}
          >
            {saving ? '…' : t('mfaPolicyToggle')}
          </button>
        )}
      </div>
    </div>
  );
}
