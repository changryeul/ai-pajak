/**
 * PPh23 Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { PPh23Calculator } from '../pph23-calculator';
import { PPH23_RATES } from '@/config/constants';
import type { PPh23Data } from '@/types';

describe('PPh23Calculator', () => {
  // Helper function to create test data
  const createTestData = (overrides: Partial<PPh23Data> = {}): PPh23Data => ({
    transaction_type: 'service',
    gross_amount: 10_000_000,
    recipient_name: 'Test Recipient',
    recipient_npwp: '01.234.567.8-901.234',
    transaction_date: '2024-01-15',
    description: 'Consulting service',
    ...overrides,
  });

  describe('calculate', () => {
    it('should calculate service tax at 2% rate', () => {
      const data = createTestData({
        transaction_type: 'service',
        gross_amount: 10_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.gross_amount).toBe(10_000_000);
      expect(result.tax_rate).toBe(0.02);
      expect(result.tax_amount).toBe(200_000);
      expect(result.net_amount).toBe(9_800_000);
    });

    it('should calculate rent tax at 2% rate', () => {
      const data = createTestData({
        transaction_type: 'rent',
        gross_amount: 50_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_rate).toBe(0.02);
      expect(result.tax_amount).toBe(1_000_000);
      expect(result.net_amount).toBe(49_000_000);
    });

    it('should calculate dividend tax at 15% rate', () => {
      const data = createTestData({
        transaction_type: 'dividend',
        gross_amount: 100_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_rate).toBe(0.15);
      expect(result.tax_amount).toBe(15_000_000);
      expect(result.net_amount).toBe(85_000_000);
    });

    it('should calculate interest tax at 15% rate', () => {
      const data = createTestData({
        transaction_type: 'interest',
        gross_amount: 5_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_rate).toBe(0.15);
      expect(result.tax_amount).toBe(750_000);
      expect(result.net_amount).toBe(4_250_000);
    });

    it('should calculate royalty tax at 15% rate', () => {
      const data = createTestData({
        transaction_type: 'royalty',
        gross_amount: 20_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_rate).toBe(0.15);
      expect(result.tax_amount).toBe(3_000_000);
      expect(result.net_amount).toBe(17_000_000);
    });

    it('should calculate prize tax at 15% rate', () => {
      const data = createTestData({
        transaction_type: 'prize',
        gross_amount: 25_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_rate).toBe(0.15);
      expect(result.tax_amount).toBe(3_750_000);
      expect(result.net_amount).toBe(21_250_000);
    });

    it('should handle zero amount', () => {
      const data = createTestData({ gross_amount: 0 });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_amount).toBe(0);
      expect(result.net_amount).toBe(0);
    });

    it('should preserve gross_amount in result', () => {
      const data = createTestData({ gross_amount: 12_345_678 });
      const result = PPh23Calculator.calculate(data);

      expect(result.gross_amount).toBe(12_345_678);
    });
  });

  describe('getTaxRate', () => {
    it('should return correct rates for all transaction types', () => {
      expect(PPh23Calculator.getTaxRate('dividend')).toBe(PPH23_RATES.DIVIDEND);
      expect(PPh23Calculator.getTaxRate('interest')).toBe(PPH23_RATES.INTEREST);
      expect(PPh23Calculator.getTaxRate('royalty')).toBe(PPH23_RATES.ROYALTY);
      expect(PPh23Calculator.getTaxRate('prize')).toBe(PPH23_RATES.PRIZE);
      expect(PPh23Calculator.getTaxRate('rent')).toBe(PPH23_RATES.RENT);
      expect(PPh23Calculator.getTaxRate('service')).toBe(PPH23_RATES.SERVICE);
    });

    it('should have 15% rate for capital income types', () => {
      expect(PPh23Calculator.getTaxRate('dividend')).toBe(0.15);
      expect(PPh23Calculator.getTaxRate('interest')).toBe(0.15);
      expect(PPh23Calculator.getTaxRate('royalty')).toBe(0.15);
      expect(PPh23Calculator.getTaxRate('prize')).toBe(0.15);
    });

    it('should have 2% rate for service income types', () => {
      expect(PPh23Calculator.getTaxRate('rent')).toBe(0.02);
      expect(PPh23Calculator.getTaxRate('service')).toBe(0.02);
    });
  });

  describe('getTransactionTypes', () => {
    it('should return all 6 transaction types', () => {
      const types = PPh23Calculator.getTransactionTypes();

      expect(types).toHaveLength(6);
    });

    it('should have correct structure for each type', () => {
      const types = PPh23Calculator.getTransactionTypes();

      types.forEach(type => {
        expect(type).toHaveProperty('type');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('rate');
        expect(typeof type.description).toBe('string');
        expect(typeof type.rate).toBe('number');
      });
    });

    it('should include all transaction type keys', () => {
      const types = PPh23Calculator.getTransactionTypes();
      const typeKeys = types.map(t => t.type);

      expect(typeKeys).toContain('dividend');
      expect(typeKeys).toContain('interest');
      expect(typeKeys).toContain('royalty');
      expect(typeKeys).toContain('prize');
      expect(typeKeys).toContain('rent');
      expect(typeKeys).toContain('service');
    });
  });

  describe('calculateBulk', () => {
    it('should calculate totals for multiple transactions', () => {
      const transactions: PPh23Data[] = [
        createTestData({ transaction_type: 'service', gross_amount: 10_000_000 }),
        createTestData({ transaction_type: 'dividend', gross_amount: 50_000_000 }),
        createTestData({ transaction_type: 'rent', gross_amount: 20_000_000 }),
      ];

      const result = PPh23Calculator.calculateBulk(transactions);

      expect(result.calculations).toHaveLength(3);
      expect(result.totalGross).toBe(80_000_000);

      // Service: 10M * 2% = 200K
      // Dividend: 50M * 15% = 7.5M
      // Rent: 20M * 2% = 400K
      // Total tax: 8.1M
      expect(result.totalTax).toBe(8_100_000);
      expect(result.totalNet).toBe(71_900_000);
    });

    it('should return correct individual calculations', () => {
      const transactions: PPh23Data[] = [
        createTestData({ transaction_type: 'service', gross_amount: 5_000_000 }),
        createTestData({ transaction_type: 'interest', gross_amount: 10_000_000 }),
      ];

      const result = PPh23Calculator.calculateBulk(transactions);

      expect(result.calculations[0].tax_amount).toBe(100_000); // 5M * 2%
      expect(result.calculations[1].tax_amount).toBe(1_500_000); // 10M * 15%
    });

    it('should handle empty array', () => {
      const result = PPh23Calculator.calculateBulk([]);

      expect(result.calculations).toHaveLength(0);
      expect(result.totalGross).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.totalNet).toBe(0);
    });

    it('should handle single transaction', () => {
      const transactions = [createTestData({ gross_amount: 100_000_000 })];
      const result = PPh23Calculator.calculateBulk(transactions);

      expect(result.calculations).toHaveLength(1);
      expect(result.totalGross).toBe(100_000_000);
    });
  });

  describe('NPWP Surcharge (Pasal 23(1a))', () => {
    it('should apply 100% surcharge (double rate) when no NPWP', () => {
      const withNpwp = createTestData({ has_npwp: true, gross_amount: 10_000_000 });
      const withoutNpwp = createTestData({ has_npwp: false, gross_amount: 10_000_000 });

      const resultWith = PPh23Calculator.calculate(withNpwp);
      const resultWithout = PPh23Calculator.calculate(withoutNpwp);

      expect(resultWith.npwp_surcharge_applied).toBe(false);
      expect(resultWithout.npwp_surcharge_applied).toBe(true);
      // Service: 2% → 4% without NPWP
      expect(resultWithout.tax_amount).toBe(resultWith.tax_amount * 2);
      expect(resultWithout.effective_rate).toBe(0.04);
    });

    it('should double 15% rate to 30% for dividends without NPWP', () => {
      const data = createTestData({
        transaction_type: 'dividend',
        gross_amount: 100_000_000,
        has_npwp: false,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_amount).toBe(30_000_000); // 100M * 30%
      expect(result.effective_rate).toBe(0.30);
    });

    it('should infer no NPWP from empty recipient_npwp', () => {
      const data = createTestData({ recipient_npwp: '', gross_amount: 10_000_000 });
      const result = PPh23Calculator.calculate(data);

      expect(result.npwp_surcharge_applied).toBe(true);
    });

    it('should NOT surcharge when recipient_npwp is provided', () => {
      const data = createTestData({ recipient_npwp: '01.234.567.8-901.234', gross_amount: 10_000_000 });
      const result = PPh23Calculator.calculate(data);

      expect(result.npwp_surcharge_applied).toBe(false);
      expect(result.effective_rate).toBeUndefined();
    });
  });

  describe('Tax Rates Configuration', () => {
    it('should verify PPH23_RATES configuration matches expectations', () => {
      expect(PPH23_RATES.DIVIDEND).toBe(0.15);
      expect(PPH23_RATES.INTEREST).toBe(0.15);
      expect(PPH23_RATES.ROYALTY).toBe(0.15);
      expect(PPH23_RATES.PRIZE).toBe(0.15);
      expect(PPH23_RATES.RENT).toBe(0.02);
      expect(PPH23_RATES.SERVICE).toBe(0.02);
    });
  });

  describe('Service Subcategorization (PMK 141/2015)', () => {
    it('should return ebupot_service_code when service_subtype is provided', () => {
      const data = createTestData({
        transaction_type: 'service',
        gross_amount: 10_000_000,
        service_subtype: 'JASA_AKUNTANSI',
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.ebupot_service_code).toBe('24-104-03');
      expect(result.service_subtype_label).toBe('Jasa akuntansi, pembukuan, dan atestasi laporan keuangan');
      expect(result.tax_rate).toBe(0.02); // Rate unchanged
    });

    it('should return ebupot code for software services', () => {
      const data = createTestData({
        transaction_type: 'service',
        service_subtype: 'JASA_SEHUBUNGAN_SOFTWARE',
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.ebupot_service_code).toBe('24-104-21');
      expect(result.service_subtype_label).toContain('software');
    });

    it('should work without service_subtype (backward compat)', () => {
      const data = createTestData({
        transaction_type: 'service',
        gross_amount: 5_000_000,
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.tax_amount).toBe(100_000);
      expect(result.ebupot_service_code).toBeUndefined();
      expect(result.service_subtype_label).toBeUndefined();
    });

    it('should ignore service_subtype for non-service transactions', () => {
      const data = createTestData({
        transaction_type: 'dividend',
        gross_amount: 100_000_000,
        service_subtype: 'JASA_HUKUM',
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.ebupot_service_code).toBeUndefined();
      expect(result.tax_rate).toBe(0.15);
    });

    it('should handle unknown service_subtype gracefully', () => {
      const data = createTestData({
        transaction_type: 'service',
        service_subtype: 'UNKNOWN_CODE',
      });
      const result = PPh23Calculator.calculate(data);

      expect(result.ebupot_service_code).toBeUndefined();
      expect(result.service_subtype_label).toBeUndefined();
      expect(result.tax_rate).toBe(0.02); // Rate still correct
    });
  });

  describe('getServiceSubtypes', () => {
    it('should return 62 service subtypes', () => {
      const subtypes = PPh23Calculator.getServiceSubtypes();
      expect(subtypes).toHaveLength(62);
    });

    it('should have correct structure for each subtype', () => {
      const subtypes = PPh23Calculator.getServiceSubtypes();
      subtypes.forEach(st => {
        expect(st).toHaveProperty('code');
        expect(st).toHaveProperty('label');
        expect(st).toHaveProperty('ebupotCode');
        expect(st.ebupotCode).toMatch(/^24-104-\d{2}$/);
      });
    });

    it('should include key service types', () => {
      const subtypes = PPh23Calculator.getServiceSubtypes();
      const codes = subtypes.map(s => s.code);

      expect(codes).toContain('JASA_AKUNTANSI');
      expect(codes).toContain('JASA_HUKUM');
      expect(codes).toContain('JASA_SEHUBUNGAN_SOFTWARE');
      expect(codes).toContain('JASA_KEBERSIHAN');
      expect(codes).toContain('JASA_PEMBUATAN_KATERING');
    });
  });
});
