import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as Indonesian Rupiah with abbreviation
 * @example fmtRp(1500000) => "Rp 1.5M"
 * @example fmtRp(500000) => "Rp 500K"
 */
export function fmtRp(n: number): string {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}K`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/**
 * Format number as full Indonesian Rupiah (no abbreviation)
 * @example fmtRpFull(1500000) => "Rp 1.500.000"
 */
export function fmtRpFull(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}
