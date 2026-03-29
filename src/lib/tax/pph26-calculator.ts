import { PPH26_STANDARD_RATE, TAX_TREATY_RATES } from '@/config/constants';
import type { PPh26Data, PPh26Calculation } from '@/types';

/**
 * PPh 26 Calculator - Indonesian Non-Resident Withholding Tax (Pasal 26 UU PPh)
 *
 * Standard rate: 20% on gross income paid to non-residents.
 * Treaty rate: Reduced rate per P3B (Perjanjian Penghindaran Pajak Berganda)
 * if the recipient's country has a tax treaty with Indonesia.
 *
 * Applies to: dividends, interest, royalties, services, salaries,
 * pensions, insurance premiums, and other income paid to non-residents.
 */
export class PPh26Calculator {
  /**
   * Calculate PPh 26 for a non-resident payment
   */
  static calculate(data: PPh26Data): PPh26Calculation {
    const standardRate = PPH26_STANDARD_RATE;
    const treaty = data.apply_treaty !== false
      ? this.getTreatyRate(data.recipient_country, data.income_type)
      : null;

    const appliedRate = treaty ? treaty.rate : standardRate;
    const taxAmount = Math.round(data.gross_amount * appliedRate);
    const netAmount = data.gross_amount - taxAmount;

    return {
      gross_amount: data.gross_amount,
      standard_rate: standardRate,
      treaty_rate: treaty?.rate,
      applied_rate: appliedRate,
      tax_amount: taxAmount,
      net_amount: netAmount,
      treaty_country: treaty?.country,
      treaty_reference: treaty?.reference,
      is_treaty_applied: !!treaty,
    };
  }

  /**
   * Get treaty rate for a specific country and income type
   */
  static getTreatyRate(
    countryCode: string,
    incomeType: PPh26Data['income_type']
  ): { rate: number; country: string; reference: string } | null {
    const treaty = TAX_TREATY_RATES[countryCode.toUpperCase()];
    if (!treaty) return null;

    // Map income type to treaty rate field
    const rateMap: Record<PPh26Data['income_type'], number> = {
      dividend: treaty.dividend,
      interest: treaty.interest,
      royalty: treaty.royalty,
      service: treaty.service,
      salary: treaty.service, // Generally follows service rate or exempt per treaty
      pension: treaty.service,
      insurance: treaty.interest, // Often follows interest rate in treaties
      other: PPH26_STANDARD_RATE, // No treaty benefit for unspecified income
    };

    const rate = rateMap[incomeType];

    // Only apply treaty if it's actually lower than standard rate
    if (rate >= PPH26_STANDARD_RATE) return null;

    return {
      rate,
      country: treaty.country,
      reference: treaty.reference,
    };
  }

  /**
   * Get all available treaty countries
   */
  static getTreatyCountries(): Array<{
    code: string;
    country: string;
    dividendRate: number;
    interestRate: number;
    royaltyRate: number;
    serviceRate: number;
    reference: string;
  }> {
    return Object.entries(TAX_TREATY_RATES).map(([code, treaty]) => ({
      code,
      country: treaty.country,
      dividendRate: treaty.dividend,
      interestRate: treaty.interest,
      royaltyRate: treaty.royalty,
      serviceRate: treaty.service,
      reference: treaty.reference,
    }));
  }

  /**
   * Check if a country has a tax treaty with Indonesia
   */
  static hasTreaty(countryCode: string): boolean {
    return countryCode.toUpperCase() in TAX_TREATY_RATES;
  }

  /**
   * Calculate bulk PPh 26 for multiple transactions
   */
  static calculateBulk(transactions: PPh26Data[]): {
    calculations: PPh26Calculation[];
    totalGross: number;
    totalTax: number;
    totalNet: number;
    treatyAppliedCount: number;
  } {
    const calculations = transactions.map((t) => this.calculate(t));
    const totalGross = calculations.reduce((sum, c) => sum + c.gross_amount, 0);
    const totalTax = calculations.reduce((sum, c) => sum + c.tax_amount, 0);
    const totalNet = calculations.reduce((sum, c) => sum + c.net_amount, 0);
    const treatyAppliedCount = calculations.filter((c) => c.is_treaty_applied).length;

    return { calculations, totalGross, totalTax, totalNet, treatyAppliedCount };
  }
}
