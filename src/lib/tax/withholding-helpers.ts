/**
 * Withholding tax helpers — pure mapping functions used by the
 * pph23-transactions API handler. Extracted for testability.
 */

import type { ServiceCategory } from '@/types';

/**
 * Map UI service_type (Indonesian label code) → ResolveEngine serviceCategory enum.
 * Used when the form sends Indonesian-named codes like DIVIDEN/SEWA but the engine
 * expects DIVIDEND/RENTAL.
 */
export const SERVICE_TYPE_TO_CATEGORY: Record<string, ServiceCategory> = {
  DIVIDEN: 'DIVIDEND',
  BUNGA: 'INTEREST',
  ROYALTI: 'ROYALTY',
  HADIAH: 'OTHER',
  SEWA: 'RENTAL',
  JASA_TEKNIK: 'SERVICE',
  JASA_MANAJEMEN: 'SERVICE',
  JASA_KONSULTAN: 'SERVICE',
  JASA_LAINNYA: 'SERVICE',
};

/**
 * Map ResolveEngine taxType + rate → DB pph23_transaction.tax_regime column value.
 *
 * Rules:
 * - rate === 0 → EXEMPT (e.g., UU HPP corporate dividend exemption)
 * - PPh23 → PPH23
 * - PPh4_2 → PPH4_2
 * - PPh26 → PPH26
 * - PPh21/22 → PPH23 (legacy fallback; should not normally route here)
 * - PPh15 → PPH_FINAL
 * - default → PPH23
 */
export function taxTypeToRegime(taxType: string, rate: number): string {
  if (rate === 0) return 'EXEMPT';
  if (taxType === 'PPh23') return 'PPH23';
  if (taxType === 'PPh4_2') return 'PPH4_2';
  if (taxType === 'PPh26') return 'PPH26';
  if (taxType === 'PPh21') return 'PPH23';
  if (taxType === 'PPh22') return 'PPH23';
  if (taxType === 'PPh15') return 'PPH_FINAL';
  return 'PPH23';
}

/**
 * Determine if a DGT Form is currently valid as of a given transaction date.
 * Returns true if the form was provided AND the validity window covers the date.
 */
export function isDgtFormValid(
  dgtFormValidUntil: string | null | undefined,
  transactionDate: string
): boolean {
  if (!dgtFormValidUntil) return false;
  return new Date(dgtFormValidUntil) >= new Date(transactionDate);
}
