/**
 * PPh 22 Domestic Transaction Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { PPh22Calculator } from '../pph22-calculator';
import type { PPh22Data } from '@/types';

describe('PPh22Calculator', () => {
  const createTestData = (overrides: Partial<PPh22Data> = {}): PPh22Data => ({
    transaction_type: 'GOVERNMENT_PROCUREMENT',
    gross_amount: 100_000_000,
    payer_name: 'PT Test',
    payer_npwp: '01.234.567.8-901.234',
    has_npwp: true,
    ...overrides,
  });

  describe('Government Procurement', () => {
    it('should calculate 1.5% for government procurement with NPWP', () => {
      const data = createTestData({ gross_amount: 100_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.base_rate).toBe(0.015);
      expect(result.applied_rate).toBe(0.015);
      expect(result.tax_amount).toBe(1_500_000);
      expect(result.npwp_surcharge_applied).toBe(false);
    });

    it('should calculate 3% for government procurement without NPWP', () => {
      const data = createTestData({ has_npwp: false, gross_amount: 100_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.applied_rate).toBe(0.03);
      expect(result.tax_amount).toBe(3_000_000);
      expect(result.npwp_surcharge_applied).toBe(true);
    });
  });

  describe('Specific Goods', () => {
    it('should calculate 0.25% for cement with NPWP', () => {
      const data = createTestData({ transaction_type: 'CEMENT', gross_amount: 500_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.base_rate).toBe(0.0025);
      expect(result.tax_amount).toBe(1_250_000);
    });

    it('should calculate 0.45% for automotive with NPWP', () => {
      const data = createTestData({ transaction_type: 'AUTOMOTIVE', gross_amount: 300_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.base_rate).toBe(0.0045);
      expect(result.tax_amount).toBe(1_350_000);
    });

    it('should calculate 0.3% for steel with NPWP', () => {
      const data = createTestData({ transaction_type: 'STEEL', gross_amount: 200_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.base_rate).toBe(0.003);
      expect(result.tax_amount).toBe(600_000);
    });

    it('should calculate 5% for luxury goods', () => {
      const data = createTestData({ transaction_type: 'LUXURY_GOODS', gross_amount: 1_000_000_000 });
      const result = PPh22Calculator.calculate(data);

      expect(result.base_rate).toBe(0.05);
      expect(result.tax_amount).toBe(50_000_000);
      expect(result.is_creditable).toBe(false); // Luxury not creditable
    });
  });

  describe('NPWP Surcharge', () => {
    it('should double rate when no NPWP', () => {
      const withNpwp = createTestData({ transaction_type: 'STEEL', has_npwp: true, gross_amount: 100_000_000 });
      const withoutNpwp = createTestData({ transaction_type: 'STEEL', has_npwp: false, gross_amount: 100_000_000 });

      const resultWith = PPh22Calculator.calculate(withNpwp);
      const resultWithout = PPh22Calculator.calculate(withoutNpwp);

      expect(resultWithout.tax_amount).toBe(resultWith.tax_amount * 2);
      expect(resultWithout.npwp_surcharge_applied).toBe(true);
    });

    it('should infer no NPWP from empty payer_npwp', () => {
      const data = createTestData({ payer_npwp: '', has_npwp: undefined });
      const result = PPh22Calculator.calculate(data);

      expect(result.npwp_surcharge_applied).toBe(true);
    });
  });

  describe('getTransactionTypes', () => {
    it('should return all transaction types', () => {
      const types = PPh22Calculator.getTransactionTypes();

      expect(types.length).toBeGreaterThan(8);
      const govt = types.find(t => t.type === 'GOVERNMENT_PROCUREMENT');
      expect(govt).toBeDefined();
      expect(govt?.rate).toBe(0.015);
    });
  });

  describe('calculateBulk', () => {
    it('should calculate totals for multiple transactions', () => {
      const transactions: PPh22Data[] = [
        createTestData({ transaction_type: 'GOVERNMENT_PROCUREMENT', gross_amount: 100_000_000 }),
        createTestData({ transaction_type: 'CEMENT', gross_amount: 500_000_000 }),
      ];

      const result = PPh22Calculator.calculateBulk(transactions);

      expect(result.calculations).toHaveLength(2);
      expect(result.totalGross).toBe(600_000_000);
      // Govt: 100M * 1.5% = 1.5M, Cement: 500M * 0.25% = 1.25M
      expect(result.totalTax).toBe(2_750_000);
    });

    it('should handle empty array', () => {
      const result = PPh22Calculator.calculateBulk([]);
      expect(result.totalGross).toBe(0);
      expect(result.totalTax).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should throw for unknown transaction type', () => {
      const data = createTestData({ transaction_type: 'INVALID_TYPE' });
      expect(() => PPh22Calculator.calculate(data)).toThrow('Unknown PPh 22 transaction type');
    });
  });
});
