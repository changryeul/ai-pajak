import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as full Indonesian Rupiah (always full digits, no abbreviation).
 * Rounds to integer — no decimal places.
 *
 * Rationale: M (Million) and B (Billion) English suffixes conflict with
 * Indonesian usage (where "M" often means "miliar" = billion). To avoid
 * confusion, all currency amounts are displayed in full Indonesian format.
 *
 * @example fmtRp(1500000) => "Rp 1.500.000"
 * @example fmtRp(45500000) => "Rp 45.500.000"
 */
export function fmtRp(n: number): string {
  const rounded = Math.round(Number(n) || 0);
  return `Rp ${rounded.toLocaleString('id-ID')}`;
}

/**
 * Alias for fmtRp — kept for backward compatibility with existing imports.
 */
export function fmtRpFull(n: number): string {
  return fmtRp(n);
}
