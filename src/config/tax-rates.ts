/**
 * Tax Rates Configuration by Year
 *
 * Purpose: Centralized tax rate management for Indonesian tax calculations
 * Updates: Annually or when tax regulations change
 *
 * Legal Basis:
 * - UU No. 7/2021 (UU HPP) - Tax reform
 * - PMK 131/2024 - PPN 12% implementation
 */

export type PTKPCategory =
  | 'TK0' | 'TK1' | 'TK2' | 'TK3'  // Tidak Kawin (Single)
  | 'K0' | 'K1' | 'K2' | 'K3'      // Kawin (Married)
  | 'KI0' | 'KI1' | 'KI2' | 'KI3'; // Kawin, Istri bekerja (Married, spouse working)

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface PTKPValues {
  TK0: number;
  TK1: number;
  TK2: number;
  TK3: number;
  K0: number;
  K1: number;
  K2: number;
  K3: number;
  KI0: number;
  KI1: number;
  KI2: number;
  KI3: number;
}

export interface YearlyTaxRates {
  PPN: number;
  PPH21_BRACKETS: TaxBracket[];
  PTKP: PTKPValues;
}

/**
 * Tax rates by year
 *
 * 2024: Pre-reform rates
 * 2025: Post-reform rates (PMK 131/2024)
 */
export const TAX_RATES_BY_YEAR: Record<number, YearlyTaxRates> = {
  2024: {
    PPN: 0.11, // 11% VAT

    // PPh 21 Progressive Tax Brackets (UU HPP 2021)
    PPH21_BRACKETS: [
      { min: 0, max: 60_000_000, rate: 0.05 },           // 5%
      { min: 60_000_000, max: 250_000_000, rate: 0.15 }, // 15%
      { min: 250_000_000, max: 500_000_000, rate: 0.25 }, // 25%
      { min: 500_000_000, max: 5_000_000_000, rate: 0.30 }, // 30%
      { min: 5_000_000_000, max: Infinity, rate: 0.35 }  // 35%
    ],

    // PTKP 2024 (Penghasilan Tidak Kena Pajak - Non-Taxable Income)
    PTKP: {
      // Tidak Kawin (Single)
      TK0: 54_000_000,  // No dependents
      TK1: 58_500_000,  // 1 dependent
      TK2: 63_000_000,  // 2 dependents
      TK3: 67_500_000,  // 3 dependents

      // Kawin (Married)
      K0: 58_500_000,   // No dependents
      K1: 63_000_000,   // 1 dependent
      K2: 67_500_000,   // 2 dependents
      K3: 72_000_000,   // 3 dependents

      // Kawin, Istri bekerja (Married, spouse has income)
      KI0: 112_500_000, // No dependents
      KI1: 117_000_000, // 1 dependent
      KI2: 121_500_000, // 2 dependents
      KI3: 126_000_000  // 3 dependents
    }
  },

  2025: {
    PPN: 0.12, // 12% VAT (statutory rate, adjusted by PMK 131/2024)

    // PPh 21 brackets remain the same (no change in 2025)
    PPH21_BRACKETS: [
      { min: 0, max: 60_000_000, rate: 0.05 },
      { min: 60_000_000, max: 250_000_000, rate: 0.15 },
      { min: 250_000_000, max: 500_000_000, rate: 0.25 },
      { min: 500_000_000, max: 5_000_000_000, rate: 0.30 },
      { min: 5_000_000_000, max: Infinity, rate: 0.35 }
    ],

    // PTKP 2025 (awaiting DJP official announcement)
    // Using 2024 values as placeholder until confirmed
    PTKP: {
      TK0: 54_000_000,
      TK1: 58_500_000,
      TK2: 63_000_000,
      TK3: 67_500_000,
      K0: 58_500_000,
      K1: 63_000_000,
      K2: 67_500_000,
      K3: 72_000_000,
      KI0: 112_500_000,
      KI1: 117_000_000,
      KI2: 121_500_000,
      KI3: 126_000_000
    }
  },

  // 2026 — PPN·PPh21·PTKP 변동 없음 (PMK 131/2024 유효: 일반 effective 11%[12%×11/12],
  // 사치품 12%. PTKP 54M 유지. TER PMK 168/2023 유지). 명시적으로 2025와 동일 유지.
  2026: {
    PPN: 0.12, // statutory 12% (PMK 131/2024; non-luxury effective 11% via 11/12 DPP)
    PPH21_BRACKETS: [
      { min: 0, max: 60_000_000, rate: 0.05 },
      { min: 60_000_000, max: 250_000_000, rate: 0.15 },
      { min: 250_000_000, max: 500_000_000, rate: 0.25 },
      { min: 500_000_000, max: 5_000_000_000, rate: 0.30 },
      { min: 5_000_000_000, max: Infinity, rate: 0.35 }
    ],
    PTKP: {
      TK0: 54_000_000, TK1: 58_500_000, TK2: 63_000_000, TK3: 67_500_000,
      K0: 58_500_000, K1: 63_000_000, K2: 67_500_000, K3: 72_000_000,
      KI0: 112_500_000, KI1: 117_000_000, KI2: 121_500_000, KI3: 126_000_000
    }
  }
};

/**
 * Get tax rates for a specific year
 * Defaults to 2025 rates if year not found
 */
export function getTaxRates(year: number): YearlyTaxRates {
  return TAX_RATES_BY_YEAR[year] || TAX_RATES_BY_YEAR[2025];
}

/**
 * Get PTKP value for a specific year and category
 */
export function getPTKP(year: number, category: PTKPCategory): number {
  const rates = getTaxRates(year);
  return rates.PTKP[category];
}

/**
 * Get PPN rate for a specific date
 *
 * Note: This returns the STATUTORY rate.
 * For non-luxury items after 2025-01-01, DPP adjustment (11/12) applies
 * to achieve effective 11% rate (PMK 131/2024)
 */
export function getPPNRate(transactionDate: Date): number {
  const year = transactionDate.getFullYear();
  const rates = getTaxRates(year);
  return rates.PPN;
}

/**
 * Get PPh21 tax brackets for a specific year
 */
export function getPPh21Brackets(year: number): TaxBracket[] {
  const rates = getTaxRates(year);
  return rates.PPH21_BRACKETS;
}

/**
 * Calculate progressive PPh21 tax
 *
 * @param taxableIncome - Income after PTKP deduction
 * @param year - Tax year
 * @returns Total tax amount
 */
export function calculateProgressiveTax(taxableIncome: number, year: number): number {
  const brackets = getPPh21Brackets(year);
  let totalTax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;

    const taxableInBracket = Math.min(
      taxableIncome - bracket.min,
      bracket.max - bracket.min
    );

    totalTax += taxableInBracket * bracket.rate;
  }

  return Math.round(totalTax);
}

/**
 * Get effective tax rate
 */
export function getEffectiveTaxRate(taxAmount: number, grossIncome: number): number {
  if (grossIncome === 0) return 0;
  return (taxAmount / grossIncome) * 100;
}

/**
 * Validate PTKP category
 */
export function isValidPTKPCategory(category: string): category is PTKPCategory {
  const validCategories: PTKPCategory[] = [
    'TK0', 'TK1', 'TK2', 'TK3',
    'K0', 'K1', 'K2', 'K3',
    'KI0', 'KI1', 'KI2', 'KI3'
  ];
  return validCategories.includes(category as PTKPCategory);
}

/**
 * Get all PTKP categories with descriptions
 */
export function getPTKPCategories() {
  return [
    { code: 'TK0', label: 'Single, No dependents', amount: 54_000_000 },
    { code: 'TK1', label: 'Single, 1 dependent', amount: 58_500_000 },
    { code: 'TK2', label: 'Single, 2 dependents', amount: 63_000_000 },
    { code: 'TK3', label: 'Single, 3 dependents', amount: 67_500_000 },
    { code: 'K0', label: 'Married, No dependents', amount: 58_500_000 },
    { code: 'K1', label: 'Married, 1 dependent', amount: 63_000_000 },
    { code: 'K2', label: 'Married, 2 dependents', amount: 67_500_000 },
    { code: 'K3', label: 'Married, 3 dependents', amount: 72_000_000 },
    { code: 'KI0', label: 'Married (spouse working), No dependents', amount: 112_500_000 },
    { code: 'KI1', label: 'Married (spouse working), 1 dependent', amount: 117_000_000 },
    { code: 'KI2', label: 'Married (spouse working), 2 dependents', amount: 121_500_000 },
    { code: 'KI3', label: 'Married (spouse working), 3 dependents', amount: 126_000_000 }
  ];
}
