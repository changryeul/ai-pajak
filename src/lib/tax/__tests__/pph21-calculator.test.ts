/**
 * PPh21 Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { PPh21Calculator } from '../pph21-calculator';
import { PTKP, PPH21_BRACKETS } from '@/config/constants';
import type { PPh21Data } from '@/types';

describe('PPh21Calculator', () => {
  // Helper function to create test data
  const createTestData = (overrides: Partial<PPh21Data> = {}): PPh21Data => ({
    employee_name: 'Test Employee',
    employee_npwp: '01.234.567.8-901.234',
    employee_nik: '1234567890123456',
    ptkp_category: 'TK0',
    gross_salary: 10_000_000, // 10 million IDR/month
    jht_employee: 200_000,
    jp_employee: 100_000,
    position_allowance: 0,
    other_deductions: 0,
    tax_period_start: '2024-01',
    tax_period_end: '2024-12',
    ...overrides,
  });

  describe('calculateAnnual', () => {
    it('should calculate annual gross income correctly', () => {
      const data = createTestData({ gross_salary: 10_000_000 });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.gross_income).toBe(120_000_000); // 10M * 12 months
    });

    it('should apply position allowance correctly (5% up to 6M max)', () => {
      // With 10M/month salary = 120M annual, 5% = 6M (at cap)
      const data = createTestData({ gross_salary: 10_000_000 });
      const result = PPh21Calculator.calculateAnnual(data);

      // Position allowance should be capped at 6M
      // Total deductions = 6M (position) + 2.4M (JHT) + 1.2M (JP) = 9.6M
      expect(result.total_deductions).toBe(9_600_000);
    });

    it('should calculate position allowance below cap for lower salaries', () => {
      // With 5M/month salary = 60M annual, 5% = 3M (below cap)
      const data = createTestData({
        gross_salary: 5_000_000,
        jht_employee: 100_000,
        jp_employee: 50_000,
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Position allowance: 60M * 5% = 3M
      // JHT: 100K * 12 = 1.2M
      // JP: 50K * 12 = 600K
      // Total = 3M + 1.2M + 600K = 4.8M
      expect(result.total_deductions).toBe(4_800_000);
    });

    it('should apply correct PTKP for TK0 category', () => {
      const data = createTestData({ ptkp_category: 'TK0' });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.ptkp).toBe(PTKP.TK0); // 54,000,000
    });

    it('should apply correct PTKP for K3 category', () => {
      const data = createTestData({ ptkp_category: 'K3' });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.ptkp).toBe(PTKP.K3); // 72,000,000
    });

    it('should apply correct PTKP for KI0 category', () => {
      const data = createTestData({ ptkp_category: 'KI0' });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.ptkp).toBe(PTKP.KI0); // 112,500,000
    });

    it('should calculate taxable income correctly', () => {
      const data = createTestData({
        gross_salary: 10_000_000,
        ptkp_category: 'TK0',
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Gross: 120M
      // Deductions: ~9.6M (position + JHT + JP)
      // Net: 120M - 9.6M = 110.4M
      // Taxable: 110.4M - 54M (PTKP TK0) = 56.4M
      expect(result.taxable_income).toBe(56_400_000);
    });

    it('should return zero taxable income when net income is below PTKP', () => {
      const data = createTestData({
        gross_salary: 3_000_000, // Very low salary
        jht_employee: 60_000,
        jp_employee: 30_000,
        ptkp_category: 'KI3', // Highest PTKP: 126M
      });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.taxable_income).toBe(0);
      expect(result.tax_amount).toBe(0);
    });

    it('should apply first tax bracket (5%) correctly', () => {
      const data = createTestData({
        gross_salary: 10_000_000,
        ptkp_category: 'TK0',
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Taxable income: 56.4M (all in first bracket 0-60M at 5%)
      // Tax: 56.4M * 5% = 2.82M
      expect(result.tax_amount).toBe(2_820_000);
      expect(result.tax_breakdown.length).toBe(1);
      expect(result.tax_breakdown[0].rate).toBe(0.05);
    });

    it('should apply multiple tax brackets correctly', () => {
      const data = createTestData({
        gross_salary: 25_000_000, // Higher salary
        ptkp_category: 'TK0',
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Gross: 300M
      // Deductions: 6M (position cap) + 2.4M (JHT) + 1.2M (JP) = 9.6M
      // Net: 300M - 9.6M = 290.4M
      // Taxable: 290.4M - 54M = 236.4M
      // Tax bracket 1: 60M * 5% = 3M
      // Tax bracket 2: 176.4M * 15% = 26.46M
      // Total: 29.46M
      expect(result.taxable_income).toBe(236_400_000);
      expect(result.tax_amount).toBe(29_460_000);
      expect(result.tax_breakdown.length).toBe(2);
    });

    it('should handle high income across all brackets', () => {
      const data = createTestData({
        gross_salary: 500_000_000, // Very high salary (500M/month)
        jht_employee: 0,
        jp_employee: 0,
        ptkp_category: 'TK0',
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Gross: 6,000M (6 billion)
      // Deductions: 6M (position cap)
      // Net: 5,994M
      // Taxable: 5,940M
      // Should use all 5 brackets
      expect(result.tax_breakdown.length).toBe(5);
    });
  });

  describe('calculateMonthly', () => {
    it('should return monthly values (1/12 of annual)', () => {
      const data = createTestData({ gross_salary: 12_000_000 });
      const annual = PPh21Calculator.calculateAnnual(data);
      const monthly = PPh21Calculator.calculateMonthly(data);

      expect(monthly.gross_income).toBe(annual.gross_income / 12);
      expect(monthly.tax_amount).toBe(annual.tax_amount / 12);
      expect(monthly.taxable_income).toBe(annual.taxable_income / 12);
    });

    it('should preserve PTKP in monthly calculation', () => {
      const data = createTestData({ ptkp_category: 'K1' });
      const monthly = PPh21Calculator.calculateMonthly(data);

      expect(monthly.ptkp).toBe(PTKP.K1); // PTKP is annual, not divided
    });
  });

  describe('getEffectiveTaxRate', () => {
    it('should calculate effective tax rate correctly', () => {
      const taxAmount = 2_820_000;
      const grossIncome = 120_000_000;

      const rate = PPh21Calculator.getEffectiveTaxRate(taxAmount, grossIncome);

      expect(rate).toBeCloseTo(2.35, 1); // ~2.35%
    });

    it('should return 0 when gross income is 0', () => {
      const rate = PPh21Calculator.getEffectiveTaxRate(0, 0);

      expect(rate).toBe(0);
    });
  });

  describe('getPTKPCategories', () => {
    it('should return all 12 PTKP categories', () => {
      const categories = PPh21Calculator.getPTKPCategories();

      expect(categories).toHaveLength(12);
    });

    it('should have correct amounts for each category', () => {
      const categories = PPh21Calculator.getPTKPCategories();

      const tk0 = categories.find(c => c.code === 'TK0');
      expect(tk0?.amount).toBe(54_000_000);

      const ki3 = categories.find(c => c.code === 'KI3');
      expect(ki3?.amount).toBe(126_000_000);
    });

    it('should have descriptions for each category', () => {
      const categories = PPh21Calculator.getPTKPCategories();

      categories.forEach(cat => {
        expect(cat.description).toBeTruthy();
        expect(cat.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('NPWP Surcharge (Pasal 21(5a))', () => {
    it('should apply 20% surcharge when has_npwp is false', () => {
      const withNpwp = createTestData({ has_npwp: true });
      const withoutNpwp = createTestData({ has_npwp: false });

      const resultWith = PPh21Calculator.calculateAnnual(withNpwp);
      const resultWithout = PPh21Calculator.calculateAnnual(withoutNpwp);

      expect(resultWithout.npwp_surcharge_applied).toBe(true);
      expect(resultWith.npwp_surcharge_applied).toBe(false);
      expect(resultWithout.tax_amount).toBe(Math.round(resultWith.tax_amount * 1.2));
      expect(resultWithout.tax_before_surcharge).toBe(resultWith.tax_amount);
    });

    it('should apply surcharge when employee_npwp is empty', () => {
      const data = createTestData({ employee_npwp: '' });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.npwp_surcharge_applied).toBe(true);
    });

    it('should NOT apply surcharge when NPWP is provided', () => {
      const data = createTestData({ employee_npwp: '01.234.567.8-901.234' });
      const result = PPh21Calculator.calculateAnnual(data);

      expect(result.npwp_surcharge_applied).toBe(false);
      expect(result.tax_before_surcharge).toBeUndefined();
    });

    it('should apply surcharge to monthly calculation too', () => {
      const withNpwp = createTestData({ has_npwp: true });
      const withoutNpwp = createTestData({ has_npwp: false });

      const monthlyWith = PPh21Calculator.calculateMonthly(withNpwp);
      const monthlyWithout = PPh21Calculator.calculateMonthly(withoutNpwp);

      expect(monthlyWithout.tax_amount).toBeCloseTo(monthlyWith.tax_amount * 1.2, 0);
    });
  });

  describe('Progressive Tax Calculation', () => {
    it('should correctly use PPH21_BRACKETS configuration', () => {
      // Verify our brackets match the 2024 regulations
      expect(PPH21_BRACKETS[0]).toEqual({ min: 0, max: 60_000_000, rate: 0.05 });
      expect(PPH21_BRACKETS[1]).toEqual({ min: 60_000_000, max: 250_000_000, rate: 0.15 });
      expect(PPH21_BRACKETS[2]).toEqual({ min: 250_000_000, max: 500_000_000, rate: 0.25 });
      expect(PPH21_BRACKETS[3]).toEqual({ min: 500_000_000, max: 5_000_000_000, rate: 0.30 });
      expect(PPH21_BRACKETS[4]).toEqual({ min: 5_000_000_000, max: Infinity, rate: 0.35 });
    });

    it('should calculate tax breakdown with correct bracket information', () => {
      const data = createTestData({
        gross_salary: 30_000_000,
        ptkp_category: 'TK0',
      });
      const result = PPh21Calculator.calculateAnnual(data);

      // Each bracket should have proper structure
      result.tax_breakdown.forEach(bracket => {
        expect(bracket).toHaveProperty('bracket_min');
        expect(bracket).toHaveProperty('bracket_max');
        expect(bracket).toHaveProperty('rate');
        expect(bracket).toHaveProperty('taxable_amount');
        expect(bracket).toHaveProperty('tax');
        expect(bracket.taxable_amount * bracket.rate).toBeCloseTo(bracket.tax, 0);
      });
    });
  });
});
