/**
 * Shared Tax Constants
 *
 * Common constants used across SPT forms (1770 SS, 1770 S, 1770, 1771)
 */

import type { PTKPStatus } from './types';

/**
 * PTKP rates for 2024 (in Rupiah)
 * Penghasilan Tidak Kena Pajak - Non-taxable income thresholds
 * Based on PMK 101/2016
 */
export const PTKP_RATES: Record<PTKPStatus, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
  'K/I/0': 112_500_000,
  'K/I/1': 117_000_000,
  'K/I/2': 121_500_000,
  'K/I/3': 126_000_000,
};

/**
 * Progressive tax brackets for individual income tax (PPh 21) - 2024
 * Based on UU HPP 2021
 */
export const TAX_BRACKETS = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: 5_000_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
] as const;

/**
 * Corporate tax rates (for SPT 1771)
 */
export const CORPORATE_TAX = {
  /** Standard corporate tax rate (22%) */
  STANDARD_RATE: 0.22,
  /** SME rate for revenue < 50B (11%) */
  SME_RATE: 0.11,
  /** SME revenue threshold (Rp 50 billion) */
  SME_THRESHOLD: 50_000_000_000,
  /** Final tax rate for UMKM (0.5%) */
  UMKM_FINAL_RATE: 0.005,
  /** UMKM revenue threshold (Rp 4.8 billion) */
  UMKM_THRESHOLD: 4_800_000_000,
} as const;

/**
 * Position cost (Biaya Jabatan) limits
 */
export const POSITION_COST = {
  /** Maximum percentage of gross income (5%) */
  MAX_PERCENTAGE: 0.05,
  /** Maximum annual amount (Rp 6 million) */
  MAX_ANNUAL: 6_000_000,
  /** Maximum monthly amount (Rp 500,000) */
  MAX_MONTHLY: 500_000,
} as const;

/**
 * Pension contribution (Iuran Pensiun) limits
 */
export const PENSION_CONTRIBUTION = {
  /** Maximum percentage of gross income (5%) */
  MAX_PERCENTAGE: 0.05,
  /** Maximum annual amount (Rp 2.4 million) */
  MAX_ANNUAL: 2_400_000,
  /** Maximum monthly amount (Rp 200,000) */
  MAX_MONTHLY: 200_000,
} as const;

/**
 * Loss carryforward periods
 */
export const LOSS_CARRYFORWARD = {
  /** Individual loss carryforward period (5 years) */
  INDIVIDUAL_YEARS: 5,
  /** Corporate loss carryforward period (5 years, can extend to 10 with incentives) */
  CORPORATE_YEARS: 5,
  /** Extended corporate loss carryforward (10 years) */
  CORPORATE_EXTENDED_YEARS: 10,
} as const;

/**
 * Depreciation rates by asset category
 * Based on Pasal 11 UU PPh
 */
export const DEPRECIATION_RATES = {
  /** Group 1: 4 years (computers, office equipment) */
  GROUP_1: {
    usefulLife: 4,
    straightLine: 0.25,
    decliningBalance: 0.50,
  },
  /** Group 2: 8 years (vehicles, furniture) */
  GROUP_2: {
    usefulLife: 8,
    straightLine: 0.125,
    decliningBalance: 0.25,
  },
  /** Group 3: 16 years (machinery) */
  GROUP_3: {
    usefulLife: 16,
    straightLine: 0.0625,
    decliningBalance: 0.125,
  },
  /** Group 4: 20 years (heavy equipment) */
  GROUP_4: {
    usefulLife: 20,
    straightLine: 0.05,
    decliningBalance: 0.10,
  },
  /** Permanent building: 20 years */
  BUILDING_PERMANENT: {
    usefulLife: 20,
    straightLine: 0.05,
    decliningBalance: null, // Only straight-line for buildings
  },
  /** Non-permanent building: 10 years */
  BUILDING_NON_PERMANENT: {
    usefulLife: 10,
    straightLine: 0.10,
    decliningBalance: null,
  },
} as const;

/**
 * SPT filing deadlines (annual)
 */
export const SPT_DEADLINES = {
  /** Individual SPT deadline - March 31st of following year */
  INDIVIDUAL: { month: 3, day: 31 },
  /** Corporate SPT deadline - April 30th of following year */
  CORPORATE: { month: 4, day: 30 },
} as const;

/**
 * Monthly tax deadlines (Coretax — PMK 81/2024, effective 2025-01-01)
 *
 * Historical (pre-Coretax): deadlines varied by tax type (PPh 21/23 = 10th, etc.)
 * Current (Coretax): unified to 15th for payment, 20th for SPT Masa filing.
 *
 * Exception: PPN SPT Masa filing deadline remains end of the following month
 * (PPN payment is still 15th along with other PPh).
 *
 * References:
 * - PMK 81/PMK.03/2024 — Unification of tax deadlines
 * - Coretax DJP roll-out (2025)
 */
export const MONTHLY_TAX_DEADLINES = {
  /** PPh 21 payment — 15th of following month */
  PPH21_PAYMENT: 15,
  /** PPh 21 SPT Masa filing — 20th of following month */
  PPH21_FILING: 20,

  /** PPh 23 payment — 15th of following month */
  PPH23_PAYMENT: 15,
  /** PPh 23 SPT Masa filing — 20th of following month */
  PPH23_FILING: 20,

  /** PPh 4(2) Final payment — 15th of following month */
  PPH4_2_PAYMENT: 15,
  /** PPh 4(2) SPT Masa filing — 20th of following month */
  PPH4_2_FILING: 20,

  /** PPh 25 installment payment — 15th of following month (no separate filing) */
  PPH25_PAYMENT: 15,

  /** PPh 26 payment — 15th of following month */
  PPH26_PAYMENT: 15,
  /** PPh 26 SPT Masa filing — 20th of following month */
  PPH26_FILING: 20,

  /** PPh Final UMKM 0.5% payment — 15th of following month */
  PPH_FINAL_UMKM_PAYMENT: 15,

  /** PPN payment — 15th of following month (unified under Coretax) */
  PPN_PAYMENT: 15,
  /** PPN SPT Masa filing — end of following month (unchanged by PMK 81/2024) */
  PPN_FILING_END_OF_MONTH: true,
} as const;

/**
 * Last day of month helper (for PPN filing deadline)
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * PTKP status descriptions in Indonesian
 */
export const PTKP_DESCRIPTIONS: Record<PTKPStatus, string> = {
  'TK/0': 'Tidak Kawin / Tanpa Tanggungan',
  'TK/1': 'Tidak Kawin / 1 Tanggungan',
  'TK/2': 'Tidak Kawin / 2 Tanggungan',
  'TK/3': 'Tidak Kawin / 3 Tanggungan',
  'K/0': 'Kawin / Tanpa Tanggungan',
  'K/1': 'Kawin / 1 Tanggungan',
  'K/2': 'Kawin / 2 Tanggungan',
  'K/3': 'Kawin / 3 Tanggungan',
  'K/I/0': 'Kawin + Penghasilan Istri Digabung / Tanpa Tanggungan',
  'K/I/1': 'Kawin + Penghasilan Istri Digabung / 1 Tanggungan',
  'K/I/2': 'Kawin + Penghasilan Istri Digabung / 2 Tanggungan',
  'K/I/3': 'Kawin + Penghasilan Istri Digabung / 3 Tanggungan',
};
