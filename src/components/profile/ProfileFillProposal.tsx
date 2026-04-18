'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldProposal, ProposalField } from '@/lib/profile/from-ocr';

interface Props {
  proposals: FieldProposal[];
  /**
   * Called when the user clicks "Apply selected". Receives the subset of
   * proposals the user checked. The caller runs the PATCH request and then
   * calls onDismiss (or swaps the component out) once it resolves.
   */
  onApply: (accepted: FieldProposal[]) => Promise<void> | void;
  onDismiss: () => void;
  applying?: boolean;
  /** Override the default "A1" / "KK" source label if you already know it. */
  sourceLabel?: string;
}

/**
 * Renders an OCR extraction result as a diff-style approval list. Each field
 * shows the current value (strikethrough if a new value was proposed and
 * accepted) and the proposed value, with the proposed row colour-coded based
 * on whether it conflicts with an existing non-empty value.
 *
 * Policy (outside voice #4): nothing is written until the user explicitly
 * accepts the field. Conflicts default to UNCHECKED; blank-field proposals
 * default to CHECKED.
 */
export function ProfileFillProposal({
  proposals,
  onApply,
  onDismiss,
  applying = false,
  sourceLabel,
}: Props) {
  const t = useTranslations();

  // Initialise checked state: auto-check proposals that don't conflict.
  // Conflicts start unchecked so the user must actively confirm an overwrite.
  const [accepted, setAccepted] = useState<Set<ProposalField>>(() => {
    const s = new Set<ProposalField>();
    for (const p of proposals) {
      if (!p.conflict && p.proposedValue !== null) s.add(p.field);
    }
    return s;
  });

  const toggle = (field: ProposalField) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const acceptedList = useMemo(
    () => proposals.filter((p) => accepted.has(p.field)),
    [proposals, accepted],
  );

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500 text-center">
          {t('profile.proposalEmpty')}
          <Button variant="outline" size="sm" className="mt-3" onClick={onDismiss}>
            {t('common.close')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sourceName = sourceLabel ?? proposals[0]?.source ?? '';
  const conflictCount = proposals.filter((p) => p.conflict).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-blue-600" />
          {t('profile.proposalTitle')}
          <span className="text-xs font-normal text-gray-500">· {sourceName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">{t('profile.proposalIntro')}</p>

        {conflictCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>{t('profile.proposalConflictWarning', { count: conflictCount })}</div>
          </div>
        )}

        <ul className="divide-y rounded-lg border">
          {proposals.map((p) => {
            const isChecked = accepted.has(p.field);
            const hasCurrent = p.currentValue !== null && p.currentValue !== '' && p.currentValue !== undefined;
            return (
              <li key={p.field} className="p-3 flex items-start gap-3">
                <input
                  id={`proposal-${p.field}`}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(p.field)}
                  className="mt-1"
                />
                <label htmlFor={`proposal-${p.field}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {t(p.label)}
                    {p.conflict && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        {t('profile.proposalConflictTag')}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs">
                    {hasCurrent && (
                      <div className="text-gray-400">
                        <span className="mr-1">{t('profile.proposalCurrent')}:</span>
                        <span className={cn(isChecked && p.conflict && 'line-through')}>
                          {String(p.currentValue)}
                        </span>
                      </div>
                    )}
                    <div className={cn(p.conflict ? 'text-amber-700' : 'text-emerald-700', 'font-medium')}>
                      <span className="mr-1">{t('profile.proposalNew')}:</span>
                      <span>{p.proposedValue === null ? '—' : String(p.proposedValue)}</span>
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onDismiss} disabled={applying}>
            <X className="h-4 w-4 mr-1" />
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => onApply(acceptedList)}
            disabled={applying || acceptedList.length === 0}
          >
            <Check className="h-4 w-4 mr-1" />
            {applying
              ? t('common.loading')
              : t('profile.proposalApply', { count: acceptedList.length })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
