import type { PTKPStatus } from '@/lib/tax/shared/types';

export type MaritalState = 'single' | 'married';
export type FilingMode = 'separate' | 'joint';

export interface SpouseDerivedState {
  marital: MaritalState;
  filing: FilingMode;
  dependents: number;
}

/**
 * Derive UI-level marital / filing / dependents from a stored `ptkp_status`
 * code (UU PPh Pasal 7 classification).
 *
 * The inverse (UI → code) is `buildPTKPStatus` in `src/lib/tax/shared/tax-utils.ts`.
 * `src/components/dashboard/SpouseAndDependentsCard.tsx` uses both to keep the
 * UI and the tax calculator in sync.
 *
 * `null` input (a brand-new INDIVIDUAL customer without a status yet) maps to
 * the TK/0 default.
 */
export function deriveFromPtkp(status: PTKPStatus | null | undefined): SpouseDerivedState {
  if (!status) return { marital: 'single', filing: 'separate', dependents: 0 };
  if (status.startsWith('K/I/')) {
    return { marital: 'married', filing: 'joint', dependents: Number(status.slice(4)) };
  }
  if (status.startsWith('K/')) {
    return { marital: 'married', filing: 'separate', dependents: Number(status.slice(2)) };
  }
  return { marital: 'single', filing: 'separate', dependents: Number(status.slice(3)) };
}
