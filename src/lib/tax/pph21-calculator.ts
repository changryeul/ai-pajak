import { PPH21_BRACKETS, PTKP, type PTKPCategory } from '@/config/constants';
import type { PPh21Data, PPh21Calculation, TaxBracketResult } from '@/types';

/**
 * NPWP Surcharge rate per Pasal 21 ayat (5a) UU PPh:
 * Taxpayers without NPWP pay 20% higher than the standard rate.
 */
const NPWP_SURCHARGE_RATE = 0.20;

/**
 * PPh 21 Calculator - Indonesian Income Tax Article 21
 * Calculates withholding tax on employment income
 */
export class PPh21Calculator {
  /**
   * Determine if NPWP surcharge applies.
   * Surcharge applies when employee has no NPWP (has_npwp explicitly false,
   * or employee_npwp is empty/missing).
   */
  private static shouldApplyNpwpSurcharge(data: PPh21Data): boolean {
    if (data.has_npwp === true) return false;
    if (data.has_npwp === false) return true;
    // Infer from employee_npwp field
    return !data.employee_npwp || data.employee_npwp.trim() === '';
  }

  /**
   * Calculate annual PPh 21 for an employee
   */
  static calculateAnnual(data: PPh21Data): PPh21Calculation {
    // Calculate gross income (annual)
    const grossIncome = data.gross_salary * 12;

    // Calculate deductions
    const positionAllowanceAnnual = Math.min(
      grossIncome * 0.05, // 5% of gross income
      6_000_000 // Maximum Rp 6,000,000/year
    );

    const jhtAnnual = data.jht_employee * 12;
    const jpAnnual = data.jp_employee * 12;
    const otherDeductionsAnnual = data.other_deductions * 12;

    const totalDeductions =
      positionAllowanceAnnual + jhtAnnual + jpAnnual + otherDeductionsAnnual;

    // Calculate net income
    const netIncome = grossIncome - totalDeductions;

    // Get PTKP based on category
    const ptkpAmount = PTKP[data.ptkp_category];

    // Calculate taxable income (PKP - Penghasilan Kena Pajak)
    const taxableIncome = Math.max(0, netIncome - ptkpAmount);

    // Calculate tax using progressive rates
    const { taxAmount, breakdown } = this.calculateProgressiveTax(taxableIncome);

    // Apply NPWP surcharge if applicable (Pasal 21(5a) UU PPh)
    const applyNpwpSurcharge = this.shouldApplyNpwpSurcharge(data);
    const finalTaxAmount = applyNpwpSurcharge
      ? Math.round(taxAmount * (1 + NPWP_SURCHARGE_RATE))
      : taxAmount;

    return {
      gross_income: grossIncome,
      total_deductions: totalDeductions,
      net_income: netIncome,
      ptkp: ptkpAmount,
      taxable_income: taxableIncome,
      tax_amount: finalTaxAmount,
      tax_breakdown: breakdown,
      npwp_surcharge_applied: applyNpwpSurcharge,
      tax_before_surcharge: applyNpwpSurcharge ? taxAmount : undefined,
    };
  }

  /**
   * Calculate monthly PPh 21 for an employee
   */
  static calculateMonthly(data: PPh21Data): PPh21Calculation {
    const annualResult = this.calculateAnnual(data);

    return {
      ...annualResult,
      gross_income: annualResult.gross_income / 12,
      total_deductions: annualResult.total_deductions / 12,
      net_income: annualResult.net_income / 12,
      taxable_income: annualResult.taxable_income / 12,
      tax_amount: annualResult.tax_amount / 12,
    };
  }

  /**
   * Calculate progressive tax based on tax brackets
   */
  private static calculateProgressiveTax(taxableIncome: number): {
    taxAmount: number;
    breakdown: TaxBracketResult[];
  } {
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    const breakdown: TaxBracketResult[] = [];

    for (const bracket of PPH21_BRACKETS) {
      if (remainingIncome <= 0) break;

      const bracketRange = bracket.max - bracket.min;
      const taxableInBracket = Math.min(remainingIncome, bracketRange);
      const taxInBracket = taxableInBracket * bracket.rate;

      breakdown.push({
        bracket_min: bracket.min,
        bracket_max: bracket.max,
        rate: bracket.rate,
        taxable_amount: taxableInBracket,
        tax: taxInBracket,
      });

      totalTax += taxInBracket;
      remainingIncome -= taxableInBracket;
    }

    return { taxAmount: totalTax, breakdown };
  }

  /**
   * Calculate effective tax rate
   */
  static getEffectiveTaxRate(taxAmount: number, grossIncome: number): number {
    if (grossIncome === 0) return 0;
    return (taxAmount / grossIncome) * 100;
  }

  /**
   * Get PTKP categories with descriptions
   */
  static getPTKPCategories(): Array<{ code: PTKPCategory; description: string; amount: number }> {
    return [
      { code: 'TK0', description: 'Tidak Kawin, tanpa tanggungan', amount: PTKP.TK0 },
      { code: 'TK1', description: 'Tidak Kawin, 1 tanggungan', amount: PTKP.TK1 },
      { code: 'TK2', description: 'Tidak Kawin, 2 tanggungan', amount: PTKP.TK2 },
      { code: 'TK3', description: 'Tidak Kawin, 3 tanggungan', amount: PTKP.TK3 },
      { code: 'K0', description: 'Kawin, tanpa tanggungan', amount: PTKP.K0 },
      { code: 'K1', description: 'Kawin, 1 tanggungan', amount: PTKP.K1 },
      { code: 'K2', description: 'Kawin, 2 tanggungan', amount: PTKP.K2 },
      { code: 'K3', description: 'Kawin, 3 tanggungan', amount: PTKP.K3 },
      { code: 'KI0', description: 'Kawin, istri bekerja, tanpa tanggungan', amount: PTKP.KI0 },
      { code: 'KI1', description: 'Kawin, istri bekerja, 1 tanggungan', amount: PTKP.KI1 },
      { code: 'KI2', description: 'Kawin, istri bekerja, 2 tanggungan', amount: PTKP.KI2 },
      { code: 'KI3', description: 'Kawin, istri bekerja, 3 tanggungan', amount: PTKP.KI3 },
    ];
  }
}
