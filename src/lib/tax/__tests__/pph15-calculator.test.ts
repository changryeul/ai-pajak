import { describe, it, expect } from 'vitest';
import { PPh15Calculator } from '../pph15-calculator';

describe('PPh15Calculator', () => {
  describe('calculate', () => {
    it('should calculate domestic shipping at 1.2%', () => {
      const result = PPh15Calculator.calculate({
        industryType: 'DOMESTIC_SHIPPING',
        grossIncome: 1_000_000_000,
      });
      expect(result.tax_rate).toBe(0.012);
      expect(result.tax_amount).toBe(12_000_000);
      expect(result.net_income).toBe(988_000_000);
      expect(result.is_final).toBe(true);
      expect(result.legal_basis).toContain('KMK 416');
    });

    it('should calculate domestic airline at 1.8%', () => {
      const result = PPh15Calculator.calculate({
        industryType: 'DOMESTIC_AIRLINE',
        grossIncome: 500_000_000,
      });
      expect(result.tax_rate).toBe(0.018);
      expect(result.tax_amount).toBe(9_000_000);
      expect(result.is_final).toBe(true);
    });

    it('should calculate foreign PE at 2.64%', () => {
      const result = PPh15Calculator.calculate({
        industryType: 'FOREIGN_SHIPPING_PE',
        grossIncome: 2_000_000_000,
      });
      expect(result.tax_rate).toBe(0.0264);
      expect(result.tax_amount).toBe(52_800_000);
      expect(result.is_final).toBe(true);
      expect(result.legal_basis).toContain('Pasal 15');
    });

    it('should round tax amount', () => {
      const result = PPh15Calculator.calculate({
        industryType: 'DOMESTIC_SHIPPING',
        grossIncome: 123_456_789,
      });
      expect(Number.isInteger(result.tax_amount)).toBe(true);
      expect(result.tax_amount).toBe(Math.round(123_456_789 * 0.012));
    });
  });

  describe('getIndustryTypes', () => {
    it('should return 3 industry types', () => {
      const types = PPh15Calculator.getIndustryTypes();
      expect(types).toHaveLength(3);
    });

    it('should have correct rates', () => {
      const types = PPh15Calculator.getIndustryTypes();
      const rateMap = Object.fromEntries(types.map(t => [t.type, t.rate]));
      expect(rateMap.DOMESTIC_SHIPPING).toBe(0.012);
      expect(rateMap.DOMESTIC_AIRLINE).toBe(0.018);
      expect(rateMap.FOREIGN_SHIPPING_PE).toBe(0.0264);
    });
  });
});
