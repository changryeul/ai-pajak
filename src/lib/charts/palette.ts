/**
 * Chart color palette — colorblind-friendly (Okabe-Ito).
 *
 * Source: Okabe & Ito (2008) "Color Universal Design". The 8-color palette
 * is distinguishable across all three common color-vision deficiencies
 * (deuteranopia, protanopia, tritanopia) while retaining sufficient
 * luminance contrast for normal vision.
 *
 * Reference: https://jfly.uni-koeln.de/color/
 *
 * Why this matters for AI Pajak:
 *   - Indonesian SMB / consultant base includes a non-trivial slice with
 *     red-green color vision deficiency. Our charts (closing trend,
 *     quarterly tax, operator queue status) were originally built with
 *     Tailwind's default emerald/rose pairing which deuteranopes cannot
 *     distinguish reliably.
 *   - Centralizing the palette also makes future charts consistent and
 *     lets us swap palettes once (e.g., dark mode) without hunting through
 *     individual chart files.
 *
 * Usage:
 *   import { TAX_TYPE_COLORS, YEAR_PALETTE, QUEUE_STATUS_COLORS } from '@/lib/charts/palette';
 *   ...
 *   <Bar fill={TAX_TYPE_COLORS.PPh21} />
 */

/** Okabe-Ito 8-color palette in canonical order. */
export const OKABE_ITO_8 = [
  '#0072B2', // blue
  '#E69F00', // orange
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#D55E00', // vermillion
  '#56B4E9', // sky blue
  '#F0E442', // yellow
  '#000000', // black
] as const;

/**
 * Semantic accents for "positive / negative" deltas. We avoid the default
 * Tailwind emerald + rose because they collide for red-green deficiency.
 * Bluish-green vs. vermillion is the recommended Okabe-Ito pairing.
 */
export const CHART_ACCENT_POSITIVE = '#009E73'; // bluish green — "up is good"
export const CHART_ACCENT_NEGATIVE = '#D55E00'; // vermillion — "up is bad" (tax/fail)
export const CHART_ACCENT_NEUTRAL = '#737373'; // medium gray

/**
 * Per-tax-type colors. Fixed mapping so the legend stays stable across
 * mode switches and year selections in ClosingQuarterlyView.
 */
export const TAX_TYPE_COLORS: Record<string, string> = {
  PPh21: '#0072B2', // blue
  PPh23: '#CC79A7', // reddish purple
  PPh25: '#E69F00', // orange
  PPN: '#009E73', // bluish green
  PPh_FINAL: '#D55E00', // vermillion
};
export const TAX_TYPE_FALLBACK = '#737373';

/**
 * Year palette for grouped/sequential year charts. Pulled from Okabe-Ito so
 * stacking two years side-by-side stays distinguishable.
 */
export const YEAR_PALETTE: readonly string[] = [
  '#0072B2', // blue (most recent)
  '#E69F00', // orange (prior)
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#D55E00', // vermillion
];

/**
 * Closing trend (annual) — bars for revenue + net income, line for ETR.
 * Three distinct hues, all from Okabe-Ito.
 */
export const CLOSING_BAR_REVENUE = '#0072B2';
export const CLOSING_BAR_NET_INCOME = '#CC79A7';
export const CLOSING_LINE_ETR = '#009E73';

/**
 * Operator queue 12-status palette. The full state machine has more states
 * than Okabe-Ito has slots, so we prioritize the high-signal terminal
 * states (COMPLETED / FAILED) and intermediate states get supporting hues.
 * Each pair of adjacent stacked statuses uses sufficiently different
 * luminance + hue.
 */
export const QUEUE_STATUS_COLORS: Record<string, string> = {
  PENDING: '#9CA3AF',             // gray-400
  DATA_REVIEW: '#0072B2',         // blue
  PENDING_APPROVAL: '#E69F00',    // orange
  APPROVED: '#56B4E9',            // sky blue
  EBILLING_GENERATED: '#CC79A7',  // reddish purple
  PAYMENT_PENDING: '#F0E442',     // yellow
  COMPLETED: '#009E73',           // bluish green — terminal positive
  FAILED: '#D55E00',              // vermillion — terminal negative
};
export const QUEUE_STATUS_FALLBACK = '#737373';
