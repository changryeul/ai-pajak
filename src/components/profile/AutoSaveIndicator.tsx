'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
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
  const L = {
    saving: labels?.saving ?? '저장 중…',
    saved: labels?.saved ?? '저장됨',
    error: labels?.error ?? '저장 실패',
    retry: labels?.retry ?? '다시 시도',
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
