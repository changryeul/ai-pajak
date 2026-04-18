'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { AutoSaveStatus } from '@/lib/profile/use-auto-save';

interface Props {
  status: AutoSaveStatus;
  onRetry?: () => void;
  labels?: {
    saving?: string;
    saved?: string;
    error?: string;
    retry?: string;
  };
}

export function AutoSaveIndicator({ status, onRetry, labels }: Props) {
  const t = useTranslations();
  const L = {
    saving: labels?.saving ?? t('autoSave.saving'),
    saved: labels?.saved ?? t('autoSave.saved'),
    error: labels?.error ?? t('autoSave.error'),
    retry: labels?.retry ?? t('autoSave.retry'),
  };

  if (status === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        status === 'saving' && 'text-gray-500',
        status === 'saved' && 'text-green-600',
        status === 'error' && 'text-red-600',
      )}
    >
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'saved' && <Check className="h-3 w-3" />}
      {status === 'error' && <AlertCircle className="h-3 w-3" />}

      <span>
        {status === 'saving' && L.saving}
        {status === 'saved' && L.saved}
        {status === 'error' && L.error}
      </span>

      {status === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 underline hover:no-underline"
        >
          {L.retry}
        </button>
      )}
    </div>
  );
}
