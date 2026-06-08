import { PPH21_BRACKETS, PTKP, type PTKPCategory } from '@/config/constants';
import { getTERCategory, lookupTERRate } from '@/config/pph21-ter-rates';
import type { PPh21Data, PPh21Calculation, PPh21TERCalculation, TaxBracketResult } from '@/types';

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
   * Calculate annual PPh 21 for an employee.
   *
   * When `data.jtc_detail` is supplied, switches to the JTC 24-column formula
   * (PMK 66/2023): bruto = gaji + tunjangan + bonus_thr + natura;
   * iuran_karyawan = BPJS Kes + JHT + JP + JKP (all employee-side).
   * Otherwise falls back to legacy formula (gross_salary only + JHT + JP +
   * other_deductions). Both paths share PTKP + progressive tax + NPWP surcharge.
   */
  static calculateAnnual(data: PPh21Data): PPh21Calculation {
    const jtc = data.jtc_detail;

    // Monthly bruto components.
    const monthlyBruto = jtc
      ? data.gross_salary
        + (jtc.tunjangan ?? 0)
        + (jtc.bonus_thr ?? 0)
        + (jtc.natura ?? 0)
      : data.gross_salary;

    const grossIncome = monthlyBruto * 12;

    // Biaya jabatan: 5% of bruto, capped at 6M annual (= 500k/month).
    const positionAllowanceAnnual = Math.min(grossIncome * 0.05, 6_000_000);

    // Employee-side contributions (annual). JTC path adds BPJS Kes + JKP
    // on top of JHT + JP; legacy path is JHT + JP only.
    const bpjsKesAnnual = jtc ? (jtc.pengurang_bpjs_kesehatan ?? 0) * 12 : 0;
    const jhtAnnual = data.jht_employee * 12;
    const jpAnnual = data.jp_employee * 12;
    const jkpAnnual = jtc ? (jtc.pengurang_jkp ?? 0) * 12 : 0;
    const employeeContributionsAnnual = bpjsKesAnnual + jhtAnnual + jpAnnual + jkpAnnual;

    const otherDeductionsAnnual = data.other_deductions * 12;

    const totalDeductions =
      positionAllowanceAnnual + employeeContributionsAnnual + otherDeductionsAnnual;

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
      deduction_breakdown: {
        position_allowance: positionAllowanceAnnual,
        employee_contributions: employeeContributionsAnnual,
        other_deductions: otherDeductionsAnnual,
      },
    };
  }

  /**
   * Calculate monthly PPh 21 using TER (Tarif Efektif Rata-rata).
   *
   * Per PP 58/2023 & PMK 168/2023:
   * - Months 1-11: gross_salary × TER_rate = monthly tax
   * - Month 12: annual Pasal 17 progressive tax - cumulative Jan-Nov tax = December adjustment
   *
   * @param data Employee data with month (1-12) and cumulative_tax_paid (for month 12)
   */
  static calculateMonthlyTER(data: PPh21Data): PPh21TERCalculation {
    const terCategory = getTERCategory(data.ptkp_category);
    const month = data.month ?? 1;
    const isDecember = month === 12;
    const applyNpwpSurcharge = this.shouldApplyNpwpSurcharge(data);

    if (isDecember) {
      // December reconciliation: use annual Pasal 17 rates
      const annualResult = this.calculateAnnual(data);
      const annualTaxPasal17 = annualResult.tax_amount;
      const cumulativeJanNov = data.cumulative_tax_paid ?? 0;
      const decemberAdjustment = annualTaxPasal17 - cumulativeJanNov;

      return {
        gross_monthly: data.gross_salary,
        ter_category: terCategory,
        ter_rate: 0, // Not applicable for December
        tax_amount: decemberAdjustment,
        is_december_reconciliation: true,
        annual_reconciliation: {
          annual_tax_pasal17: annualTaxPasal17,
          cumulative_jan_nov_tax: cumulativeJanNov,
          december_adjustment: decemberAdjustment,
        },
        npwp_surcharge_applied: applyNpwpSurcharge,
      };
    }

    // Months 1-11: apply TER rate
    const terRate = lookupTERRate(terCategory, data.gross_salary);
    let taxAmount = Math.round(data.gross_salary * terRate);

    // Apply NPWP surcharge (20% higher) per Pasal 21(5a)
    if (applyNpwpSurcharge) {
      taxAmount = Math.round(taxAmount * (1 + NPWP_SURCHARGE_RATE));
    }

    return {
      gross_monthly: data.gross_salary,
      ter_category: terCategory,
      ter_rate: terRate,
      tax_amount: taxAmount,
      is_december_reconciliation: false,
      npwp_surcharge_applied: applyNpwpSurcharge,
    };
  }

  /**
   * Calculate monthly PPh 21 for an employee (simple annual / 12)
   * @deprecated Use calculateMonthlyTER() for PP 58/2023 compliant monthly calculation
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
