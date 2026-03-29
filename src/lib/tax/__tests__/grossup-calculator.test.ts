/**
 * Gross-Up Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { GrossUpCalculator } from '../grossup-calculator';
import { PPh21Calculator } from '../pph21-calculator';

describe('GrossUpCalculator', () => {
  describe('grossUpPPh21', () => {
    it('should calculate gross from net salary (basic case)', () => {
      const result = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 100_000_000,
        ptkpCategory: 'TK0',
        hasNpwp: true,
      });

      expect(result.net_income).toBe(100_000_000);
      expect(result.gross_income).toBeGreaterThan(100_000_000);
      expect(result.tax_amount).toBeGreaterThan(0);
      expect(result.monthly_gross).toBe(Math.round(result.gross_income / 12));
      expect(result.monthly_net).toBe(Math.round(100_000_000 / 12));
    });

    it('should be inverse of PPh21Calculator', () => {
      // Calculate tax on a known gross
      const grossSalary = 15_000_000; // monthly
      const pph21Result = PPh21Calculator.calculateAnnual({
        employee_name: 'Test',
        employee_npwp: '01.234.567.8-901.234',
        employee_nik: '1234567890123456',
        ptkp_category: 'TK0',
        gross_salary: grossSalary,
        jht_employee: 0,
        jp_employee: 0,
        position_allowance: 0,
        other_deductions: 0,
        tax_period_start: '2024-01',
        tax_period_end: '2024-12',
        has_npwp: true,
      });

      // Now gross-up from the net
      const netAnnual = pph21Result.gross_income - pph21Result.total_deductions - pph21Result.tax_amount;
      const grossUpResult = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: netAnnual,
        ptkpCategory: 'TK0',
        hasNpwp: true,
      });

      // Should recover the original gross (within rounding tolerance)
      expect(grossUpResult.gross_income).toBeCloseTo(pph21Result.gross_income, -2); // within 100 IDR
    });

    it('should handle zero taxable income (below PTKP)', () => {
      const result = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 40_000_000, // Below PTKP TK0 (54M)
        ptkpCategory: 'TK0',
        hasNpwp: true,
      });

      expect(result.tax_amount).toBe(0);
      expect(result.gross_income).toBeGreaterThanOrEqual(result.net_income);
    });

    it('should apply NPWP surcharge on gross-up', () => {
      const withNpwp = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 150_000_000,
        ptkpCategory: 'TK0',
        hasNpwp: true,
      });

      const withoutNpwp = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 150_000_000,
        ptkpCategory: 'TK0',
        hasNpwp: false,
      });

      expect(withoutNpwp.gross_income).toBeGreaterThan(withNpwp.gross_income);
      expect(withoutNpwp.tax_amount).toBeGreaterThan(withNpwp.tax_amount);
      expect(withoutNpwp.npwp_surcharge_applied).toBe(true);
    });

    it('should use correct PTKP for married with dependents', () => {
      const tk0 = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 120_000_000,
        ptkpCategory: 'TK0',
        hasNpwp: true,
      });

      const k3 = GrossUpCalculator.grossUpPPh21({
        netAnnualIncome: 120_000_000,
        ptkpCategory: 'K3',
        hasNpwp: true,
      });

      // K3 has higher PTKP so lower tax, hence lower gross needed
      expect(k3.gross_income).toBeLessThan(tk0.gross_income);
      expect(k3.tax_amount).toBeLessThan(tk0.tax_amount);
    });
  });

  describe('grossUpFlat', () => {
    it('should calculate gross from net with flat rate', () => {
      // Net = 98M, Rate = 2% → Gross = 98M / 0.98 = 100M
      const result = GrossUpCalculator.grossUpFlat({
        netAmount: 98_000_000,
        taxRate: 0.02,
      });

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(2_000_000);
    });

    it('should handle 15% rate', () => {
      // Net = 85M, Rate = 15% → Gross = 85M / 0.85 = 100M
      const result = GrossUpCalculator.grossUpFlat({
        netAmount: 85_000_000,
        taxRate: 0.15,
      });

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(15_000_000);
    });

    it('should throw for rate >= 100%', () => {
      expect(() => GrossUpCalculator.grossUpFlat({
        netAmount: 100_000_000,
        taxRate: 1.0,
      })).toThrow('Tax rate must be less than 100%');
    });
  });

  describe('grossUpPPh23', () => {
    it('should gross-up service fee (2%)', () => {
      const result = GrossUpCalculator.grossUpPPh23(98_000_000, 'service');

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(2_000_000);
      expect(result.tax_rate).toBe(0.02);
      expect(result.npwp_surcharge_applied).toBe(false);
    });

    it('should gross-up dividend (15%)', () => {
      const result = GrossUpCalculator.grossUpPPh23(85_000_000, 'dividend');

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(15_000_000);
    });

    it('should apply double rate for no NPWP', () => {
      const withNpwp = GrossUpCalculator.grossUpPPh23(100_000_000, 'service', true);
      const withoutNpwp = GrossUpCalculator.grossUpPPh23(100_000_000, 'service', false);

      // With NPWP: 2% → Gross = 100M/0.98
      // Without NPWP: 4% → Gross = 100M/0.96
      expect(withoutNpwp.gross_amount).toBeGreaterThan(withNpwp.gross_amount);
      expect(withoutNpwp.npwp_surcharge_applied).toBe(true);
    });
  });

  describe('grossUpPPh26', () => {
    it('should gross-up with standard 20% rate', () => {
      const result = GrossUpCalculator.grossUpPPh26(80_000_000, 'XX', 'service');

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(20_000_000);
      expect(result.treaty_applied).toBe(false);
    });

    it('should gross-up with Japan treaty rate (10%)', () => {
      const result = GrossUpCalculator.grossUpPPh26(90_000_000, 'JP', 'dividend');

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(10_000_000);
      expect(result.treaty_applied).toBe(true);
    });

    it('should gross-up with HK treaty rate for royalty (5%)', () => {
      const result = GrossUpCalculator.grossUpPPh26(95_000_000, 'HK', 'royalty');

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.tax_amount).toBe(5_000_000);
      expect(result.treaty_applied).toBe(true);
    });

    it('should use standard rate when treaty not applied', () => {
      const result = GrossUpCalculator.grossUpPPh26(80_000_000, 'JP', 'service', false);

      expect(result.gross_amount).toBe(100_000_000);
      expect(result.treaty_applied).toBe(false);
    });
  });
});
