/**
 * PPN Calculator Unit Tests
 *
 * Tests for Indonesian Value Added Tax calculations
 * including PMK 131/2024 DPP adjustments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PPNCalculator } from '../ppn-calculator';
import type { PPNData } from '@/types';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
        }),
        ilike: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    }),
  }),
}));

describe('PPNCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateEffectivePPNRate', () => {
    it('should return 11% for transactions before 2025', () => {
      const date2024 = new Date('2024-06-15');

      expect(PPNCalculator.calculateEffectivePPNRate(date2024, false)).toBe(0.11);
      expect(PPNCalculator.calculateEffectivePPNRate(date2024, true)).toBe(0.11);
    });

    it('should return 11% for essential items in 2025', () => {
      const date2025 = new Date('2025-03-15');

      expect(PPNCalculator.calculateEffectivePPNRate(date2025, false)).toBe(0.11);
    });

    it('should return 12% for luxury items in 2025', () => {
      const date2025 = new Date('2025-03-15');

      expect(PPNCalculator.calculateEffectivePPNRate(date2025, true)).toBe(0.12);
    });

    it('should handle year boundary correctly', () => {
      const dec2024 = new Date('2024-12-31');
      const jan2025 = new Date('2025-01-01');

      expect(PPNCalculator.calculateEffectivePPNRate(dec2024, false)).toBe(0.11);
      expect(PPNCalculator.calculateEffectivePPNRate(jan2025, false)).toBe(0.11);
      expect(PPNCalculator.calculateEffectivePPNRate(jan2025, true)).toBe(0.12);
    });
  });

  describe('adjustDPP', () => {
    it('should not adjust DPP before 2025', () => {
      const date2024 = new Date('2024-06-15');
      const dpp = 100_000_000;

      expect(PPNCalculator.adjustDPP(dpp, date2024, false)).toBe(dpp);
      expect(PPNCalculator.adjustDPP(dpp, date2024, true)).toBe(dpp);
    });

    it('should not adjust DPP for luxury items in 2025', () => {
      const date2025 = new Date('2025-06-15');
      const dpp = 100_000_000;

      expect(PPNCalculator.adjustDPP(dpp, date2025, true)).toBe(dpp);
    });

    it('should adjust DPP for essential items in 2025', () => {
      const date2025 = new Date('2025-06-15');
      const dpp = 120_000_000;

      // Adjusted DPP = 120M * (11/12) = 110M
      expect(PPNCalculator.adjustDPP(dpp, date2025, false)).toBe(110_000_000);
    });

    it('should round adjusted DPP to nearest integer', () => {
      const date2025 = new Date('2025-06-15');
      const dpp = 100_000_000;

      // 100M * (11/12) = 91,666,666.67 → 91,666,667
      const adjusted = PPNCalculator.adjustDPP(dpp, date2025, false);
      expect(Number.isInteger(adjusted)).toBe(true);
    });
  });

  describe('calculateSimple', () => {
    it('should calculate PPN for 2024 essential items', () => {
      const date2024 = new Date('2024-06-15');
      const result = PPNCalculator.calculateSimple(100_000_000, date2024, false);

      expect(result.original_dpp).toBe(100_000_000);
      expect(result.adjusted_dpp).toBe(100_000_000);
      expect(result.ppn_rate).toBe(0.11);
      expect(result.ppn_amount).toBe(11_000_000);
      expect(result.total_with_ppn).toBe(111_000_000);
      expect(result.is_luxury_item).toBe(false);
    });

    it('should calculate PPN for 2024 luxury items', () => {
      const date2024 = new Date('2024-06-15');
      const result = PPNCalculator.calculateSimple(100_000_000, date2024, true);

      expect(result.ppn_rate).toBe(0.11);
      expect(result.ppn_amount).toBe(11_000_000);
      expect(result.is_luxury_item).toBe(true);
    });

    it('should calculate PPN for 2025 essential items with DPP adjustment', () => {
      const date2025 = new Date('2025-06-15');
      const result = PPNCalculator.calculateSimple(120_000_000, date2025, false);

      // PMK 131/2024 DJP SPT Masa PPN form:
      //   Adjusted DPP (Nilai Lain) = 120M × 11/12 = 110M
      //   PPN = statutory 12% × adjusted = 110M × 12% = 13.2M
      //   Effective rate vs original = 13.2M / 120M = 11%
      // (이전 12.1M expectation 은 effective 11% 가 adjusted 110M 에 잘못
      //  곱해지던 버그 결과였음 — 2026-06-29 수정.)
      expect(result.original_dpp).toBe(120_000_000);
      expect(result.adjusted_dpp).toBe(110_000_000);
      expect(result.ppn_rate).toBe(0.11);
      expect(result.ppn_amount).toBe(13_200_000);
      expect(result.is_luxury_item).toBe(false);
    });

    it('should calculate PPN for 2025 luxury items without DPP adjustment', () => {
      const date2025 = new Date('2025-06-15');
      const result = PPNCalculator.calculateSimple(100_000_000, date2025, true);

      expect(result.original_dpp).toBe(100_000_000);
      expect(result.adjusted_dpp).toBe(100_000_000);
      expect(result.ppn_rate).toBe(0.12);
      expect(result.ppn_amount).toBe(12_000_000);
      expect(result.is_luxury_item).toBe(true);
    });
  });

  describe('calculateDPPFromTotal', () => {
    it('should reverse calculate DPP from total for 2024', () => {
      const date2024 = new Date('2024-06-15');
      const totalWithPPN = 111_000_000; // 100M + 11M PPN

      const dpp = PPNCalculator.calculateDPPFromTotal(totalWithPPN, date2024, false);

      expect(dpp).toBe(100_000_000);
    });

    it('should reverse calculate DPP from total for 2025 luxury', () => {
      const date2025 = new Date('2025-06-15');
      const totalWithPPN = 112_000_000; // 100M + 12M PPN

      const dpp = PPNCalculator.calculateDPPFromTotal(totalWithPPN, date2025, true);

      expect(dpp).toBe(100_000_000);
    });

    it('should reverse calculate DPP for 2025 essential with adjustment', () => {
      const date2025 = new Date('2025-06-15');
      const totalWithPPN = 122_100_000; // 110M adjusted + 12.1M PPN

      const dpp = PPNCalculator.calculateDPPFromTotal(totalWithPPN, date2025, false);

      // Should reverse the (11/12) adjustment
      expect(dpp).toBeCloseTo(120_000_000, -3); // Allow some rounding
    });
  });

  describe('calculateMonthlySummary', () => {
    const createPPNData = (type: 'sale' | 'purchase', ppnAmount: number): PPNData => ({
      transaction_type: type,
      invoice_number: 'INV-001',
      invoice_date: '2024-01-15',
      customer_name: 'Test Customer',
      customer_npwp: '01.234.567.8-901.234',
      dpp: ppnAmount * (100 / 11), // Calculate DPP from PPN amount
      ppn_amount: ppnAmount,
      items: [],
    });

    it('should calculate payable status when output > input', () => {
      const sales = [
        createPPNData('sale', 5_000_000),
        createPPNData('sale', 3_000_000),
      ];
      const purchases = [createPPNData('purchase', 2_000_000)];

      const summary = PPNCalculator.calculateMonthlySummary(sales, purchases);

      expect(summary.output_tax).toBe(8_000_000);
      expect(summary.input_tax).toBe(2_000_000);
      expect(summary.net_tax).toBe(6_000_000);
      expect(summary.status).toBe('payable');
    });

    it('should calculate creditable status when input > output', () => {
      const sales = [createPPNData('sale', 2_000_000)];
      const purchases = [
        createPPNData('purchase', 5_000_000),
        createPPNData('purchase', 3_000_000),
      ];

      const summary = PPNCalculator.calculateMonthlySummary(sales, purchases);

      expect(summary.output_tax).toBe(2_000_000);
      expect(summary.input_tax).toBe(8_000_000);
      expect(summary.net_tax).toBe(6_000_000);
      expect(summary.status).toBe('creditable');
    });

    it('should handle empty transactions', () => {
      const summary = PPNCalculator.calculateMonthlySummary([], []);

      expect(summary.output_tax).toBe(0);
      expect(summary.input_tax).toBe(0);
      expect(summary.net_tax).toBe(0);
      expect(summary.status).toBe('payable');
    });

    it('should handle zero net tax', () => {
      const sales = [createPPNData('sale', 5_000_000)];
      const purchases = [createPPNData('purchase', 5_000_000)];

      const summary = PPNCalculator.calculateMonthlySummary(sales, purchases);

      expect(summary.net_tax).toBe(0);
      expect(summary.status).toBe('payable');
    });
  });

  describe('validateFakturPajakNumber', () => {
    it('should validate correct format', () => {
      expect(PPNCalculator.validateFakturPajakNumber('010.000-24.12345678')).toBe(true);
      expect(PPNCalculator.validateFakturPajakNumber('001.000-25.00000001')).toBe(true);
    });

    it('should reject incorrect formats', () => {
      expect(PPNCalculator.validateFakturPajakNumber('10.000-24.12345678')).toBe(false);
      expect(PPNCalculator.validateFakturPajakNumber('010.00-24.12345678')).toBe(false);
      expect(PPNCalculator.validateFakturPajakNumber('010.000-2.12345678')).toBe(false);
      expect(PPNCalculator.validateFakturPajakNumber('010.000-24.1234567')).toBe(false);
      expect(PPNCalculator.validateFakturPajakNumber('ABC.000-24.12345678')).toBe(false);
    });
  });

  describe('generateFakturPajakNumber', () => {
    it('should generate correct format', () => {
      const result = PPNCalculator.generateFakturPajakNumber('01', '2024', 1);

      expect(result).toBe('001.000-24.00000001');
      expect(PPNCalculator.validateFakturPajakNumber(result)).toBe(true);
    });

    it('should pad codes correctly', () => {
      expect(PPNCalculator.generateFakturPajakNumber('1', '2025', 123))
        .toBe('001.000-25.00000123');
    });

    it('should handle large sequential numbers', () => {
      const result = PPNCalculator.generateFakturPajakNumber('010', '2024', 99999999);

      expect(result).toBe('010.000-24.99999999');
      expect(PPNCalculator.validateFakturPajakNumber(result)).toBe(true);
    });
  });

  describe('getRate and getRatePercentage', () => {
    it('should return 11% for 2024', () => {
      const date2024 = new Date('2024-06-15');

      expect(PPNCalculator.getRate(date2024)).toBe(0.11);
      expect(PPNCalculator.getRatePercentage(date2024)).toBe(11);
    });

    it('should return 12% for 2025', () => {
      const date2025 = new Date('2025-06-15');

      expect(PPNCalculator.getRate(date2025)).toBe(0.12);
      expect(PPNCalculator.getRatePercentage(date2025)).toBe(12);
    });
  });
});
