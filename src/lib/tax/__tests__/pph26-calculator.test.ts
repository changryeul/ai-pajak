/**
 * PPh 26 Calculator Unit Tests
 * Non-Resident Withholding Tax (Pasal 26 UU PPh)
 */

import { describe, it, expect } from 'vitest';
import { PPh26Calculator } from '../pph26-calculator';
import { PPH26_STANDARD_RATE } from '@/config/constants';
import type { PPh26Data } from '@/types';

describe('PPh26Calculator', () => {
  const createTestData = (overrides: Partial<PPh26Data> = {}): PPh26Data => ({
    income_type: 'dividend',
    gross_amount: 100_000_000,
    recipient_name: 'Foreign Corp',
    recipient_country: 'US',
    apply_treaty: true,
    transaction_date: '2024-06-15',
    description: 'Dividend payment',
    ...overrides,
  });

  describe('Standard rate (no treaty)', () => {
    it('should apply 20% standard rate when no treaty', () => {
      const data = createTestData({
        recipient_country: 'XX', // Non-treaty country
        gross_amount: 100_000_000,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.standard_rate).toBe(0.20);
      expect(result.applied_rate).toBe(0.20);
      expect(result.tax_amount).toBe(20_000_000);
      expect(result.net_amount).toBe(80_000_000);
      expect(result.is_treaty_applied).toBe(false);
    });

    it('should apply 20% when apply_treaty is false', () => {
      const data = createTestData({
        recipient_country: 'JP', // Treaty country
        apply_treaty: false,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.20);
      expect(result.is_treaty_applied).toBe(false);
    });
  });

  describe('Treaty rates (P3B)', () => {
    it('should apply Japan treaty rate for dividends (10%)', () => {
      const data = createTestData({
        recipient_country: 'JP',
        income_type: 'dividend',
        gross_amount: 100_000_000,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.10);
      expect(result.tax_amount).toBe(10_000_000);
      expect(result.is_treaty_applied).toBe(true);
      expect(result.treaty_country).toBe('Japan');
      expect(result.treaty_reference).toContain('Japan');
    });

    it('should apply Korea treaty rate for royalties (15%)', () => {
      const data = createTestData({
        recipient_country: 'KR',
        income_type: 'royalty',
        gross_amount: 50_000_000,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.15);
      expect(result.tax_amount).toBe(7_500_000);
      expect(result.treaty_country).toBe('South Korea');
    });

    it('should apply Hong Kong treaty rate for dividends (5%)', () => {
      const data = createTestData({
        recipient_country: 'HK',
        income_type: 'dividend',
        gross_amount: 200_000_000,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.05);
      expect(result.tax_amount).toBe(10_000_000);
    });

    it('should apply UAE treaty rate for interest (5%)', () => {
      const data = createTestData({
        recipient_country: 'AE',
        income_type: 'interest',
        gross_amount: 100_000_000,
      });
      const result = PPh26Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.05);
      expect(result.tax_amount).toBe(5_000_000);
    });

    it('should NOT apply treaty for "other" income type', () => {
      const data = createTestData({
        recipient_country: 'JP',
        income_type: 'other',
      });
      const result = PPh26Calculator.calculate(data);

      // "other" defaults to standard 20%
      expect(result.applied_rate).toBe(0.20);
      expect(result.is_treaty_applied).toBe(false);
    });

    it('should handle case-insensitive country codes', () => {
      const data = createTestData({ recipient_country: 'jp' });
      const result = PPh26Calculator.calculate(data);

      expect(result.is_treaty_applied).toBe(true);
      expect(result.treaty_country).toBe('Japan');
    });
  });

  describe('hasTreaty', () => {
    it('should return true for treaty countries', () => {
      expect(PPh26Calculator.hasTreaty('JP')).toBe(true);
      expect(PPh26Calculator.hasTreaty('KR')).toBe(true);
      expect(PPh26Calculator.hasTreaty('SG')).toBe(true);
      expect(PPh26Calculator.hasTreaty('US')).toBe(true);
    });

    it('should return false for non-treaty countries', () => {
      expect(PPh26Calculator.hasTreaty('XX')).toBe(false);
      expect(PPh26Calculator.hasTreaty('ZZ')).toBe(false);
    });
  });

  describe('getTreatyCountries', () => {
    it('should return list of treaty countries', () => {
      const countries = PPh26Calculator.getTreatyCountries();

      expect(countries.length).toBeGreaterThan(10);
      const jp = countries.find(c => c.code === 'JP');
      expect(jp).toBeDefined();
      expect(jp?.country).toBe('Japan');
      expect(jp?.dividendRate).toBe(0.10);
    });
  });

  describe('calculateBulk', () => {
    it('should calculate totals for multiple transactions', () => {
      const transactions: PPh26Data[] = [
        createTestData({ recipient_country: 'JP', income_type: 'dividend', gross_amount: 100_000_000 }),
        createTestData({ recipient_country: 'XX', income_type: 'service', gross_amount: 50_000_000 }),
        createTestData({ recipient_country: 'HK', income_type: 'royalty', gross_amount: 80_000_000 }),
      ];

      const result = PPh26Calculator.calculateBulk(transactions);

      expect(result.calculations).toHaveLength(3);
      expect(result.totalGross).toBe(230_000_000);
      expect(result.treatyAppliedCount).toBe(2); // JP and HK

      // JP dividend: 100M * 10% = 10M
      // XX service: 50M * 20% = 10M
      // HK royalty: 80M * 5% = 4M
      expect(result.totalTax).toBe(24_000_000);
      expect(result.totalNet).toBe(206_000_000);
    });

    it('should handle empty array', () => {
      const result = PPh26Calculator.calculateBulk([]);
      expect(result.totalGross).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.treatyAppliedCount).toBe(0);
    });
  });
});
