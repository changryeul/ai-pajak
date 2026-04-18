'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileFillProposal } from '@/components/profile/ProfileFillProposal';
import {
  mapA1ToProfileProposals,
  proposalsToPatchPayload,
  type FieldProposal,
  type ProposalContext,
} from '@/lib/profile/from-ocr';
import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

type Phase = 'idle' | 'uploading' | 'proposing' | 'applying' | 'done' | 'error';

interface CurrentProfile {
  full_name?: string | null;
  npwp?: string | null;
  nik?: string | null;
  spouse_name?: string | null;
  spouse_npwp?: string | null;
  spouse_annual_income?: number | null;
  spouse_withheld_tax?: number | null;
}

interface Props {
  /** Current customer row, used to compute conflicts. Pass an empty object if unknown. */
  current: CurrentProfile;
  /** Called after the PATCH succeeds so the parent can re-fetch the profile. */
  onApplied?: () => void;
}

/**
 * End-to-end document → profile flow:
 *   1. User picks a 1721-A1 file (self) or the spouse's 1721-A1 (spouse).
 *   2. POST /api/documents/ocr-extract with expectedCategory=BUKTI_POTONG.
 *   3. Map the OCR result to FieldProposals (pure function; covered by tests).
 *   4. ProfileFillProposal renders the diff + checkboxes.
 *   5. Accepted proposals → PATCH /api/customer/profile.
 *
 * Never writes silently — outside voice #4.
 */
export function DocumentToProfileUploader({ current, onApplied }: Props) {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [context, setContext] = useState<ProposalContext>('self');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [proposals, setProposals] = useState<FieldProposal[]>([]);

  const reset = () => {
    setPhase('idle');
    setError('');
    setProposals([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setPhase('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('expectedCategory', 'BUKTI_POTONG');
      const res = await fetch('/api/documents/ocr-extract', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || json.error || t('errors.serverError'));
        setPhase('error');
        return;
      }
      // processForm1721A1 returns OCRResult with extractedData of type Form1721A1Data
      const ocrData = (json.data?.extractedData ?? json.data) as Form1721A1Data;
      const out = mapA1ToProfileProposals(ocrData, current, context);
      setProposals(out);
      setPhase('proposing');
    } catch {
      setError(t('errors.serverError'));
      setPhase('error');
    }
  };

  const handleApply = async (accepted: FieldProposal[]) => {
    setPhase('applying');
    try {
      const acceptedSet = new Set(accepted.map((p) => p.field));
      const patch = proposalsToPatchPayload(proposals, acceptedSet);
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('patch_failed');
      setPhase('done');
      onApplied?.();
      // Brief success state, then collapse back to idle so the user can
      // upload another slip without extra clicks.
      setTimeout(reset, 1500);
    } catch {
      setError(t('errors.serverError'));
      setPhase('error');
    }
  };

  if (phase === 'proposing' || phase === 'applying') {
    return (
      <ProfileFillProposal
        proposals={proposals}
        applying={phase === 'applying'}
        onApply={handleApply}
        onDismiss={reset}
        sourceLabel={context === 'spouse' ? t('profile.ocrForSpouse') : t('profile.ocrForSelf')}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4 text-blue-600" />
          {t('profile.ocrUploadTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">{t('profile.ocrUploadIntro')}</p>

        {/* Context toggle: self vs spouse */}
        <fieldset>
          <legend className="text-sm font-medium mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {t('profile.ocrWhose')}
          </legend>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setContext('self')}
              className={cn(
                'px-3 py-1.5 rounded border text-sm transition-colors',
                context === 'self'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
              )}
            >
              {t('profile.ocrForSelf')}
            </button>
            <button
              type="button"
              onClick={() => setContext('spouse')}
              className={cn(
                'px-3 py-1.5 rounded border text-sm transition-colors',
                context === 'spouse'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
              )}
            >
              {t('profile.ocrForSpouse')}
            </button>
          </div>
        </fieldset>

        {/* Upload picker */}
        <label className="block">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={phase === 'uploading'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              phase === 'uploading'
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50',
            )}
          >
            {phase === 'uploading' ? (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('profile.ocrProcessing')}
              </div>
            ) : (
              <>
                <FileUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-700">{t('profile.ocrDropzone')}</div>
                <div className="mt-1 text-xs text-gray-500">{t('profile.ocrAccepted')}</div>
              </>
            )}
          </div>
        </label>

        {phase === 'done' && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            ✓ {t('profile.ocrApplied')}
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 flex items-center justify-between">
            <span>{error || t('errors.serverError')}</span>
            <Button variant="outline" size="sm" onClick={reset}>
              {t('common.retry')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
