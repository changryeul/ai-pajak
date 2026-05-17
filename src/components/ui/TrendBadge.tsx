'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CHART_ACCENT_POSITIVE, CHART_ACCENT_NEGATIVE } from '@/lib/charts/palette';

/**
 * Colorblind-safe directional trend badge.
 *
 * Replaces ad-hoc `text-green-500 / text-red-500 + ArrowUp / ArrowDown`
 * pairs scattered across the app. Uses the Okabe-Ito accents so
 * deuteranopic users can still distinguish positive vs negative. The
 * arrow icon stays the primary visual cue, so the badge stays readable
 * even in greyscale.
 *
 * Semantics:
 *   - direction='up-good' (default) — '+' = positive (revenue, income).
 *   - direction='up-bad'             — '+' = negative (tax, errors,
 *     latency, expenses).
 *
 * Value formatting:
 *   - Pass `value` for raw numbers (any unit) + optional `suffix`.
 *   - Pass `valueString` for a pre-formatted string (e.g. with
 *     thousand separators) — overrides `value`/`suffix`.
 *
 * Near-zero (|value| < `zeroThreshold`) renders the neutral '—' chip.
 */
interface Props {
  /** Numeric value used for direction + magnitude. Ignored if valueString is set. */
  value?: number;
  /** Pre-formatted label. Direction is inferred from `value` (or 0 if absent). */
  valueString?: string;
  /** Magnitude unit (e.g., '%', 'pp', 'ms'). Ignored if valueString is set. */
  suffix?: string;
  /** Decimal places for value formatting. Default 1. */
  precision?: number;
  /** Below this magnitude the badge renders neutral. Default 0.005. */
  zeroThreshold?: number;
  /** 'up-good' = TrendingUp + positive accent. 'up-bad' = TrendingUp + negative. */
  direction?: 'up-good' | 'up-bad';
  /** Tailwind text-size class. Default text-xs. */
  size?: 'text-[10px]' | 'text-xs' | 'text-sm';
  /** Hide '+' on positive deltas (default true so '+15%' style). */
  showSign?: boolean;
}

export function TrendBadge({
  value,
  valueString,
  suffix = '',
  precision = 1,
  zeroThreshold = 0.005,
  direction = 'up-good',
  size = 'text-xs',
  showSign = true,
}: Props) {
  const numeric = value ?? 0;
  const magnitude = Math.abs(numeric);

  if (Math.abs(numeric) < zeroThreshold) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${size} text-slate-500 font-semibold`}>
        <Minus className="h-3 w-3" />
        {valueString ?? `${numeric.toFixed(precision)}${suffix}`}
      </span>
    );
  }

  const isPositive = numeric > 0;
  // Visual valence: with up-good, positive=good; with up-bad, positive=bad.
  const goodSignal =
    direction === 'up-good' ? isPositive : !isPositive;
  const color = goodSignal ? CHART_ACCENT_POSITIVE : CHART_ACCENT_NEGATIVE;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive && showSign ? '+' : isPositive ? '' : '-';

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${size} font-semibold`}
      style={{ color }}
    >
      <Icon className="h-3 w-3" />
      {valueString ?? `${sign}${magnitude.toFixed(precision)}${suffix}`}
    </span>
  );
}
