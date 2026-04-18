'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** 0..100 */
  score: number;
  label?: string;
  hint?: string;
}

/**
 * Linear progress bar + percentage + optional hint text.
 *
 * Colour bands:
 *   <40  → red     (필수 정보 누락)
 *   40-79→ amber   (진행 중)
 *   80-99→ blue    (거의 완료)
 *   100  → emerald (완료)
 */
export function ProfileCompletionBar({ score, label, hint }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const colour =
    clamped === 100 ? 'bg-emerald-500'
    : clamped >= 80 ? 'bg-blue-500'
    : clamped >= 40 ? 'bg-amber-500'
    : 'bg-red-500';

  return (
    <div>
      {label && <div className="text-sm text-gray-500 mb-1">{label}</div>}
      <div
        className="w-full bg-gray-200 rounded h-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-3 rounded transition-[width]', colour)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="text-xs mt-1 text-gray-600">
        {clamped}% 완료{hint && ` — ${hint}`}
      </div>
    </div>
  );
}
