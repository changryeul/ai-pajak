import { PPH21_BRACKETS, PTKP, PPH23_RATES, PPH26_STANDARD_RATE, TAX_TREATY_RATES } from '@/config/constants';
import type { PTKPCategory } from '@/config/constants';

/**
 * Gross-Up Calculator
 *
 * Calculates the gross amount from a desired net amount when the payer
 * bears the tax burden. Common in Indonesia where employers promise
 * net salary (Gaji Bersih / Take Home Pay) and need to calculate
 * the gross amount including PPh.
 *
 * Formula: Gross = Net + Tax, where Tax = f(Gross)
 * For progressive rates, this requires bracket-by-bracket algebraic solution.
 */

export interface GrossUpPPh21Input {
  /** Desired net annual income (take home pay) */
  netAnnualIncome: number;
  ptkpCategory: PTKPCategory;
  /** Annual deductions: JHT + JP + other */
  annualDeductions?: number;
  hasNpwp?: boolean;
}

export interface GrossUpPPh21Result {
  net_income: number;
  gross_income: number;
  tax_amount: number;
  ptkp: number;
  taxable_income: number;
  effective_rate: number;
  npwp_surcharge_applied: boolean;
  /** Monthly gross salary */
  monthly_gross: number;
  /** Monthly net salary */
  monthly_net: number;
  /** Monthly tax */
  monthly_tax: number;
}

export interface GrossUpFlatInput {
  /** Desired net amount */
  netAmount: number;
  /** Tax rate (e.g., 0.02 for PPh 23 service 2%) */
  taxRate: number;
}

export interface GrossUpFlatResult {
  net_amount: number;
  gross_amount: number;
  tax_amount: number;
  tax_rate: number;
}

export class GrossUpCalculator {
  /**
   * PPh 21 Gross-Up: Calculate gross salary from desired net salary
   *
   * Works by solving the progressive tax brackets algebraically:
   * For each bracket: Net = Gross - Tax(Gross) - PTKP - Deductions
   */
  static grossUpPPh21(input: GrossUpPPh21Input): GrossUpPPh21Result {
    const ptkpAmount = PTKP[input.ptkpCategory];
    const deductions = input.annualDeductions || 0;
    const npwpMultiplier = input.hasNpwp === false ? 1.20 : 1.0;

    // Target: find gross where net = gross - positionCost - deductions - tax
    // positionCost = min(gross * 0.05, 6_000_000)
    // taxableIncome = gross - positionCost - deductions - ptkp
    // tax = progressiveTax(taxableIncome) * npwpMultiplier

    // We solve iteratively since position cost cap creates a piecewise function
    // Start with an estimate and converge
    let gross = input.netAnnualIncome * 1.15; // Initial estimate (15% tax)

    for (let i = 0; i < 50; i++) {
      const positionCost = Math.min(gross * 0.05, 6_000_000);
      const taxableIncome = Math.max(0, gross - positionCost - deductions - ptkpAmount);
      const baseTax = this.progressiveTax(taxableIncome);
      const tax = Math.round(baseTax * npwpMultiplier);
      const calculatedNet = gross - positionCost - deductions - tax;

      const diff = calculatedNet - input.netAnnualIncome;
      if (Math.abs(diff) < 1) break; // Converged

      // Adjust gross: if calculated net is too high, reduce gross
      gross = gross - diff * 0.8; // Damped Newton-like step
    }

    gross = Math.round(gross);
    const positionCost = Math.min(gross * 0.05, 6_000_000);
    const taxableIncome = Math.max(0, gross - positionCost - deductions - ptkpAmount);
    const baseTax = this.progressiveTax(taxableIncome);
    const tax = Math.round(baseTax * npwpMultiplier);
    const effectiveRate = gross > 0 ? (tax / gross) * 100 : 0;

    return {
      net_income: input.netAnnualIncome,
      gross_income: gross,
      tax_amount: tax,
      ptkp: ptkpAmount,
      taxable_income: taxableIncome,
      effective_rate: Math.round(effectiveRate * 100) / 100,
      npwp_surcharge_applied: input.hasNpwp === false,
      monthly_gross: Math.round(gross / 12),
      monthly_net: Math.round(input.netAnnualIncome / 12),
      monthly_tax: Math.round(tax / 12),
    };
  }

  /**
   * Flat-rate Gross-Up: For PPh 23, PPh 26, PPh 4(2), etc.
   *
   * Formula: Gross = Net / (1 - rate)
   * Tax = Gross * rate = Net * rate / (1 - rate)
   */
  static grossUpFlat(input: GrossUpFlatInput): GrossUpFlatResult {
    if (input.taxRate >= 1) {
      throw new Error('Tax rate must be less than 100%');
    }

    const grossAmount = Math.round(input.netAmount / (1 - input.taxRate));
    const taxAmount = grossAmount - input.netAmount;

    return {
      net_amount: input.netAmount,
      gross_amount: grossAmount,
      tax_amount: taxAmount,
      tax_rate: input.taxRate,
    };
  }

  /**
   * PPh 23 Gross-Up helper
   */
  static grossUpPPh23(
    netAmount: number,
    transactionType: 'dividend' | 'interest' | 'royalty' | 'prize' | 'rent' | 'service',
    hasNpwp = true
  ): GrossUpFlatResult & { transaction_type: string; npwp_surcharge_applied: boolean } {
    const rateMap: Record<string, number> = {
      dividend: PPH23_RATES.DIVIDEND,
      interest: PPH23_RATES.INTEREST,
      royalty: PPH23_RATES.ROYALTY,
      prize: PPH23_RATES.PRIZE,
      rent: PPH23_RATES.RENT,
      service: PPH23_RATES.SERVICE,
    };
    const baseRate = rateMap[transactionType];
    const effectiveRate = hasNpwp ? baseRate : baseRate * 2;

    const result = this.grossUpFlat({ netAmount, taxRate: effectiveRate });
    return {
      ...result,
      transaction_type: transactionType,
      npwp_surcharge_applied: !hasNpwp,
    };
  }

  /**
   * PPh 26 Gross-Up helper
   */
  static grossUpPPh26(
    netAmount: number,
    recipientCountry: string,
    incomeType: 'dividend' | 'interest' | 'royalty' | 'service' | 'other' = 'service',
    applyTreaty = true
  ): GrossUpFlatResult & { country: string; treaty_applied: boolean } {
    let rate = PPH26_STANDARD_RATE;
    let treatyApplied = false;

    if (applyTreaty) {
      const treaty = TAX_TREATY_RATES[recipientCountry.toUpperCase()];
      if (treaty) {
        const treatyRateMap: Record<string, number> = {
          dividend: treaty.dividend,
          interest: treaty.interest,
          royalty: treaty.royalty,
          service: treaty.service,
          other: PPH26_STANDARD_RATE,
        };
        const treatyRate = treatyRateMap[incomeType];
        if (treatyRate < PPH26_STANDARD_RATE) {
          rate = treatyRate;
          treatyApplied = true;
        }
      }
    }

    const result = this.grossUpFlat({ netAmount, taxRate: rate });
    return {
      ...result,
      country: recipientCountry.toUpperCase(),
      treaty_applied: treatyApplied,
    };
  }

  /**
   * Calculate progressive tax amount
   */
  private static progressiveTax(taxableIncome: number): number {
    let remaining = taxableIncome;
    let totalTax = 0;

    for (const bracket of PPH21_BRACKETS) {
      if (remaining <= 0) break;
      const bracketRange = bracket.max - bracket.min;
      const taxableInBracket = Math.min(remaining, bracketRange);
      totalTax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
    }

    return totalTax;
  }
}
