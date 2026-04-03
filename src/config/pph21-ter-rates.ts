/**
 * PPh 21 TER (Tarif Efektif Rata-rata) Monthly Effective Rates
 *
 * Based on PP 58/2023 and PMK 168/2023, effective January 1, 2024.
 * Used for monthly PPh 21 calculation (January through November).
 * December uses annual reconciliation with Pasal 17 progressive rates.
 *
 * Three categories based on PTKP status:
 * - Category A: TK/0, TK/1, K/0 (44 brackets)
 * - Category B: TK/2, TK/3, K/1, K/2 (40 brackets)
 * - Category C: K/3 (41 brackets)
 */

import type { PTKPCategory } from '@/config/constants';

export type TERCategory = 'A' | 'B' | 'C';

export interface TERBracket {
  /** Minimum gross monthly income (inclusive) */
  min: number;
  /** Maximum gross monthly income (exclusive, Infinity for last bracket) */
  max: number;
  /** TER rate as decimal (e.g., 0.0025 = 0.25%) */
  rate: number;
}

/**
 * TER Category A — PTKP: TK/0, TK/1, K/0
 * 44 brackets per PMK 168/2023 Lampiran
 */
export const TER_CATEGORY_A: TERBracket[] = [
  { min: 0, max: 5_400_000, rate: 0 },
  { min: 5_400_000, max: 5_650_000, rate: 0.0025 },
  { min: 5_650_000, max: 5_950_000, rate: 0.005 },
  { min: 5_950_000, max: 6_300_000, rate: 0.0075 },
  { min: 6_300_000, max: 6_750_000, rate: 0.01 },
  { min: 6_750_000, max: 7_500_000, rate: 0.0125 },
  { min: 7_500_000, max: 8_550_000, rate: 0.015 },
  { min: 8_550_000, max: 9_650_000, rate: 0.0175 },
  { min: 9_650_000, max: 10_050_000, rate: 0.02 },
  { min: 10_050_000, max: 10_350_000, rate: 0.0225 },
  { min: 10_350_000, max: 10_700_000, rate: 0.025 },
  { min: 10_700_000, max: 11_050_000, rate: 0.03 },
  { min: 11_050_000, max: 11_600_000, rate: 0.035 },
  { min: 11_600_000, max: 12_500_000, rate: 0.04 },
  { min: 12_500_000, max: 13_750_000, rate: 0.05 },
  { min: 13_750_000, max: 15_100_000, rate: 0.055 },
  { min: 15_100_000, max: 16_950_000, rate: 0.06 },
  { min: 16_950_000, max: 19_750_000, rate: 0.07 },
  { min: 19_750_000, max: 24_150_000, rate: 0.08 },
  { min: 24_150_000, max: 26_450_000, rate: 0.09 },
  { min: 26_450_000, max: 28_000_000, rate: 0.10 },
  { min: 28_000_000, max: 30_050_000, rate: 0.11 },
  { min: 30_050_000, max: 32_400_000, rate: 0.12 },
  { min: 32_400_000, max: 35_400_000, rate: 0.13 },
  { min: 35_400_000, max: 39_100_000, rate: 0.14 },
  { min: 39_100_000, max: 43_850_000, rate: 0.15 },
  { min: 43_850_000, max: 47_800_000, rate: 0.16 },
  { min: 47_800_000, max: 51_400_000, rate: 0.17 },
  { min: 51_400_000, max: 56_300_000, rate: 0.18 },
  { min: 56_300_000, max: 62_200_000, rate: 0.19 },
  { min: 62_200_000, max: 68_600_000, rate: 0.20 },
  { min: 68_600_000, max: 77_500_000, rate: 0.21 },
  { min: 77_500_000, max: 89_000_000, rate: 0.22 },
  { min: 89_000_000, max: 103_000_000, rate: 0.23 },
  { min: 103_000_000, max: 125_000_000, rate: 0.24 },
  { min: 125_000_000, max: 157_000_000, rate: 0.25 },
  { min: 157_000_000, max: 206_000_000, rate: 0.26 },
  { min: 206_000_000, max: 337_000_000, rate: 0.28 },
  { min: 337_000_000, max: 454_000_000, rate: 0.30 },
  { min: 454_000_000, max: 550_000_000, rate: 0.31 },
  { min: 550_000_000, max: 695_000_000, rate: 0.32 },
  { min: 695_000_000, max: 910_000_000, rate: 0.33 },
  { min: 910_000_000, max: 1_400_000_000, rate: 0.34 },
  { min: 1_400_000_000, max: Infinity, rate: 0.34 },
];

/**
 * TER Category B — PTKP: TK/2, TK/3, K/1, K/2
 * 40 brackets per PMK 168/2023 Lampiran
 */
export const TER_CATEGORY_B: TERBracket[] = [
  { min: 0, max: 6_200_000, rate: 0 },
  { min: 6_200_000, max: 6_500_000, rate: 0.0025 },
  { min: 6_500_000, max: 6_850_000, rate: 0.005 },
  { min: 6_850_000, max: 7_300_000, rate: 0.0075 },
  { min: 7_300_000, max: 9_200_000, rate: 0.01 },
  { min: 9_200_000, max: 10_750_000, rate: 0.015 },
  { min: 10_750_000, max: 11_250_000, rate: 0.02 },
  { min: 11_250_000, max: 11_600_000, rate: 0.025 },
  { min: 11_600_000, max: 12_600_000, rate: 0.03 },
  { min: 12_600_000, max: 13_600_000, rate: 0.035 },
  { min: 13_600_000, max: 14_950_000, rate: 0.04 },
  { min: 14_950_000, max: 16_400_000, rate: 0.05 },
  { min: 16_400_000, max: 18_450_000, rate: 0.06 },
  { min: 18_450_000, max: 21_850_000, rate: 0.07 },
  { min: 21_850_000, max: 26_000_000, rate: 0.08 },
  { min: 26_000_000, max: 27_700_000, rate: 0.09 },
  { min: 27_700_000, max: 29_350_000, rate: 0.10 },
  { min: 29_350_000, max: 31_450_000, rate: 0.11 },
  { min: 31_450_000, max: 33_950_000, rate: 0.12 },
  { min: 33_950_000, max: 37_100_000, rate: 0.13 },
  { min: 37_100_000, max: 41_100_000, rate: 0.14 },
  { min: 41_100_000, max: 45_800_000, rate: 0.15 },
  { min: 45_800_000, max: 49_500_000, rate: 0.16 },
  { min: 49_500_000, max: 53_800_000, rate: 0.17 },
  { min: 53_800_000, max: 58_500_000, rate: 0.18 },
  { min: 58_500_000, max: 64_000_000, rate: 0.19 },
  { min: 64_000_000, max: 71_000_000, rate: 0.20 },
  { min: 71_000_000, max: 80_000_000, rate: 0.21 },
  { min: 80_000_000, max: 93_000_000, rate: 0.22 },
  { min: 93_000_000, max: 109_000_000, rate: 0.23 },
  { min: 109_000_000, max: 129_000_000, rate: 0.24 },
  { min: 129_000_000, max: 163_000_000, rate: 0.25 },
  { min: 163_000_000, max: 211_000_000, rate: 0.26 },
  { min: 211_000_000, max: 374_000_000, rate: 0.28 },
  { min: 374_000_000, max: 459_000_000, rate: 0.30 },
  { min: 459_000_000, max: 555_000_000, rate: 0.31 },
  { min: 555_000_000, max: 704_000_000, rate: 0.32 },
  { min: 704_000_000, max: 957_000_000, rate: 0.33 },
  { min: 957_000_000, max: 1_405_000_000, rate: 0.34 },
  { min: 1_405_000_000, max: Infinity, rate: 0.34 },
];

/**
 * TER Category C — PTKP: K/3
 * 41 brackets per PMK 168/2023 Lampiran
 */
export const TER_CATEGORY_C: TERBracket[] = [
  { min: 0, max: 6_600_000, rate: 0 },
  { min: 6_600_000, max: 6_950_000, rate: 0.0025 },
  { min: 6_950_000, max: 7_350_000, rate: 0.005 },
  { min: 7_350_000, max: 7_800_000, rate: 0.0075 },
  { min: 7_800_000, max: 8_850_000, rate: 0.01 },
  { min: 8_850_000, max: 9_800_000, rate: 0.0125 },
  { min: 9_800_000, max: 10_950_000, rate: 0.015 },
  { min: 10_950_000, max: 11_200_000, rate: 0.02 },
  { min: 11_200_000, max: 12_050_000, rate: 0.025 },
  { min: 12_050_000, max: 12_950_000, rate: 0.03 },
  { min: 12_950_000, max: 14_150_000, rate: 0.035 },
  { min: 14_150_000, max: 15_550_000, rate: 0.04 },
  { min: 15_550_000, max: 17_050_000, rate: 0.05 },
  { min: 17_050_000, max: 19_500_000, rate: 0.06 },
  { min: 19_500_000, max: 22_700_000, rate: 0.07 },
  { min: 22_700_000, max: 26_600_000, rate: 0.08 },
  { min: 26_600_000, max: 28_100_000, rate: 0.09 },
  { min: 28_100_000, max: 30_100_000, rate: 0.10 },
  { min: 30_100_000, max: 32_600_000, rate: 0.11 },
  { min: 32_600_000, max: 35_400_000, rate: 0.12 },
  { min: 35_400_000, max: 38_900_000, rate: 0.13 },
  { min: 38_900_000, max: 43_000_000, rate: 0.14 },
  { min: 43_000_000, max: 47_400_000, rate: 0.15 },
  { min: 47_400_000, max: 51_200_000, rate: 0.16 },
  { min: 51_200_000, max: 55_800_000, rate: 0.17 },
  { min: 55_800_000, max: 60_400_000, rate: 0.18 },
  { min: 60_400_000, max: 66_700_000, rate: 0.19 },
  { min: 66_700_000, max: 74_500_000, rate: 0.20 },
  { min: 74_500_000, max: 83_200_000, rate: 0.21 },
  { min: 83_200_000, max: 95_600_000, rate: 0.22 },
  { min: 95_600_000, max: 110_000_000, rate: 0.23 },
  { min: 110_000_000, max: 134_000_000, rate: 0.24 },
  { min: 134_000_000, max: 169_000_000, rate: 0.25 },
  { min: 169_000_000, max: 221_000_000, rate: 0.26 },
  { min: 221_000_000, max: 390_000_000, rate: 0.28 },
  { min: 390_000_000, max: 463_000_000, rate: 0.30 },
  { min: 463_000_000, max: 561_000_000, rate: 0.31 },
  { min: 561_000_000, max: 709_000_000, rate: 0.32 },
  { min: 709_000_000, max: 965_000_000, rate: 0.33 },
  { min: 965_000_000, max: 1_419_000_000, rate: 0.34 },
  { min: 1_419_000_000, max: Infinity, rate: 0.34 },
];

const TER_TABLES: Record<TERCategory, TERBracket[]> = {
  A: TER_CATEGORY_A,
  B: TER_CATEGORY_B,
  C: TER_CATEGORY_C,
};

/**
 * Determine TER category based on PTKP status.
 *
 * Category A: TK/0, TK/1, K/0 (and KI/0 mapped to base)
 * Category B: TK/2, TK/3, K/1, K/2 (and KI/1, KI/2)
 * Category C: K/3 (and KI/3)
 */
export function getTERCategory(ptkpCategory: PTKPCategory): TERCategory {
  const categoryMap: Record<PTKPCategory, TERCategory> = {
    TK0: 'A',
    TK1: 'A',
    TK2: 'B',
    TK3: 'B',
    K0: 'A',
    K1: 'B',
    K2: 'B',
    K3: 'C',
    // KI (married, spouse working) → map to underlying marital status
    KI0: 'A',
    KI1: 'B',
    KI2: 'B',
    KI3: 'C',
  };

  return categoryMap[ptkpCategory];
}

/**
 * Look up TER rate for a given category and gross monthly income.
 */
export function lookupTERRate(category: TERCategory, grossMonthly: number): number {
  const brackets = TER_TABLES[category];

  for (const bracket of brackets) {
    if (grossMonthly >= bracket.min && grossMonthly < bracket.max) {
      return bracket.rate;
    }
  }

  // Should not reach here — last bracket has max=Infinity
  // Fallback to last bracket's rate
  return brackets[brackets.length - 1].rate;
}
