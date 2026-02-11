/**
 * SPT 1770 SS Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateProgressiveTax,
  calculateSummary,
  calculateSPT1770SS,
  validateSPT1770SS,
} from '@/lib/tax/spt-1770ss/calculator';
import {
  IncomeSource1721A1,
  TaxpayerData,
  PTKPStatus,
  PTKP_RATES,
} from '@/lib/tax/spt-1770ss/types';

describe('SPT 1770 SS Calculator', () => {
  describe('calculateProgressiveTax', () => {
    it('should return 0 for zero or negative income', () => {
      expect(calculateProgressiveTax(0)).toBe(0);
      expect(calculateProgressiveTax(-1000000)).toBe(0);
    });

    it('should calculate 5% tax for income up to 60M', () => {
      // 50M * 5% = 2.5M
      expect(calculateProgressiveTax(50_000_000)).toBe(2_500_000);
      // 60M * 5% = 3M
      expect(calculateProgressiveTax(60_000_000)).toBe(3_000_000);
    });

    it('should calculate correct tax for income in second bracket (60M-250M)', () => {
      // 100M = 60M * 5% + 40M * 15% = 3M + 6M = 9M
      expect(calculateProgressiveTax(100_000_000)).toBe(9_000_000);
      // 250M = 60M * 5% + 190M * 15% = 3M + 28.5M = 31.5M
      expect(calculateProgressiveTax(250_000_000)).toBe(31_500_000);
    });

    it('should calculate correct tax for income in third bracket (250M-500M)', () => {
      // 400M = 3M + 28.5M + 150M * 25% = 3M + 28.5M + 37.5M = 69M
      expect(calculateProgressiveTax(400_000_000)).toBe(69_000_000);
    });

    it('should calculate correct tax for income in fourth bracket (500M-5B)', () => {
      // 1B = 3M + 28.5M + 62.5M + 500M * 30% = 94M + 150M = 244M
      expect(calculateProgressiveTax(1_000_000_000)).toBe(244_000_000);
    });

    it('should calculate correct tax for income above 5B', () => {
      // 6B = 3M + 28.5M + 62.5M + 1.35B + 1B * 35%
      // = 94M + 1350M + 350M = 1794M
      expect(calculateProgressiveTax(6_000_000_000)).toBe(1_794_000_000);
    });
  });

  describe('calculateSummary', () => {
    const mockIncomeSource: IncomeSource1721A1 = {
      employerNpwp: '12.345.678.9-012.345',
      employerName: 'PT Test Company',
      periodStart: '01',
      periodEnd: '12',
      taxYear: 2024,
      grossIncome: 120_000_000,
      positionCosts: 6_000_000, // 5% capped at 6M
      pensionContribution: 2_400_000, // 2%
      netIncome: 111_600_000,
      ptkpAmount: 54_000_000,
      taxableIncome: 57_600_000,
      taxDue: 2_880_000, // 57.6M * 5%
      taxWithheld: 2_880_000,
    };

    it('should calculate NIHIL status when tax due equals tax withheld', () => {
      const summary = calculateSummary([mockIncomeSource], 'TK/0');

      expect(summary.totalGrossIncome).toBe(120_000_000);
      expect(summary.totalDeductions).toBe(8_400_000); // 6M + 2.4M
      expect(summary.totalNetIncome).toBe(111_600_000);
      expect(summary.ptkpAmount).toBe(PTKP_RATES['TK/0']); // 54M
      expect(summary.taxableIncome).toBe(57_600_000);
      expect(summary.status).toBe('NIHIL');
      expect(summary.taxPayable).toBe(0);
      expect(summary.taxRefund).toBe(0);
    });

    it('should calculate KURANG_BAYAR status when tax due > tax withheld', () => {
      const incomeWithUnderpayment: IncomeSource1721A1 = {
        ...mockIncomeSource,
        taxWithheld: 2_000_000, // Less than taxDue
      };

      const summary = calculateSummary([incomeWithUnderpayment], 'TK/0');

      expect(summary.status).toBe('KURANG_BAYAR');
      expect(summary.taxPayable).toBeGreaterThan(0);
      expect(summary.taxRefund).toBe(0);
    });

    it('should calculate LEBIH_BAYAR status when tax withheld > tax due', () => {
      const incomeWithOverpayment: IncomeSource1721A1 = {
        ...mockIncomeSource,
        taxWithheld: 5_000_000, // More than taxDue
      };

      const summary = calculateSummary([incomeWithOverpayment], 'TK/0');

      expect(summary.status).toBe('LEBIH_BAYAR');
      expect(summary.taxPayable).toBe(0);
      expect(summary.taxRefund).toBeGreaterThan(0);
    });

    it('should aggregate multiple income sources correctly', () => {
      const source1: IncomeSource1721A1 = {
        ...mockIncomeSource,
        grossIncome: 60_000_000,
        netIncome: 55_000_000,
        taxWithheld: 1_500_000,
      };

      const source2: IncomeSource1721A1 = {
        ...mockIncomeSource,
        employerName: 'PT Second Company',
        grossIncome: 40_000_000,
        netIncome: 37_000_000,
        taxWithheld: 1_000_000,
      };

      const summary = calculateSummary([source1, source2], 'TK/0');

      expect(summary.totalGrossIncome).toBe(100_000_000);
      expect(summary.totalNetIncome).toBe(92_000_000);
      expect(summary.totalTaxWithheld).toBe(2_500_000);
    });

    it('should use correct PTKP based on status', () => {
      const summaryTK0 = calculateSummary([mockIncomeSource], 'TK/0');
      const summaryK3 = calculateSummary([mockIncomeSource], 'K/3');
      const summaryKI3 = calculateSummary([mockIncomeSource], 'K/I/3');

      expect(summaryTK0.ptkpAmount).toBe(54_000_000);
      expect(summaryK3.ptkpAmount).toBe(72_000_000);
      expect(summaryKI3.ptkpAmount).toBe(126_000_000);

      // Higher PTKP = lower taxable income
      expect(summaryK3.taxableIncome).toBeLessThan(summaryTK0.taxableIncome);
      expect(summaryKI3.taxableIncome).toBeLessThan(summaryK3.taxableIncome);
    });
  });

  describe('calculateSPT1770SS', () => {
    const mockTaxpayer: TaxpayerData = {
      npwp: '12.345.678.9-012.345',
      nik: '1234567890123456',
      name: 'John Doe',
      address: 'Jl. Test No. 123, Jakarta',
      phone: '081234567890',
      email: 'john@example.com',
      occupation: 'Karyawan',
    };

    const mockIncomeSource: IncomeSource1721A1 = {
      employerNpwp: '98.765.432.1-098.765',
      employerName: 'PT Employer',
      periodStart: '01',
      periodEnd: '12',
      taxYear: 2024,
      grossIncome: 150_000_000,
      positionCosts: 6_000_000,
      pensionContribution: 3_000_000,
      netIncome: 141_000_000,
      ptkpAmount: 54_000_000,
      taxableIncome: 87_000_000,
      taxDue: 7_050_000,
      taxWithheld: 7_050_000,
    };

    it('should create complete SPT data structure', () => {
      const spt = calculateSPT1770SS({
        taxpayer: mockTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        incomeSources: [mockIncomeSource],
      });

      expect(spt.taxYear).toBe(2024);
      expect(spt.correctionNumber).toBe(0);
      expect(spt.taxpayer.name).toBe('John Doe');
      expect(spt.ptkpStatus).toBe('TK/0');
      expect(spt.incomeSources.length).toBe(1);
      expect(spt.summary).toBeDefined();
      expect(spt.submissionDate).toBeInstanceOf(Date);
    });

    it('should handle correction number', () => {
      const spt = calculateSPT1770SS({
        taxpayer: mockTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        incomeSources: [mockIncomeSource],
        correctionNumber: 2,
      });

      expect(spt.correctionNumber).toBe(2);
    });
  });

  describe('validateSPT1770SS', () => {
    const validSPT = calculateSPT1770SS({
      taxpayer: {
        npwp: '12.345.678.9-012.345',
        nik: '1234567890123456',
        name: 'John Doe',
        address: 'Jakarta',
      },
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      incomeSources: [
        {
          employerNpwp: '98.765.432.1-098.765',
          employerName: 'PT Test',
          periodStart: '01',
          periodEnd: '12',
          taxYear: 2024,
          grossIncome: 100_000_000,
          positionCosts: 5_000_000,
          pensionContribution: 2_000_000,
          netIncome: 93_000_000,
          ptkpAmount: 54_000_000,
          taxableIncome: 39_000_000,
          taxDue: 1_950_000,
          taxWithheld: 1_950_000,
        },
      ],
    });

    it('should validate valid SPT data', () => {
      const result = validateSPT1770SS(validSPT);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject SPT without NPWP', () => {
      const invalidSPT = {
        ...validSPT,
        taxpayer: { ...validSPT.taxpayer, npwp: '' },
      };

      const result = validateSPT1770SS(invalidSPT);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NPWP wajib pajak tidak boleh kosong');
    });

    it('should reject SPT with invalid NPWP format', () => {
      const invalidSPT = {
        ...validSPT,
        taxpayer: { ...validSPT.taxpayer, npwp: '12345678901234' },
      };

      const result = validateSPT1770SS(invalidSPT);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Format NPWP tidak valid');
    });

    it('should reject SPT without income sources', () => {
      const invalidSPT = {
        ...validSPT,
        incomeSources: [],
        summary: {
          ...validSPT.summary,
          totalGrossIncome: 0,
          totalNetIncome: 0,
        },
      };

      const result = validateSPT1770SS(invalidSPT);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimal harus ada satu sumber penghasilan');
    });

    it('should warn about future tax year', () => {
      const futureSPT = {
        ...validSPT,
        taxYear: new Date().getFullYear() + 1,
      };

      const result = validateSPT1770SS(futureSPT);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tahun pajak tidak boleh lebih dari tahun berjalan');
    });

    it('should warn about old tax year', () => {
      const oldSPT = {
        ...validSPT,
        taxYear: 2019,
      };

      const result = validateSPT1770SS(oldSPT);

      expect(result.warnings).toContain('Tahun pajak terlalu lama, pastikan data sudah benar');
    });
  });
});
