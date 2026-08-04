/**
 * SPT 1770 S Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSPT1770S,
  calculateSummary,
  validateSPT1770S,
  checkSPT1770SEligibility,
  formatRupiah,
  formatNumber,
  getPTKPDescription,
} from './calculator';
import type {
  SpouseIncomeData,
} from './types';
import type { TaxpayerData, PTKPStatus, IncomeSource1721A1 } from '../shared/types';

// ============================================================================
// TEST DATA
// ============================================================================

const baseTaxpayer: TaxpayerData = {
  npwp: '12.345.678.9-012.345',
  nik: '1234567890123456',
  name: 'Test Taxpayer',
  address: 'Jl. Test No. 1, Jakarta',
};

const createIncomeSource = (
  grossIncome: number,
  taxWithheld: number,
  employerName = 'PT Test Company'
): IncomeSource1721A1 => {
  const positionCosts = Math.min(grossIncome * 0.05, 6_000_000);
  const pensionContribution = Math.min(grossIncome * 0.02, 2_400_000);
  const netIncome = grossIncome - positionCosts - pensionContribution;

  return {
    employerNpwp: '01.234.567.8-901.234',
    employerName,
    periodStart: '01',
    periodEnd: '12',
    taxYear: 2024,
    grossIncome,
    positionCosts,
    pensionContribution,
    netIncome,
    ptkpAmount: 54_000_000,
    taxableIncome: Math.max(0, netIncome - 54_000_000),
    taxDue: 0,
    taxWithheld,
    buktiPotongNumber: '1.1-12.24-0000001',
    buktiPotongDate: '2024-12-31',
  };
};

// ============================================================================
// BASIC CALCULATION TESTS
// ============================================================================

describe('SPT 1770 S Calculator', () => {
  describe('calculateSPT1770S', () => {
    it('should calculate SPT for single high-income source', () => {
      const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

      const result = calculateSPT1770S({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        employmentIncome,
      });

      expect(result.taxYear).toBe(2024);
      expect(result.taxpayer).toBe(baseTaxpayer);
      expect(result.ptkpStatus).toBe('TK/0');
      expect(result.employmentIncome).toHaveLength(1);
      expect(result.summary.ptkpAmount).toBe(54_000_000);
    });

    it('should calculate SPT for multiple income sources', () => {
      const employmentIncome = [
        createIncomeSource(50_000_000, 2_500_000, 'PT Company A'),
        createIncomeSource(30_000_000, 1_500_000, 'PT Company B'),
      ];

      const result = calculateSPT1770S({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'K/1',
        taxYear: 2024,
        employmentIncome,
      });

      expect(result.employmentIncome).toHaveLength(2);
      expect(result.summary.totalEmploymentGrossIncome).toBe(80_000_000);
      expect(result.summary.ptkpAmount).toBe(63_000_000); // K/1
    });

    it('should include other income in calculation', () => {
      const employmentIncome = [createIncomeSource(60_000_000, 3_000_000)];

      const result = calculateSPT1770S({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        employmentIncome,
        otherIncome: {
          dividends: 5_000_000,
          rental: 10_000_000,
        },
      });

      expect(result.summary.totalOtherIncome).toBe(15_000_000);
      expect(result.summary.totalNetIncome).toBeGreaterThan(
        result.summary.totalEmploymentNetIncome
      );
    });
  });

  describe('calculateSummary', () => {
    it('should aggregate employment income correctly', () => {
      const employmentIncome = [
        createIncomeSource(60_000_000, 3_000_000),
        createIncomeSource(40_000_000, 2_000_000),
      ];

      const summary = calculateSummary({
        employmentIncome,
        otherIncome: {
          interestFromBank: 0,
          dividends: 0,
          rental: 0,
          royalties: 0,
          capitalGains: 0,
          prizes: 0,
          otherIncome: 0,
          totalOtherIncome: 0,
        },
        taxCredits: {
          pph21Withheld: 5_000_000,
          pph22Withheld: 0,
          pph23Withheld: 0,
          pph24ForeignTaxCredit: 0,
          pph25Installments: 0,
          stpPayments: 0,
          totalTaxCredits: 5_000_000,
        },
        ptkpStatus: 'TK/0',
      });

      expect(summary.totalEmploymentGrossIncome).toBe(100_000_000);
      expect(summary.totalTaxCredits).toBe(5_000_000);
    });

    it('should calculate correct PKP', () => {
      const employmentIncome = [createIncomeSource(120_000_000, 6_000_000)];
      const netIncome = employmentIncome[0].netIncome;

      const summary = calculateSummary({
        employmentIncome,
        otherIncome: {
          interestFromBank: 0,
          dividends: 0,
          rental: 0,
          royalties: 0,
          capitalGains: 0,
          prizes: 0,
          otherIncome: 0,
          totalOtherIncome: 0,
        },
        taxCredits: {
          pph21Withheld: 6_000_000,
          pph22Withheld: 0,
          pph23Withheld: 0,
          pph24ForeignTaxCredit: 0,
          pph25Installments: 0,
          stpPayments: 0,
          totalTaxCredits: 6_000_000,
        },
        ptkpStatus: 'TK/0',
      });

      // PKP = Net Income - PTKP
      expect(summary.taxableIncome).toBe(netIncome - 54_000_000);
    });

    it('should calculate correct tax status - NIHIL', () => {
      const employmentIncome = [createIncomeSource(100_000_000, 0)];

      // Calculate expected tax
      const netIncome = employmentIncome[0].netIncome;
      const pkp = Math.max(0, netIncome - 54_000_000);
      // Progressive tax: first 60M at 5%, rest at 15%
      let expectedTax = 0;
      if (pkp > 0) {
        expectedTax = Math.min(pkp, 60_000_000) * 0.05;
        if (pkp > 60_000_000) {
          expectedTax += (pkp - 60_000_000) * 0.15;
        }
      }
      expectedTax = Math.round(expectedTax);

      const summary = calculateSummary({
        employmentIncome,
        otherIncome: {
          interestFromBank: 0,
          dividends: 0,
          rental: 0,
          royalties: 0,
          capitalGains: 0,
          prizes: 0,
          otherIncome: 0,
          totalOtherIncome: 0,
        },
        taxCredits: {
          pph21Withheld: expectedTax, // Exact match
          pph22Withheld: 0,
          pph23Withheld: 0,
          pph24ForeignTaxCredit: 0,
          pph25Installments: 0,
          stpPayments: 0,
          totalTaxCredits: expectedTax,
        },
        ptkpStatus: 'TK/0',
      });

      expect(summary.status).toBe('NIHIL');
      expect(summary.taxPayable).toBe(0);
      expect(summary.taxRefund).toBe(0);
    });

    it('should calculate correct tax status - KURANG_BAYAR', () => {
      const employmentIncome = [createIncomeSource(100_000_000, 0)];

      const summary = calculateSummary({
        employmentIncome,
        otherIncome: {
          interestFromBank: 0,
          dividends: 0,
          rental: 0,
          royalties: 0,
          capitalGains: 0,
          prizes: 0,
          otherIncome: 0,
          totalOtherIncome: 0,
        },
        taxCredits: {
          pph21Withheld: 0, // No withholding
          pph22Withheld: 0,
          pph23Withheld: 0,
          pph24ForeignTaxCredit: 0,
          pph25Installments: 0,
          stpPayments: 0,
          totalTaxCredits: 0,
        },
        ptkpStatus: 'TK/0',
      });

      expect(summary.status).toBe('KURANG_BAYAR');
      expect(summary.taxPayable).toBeGreaterThan(0);
      expect(summary.taxRefund).toBe(0);
    });

    it('should calculate correct tax status - LEBIH_BAYAR', () => {
      const employmentIncome = [createIncomeSource(100_000_000, 0)];

      const summary = calculateSummary({
        employmentIncome,
        otherIncome: {
          interestFromBank: 0,
          dividends: 0,
          rental: 0,
          royalties: 0,
          capitalGains: 0,
          prizes: 0,
          otherIncome: 0,
          totalOtherIncome: 0,
        },
        taxCredits: {
          pph21Withheld: 50_000_000, // More than tax due
          pph22Withheld: 0,
          pph23Withheld: 0,
          pph24ForeignTaxCredit: 0,
          pph25Installments: 0,
          stpPayments: 0,
          totalTaxCredits: 50_000_000,
        },
        ptkpStatus: 'TK/0',
      });

      expect(summary.status).toBe('LEBIH_BAYAR');
      expect(summary.taxPayable).toBe(0);
      expect(summary.taxRefund).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// PTKP TESTS
// ============================================================================

describe('PTKP Status Tests', () => {
  const testPTKPAmount = (status: PTKPStatus, expectedAmount: number) => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

    const result = calculateSPT1770S({
      taxpayer: baseTaxpayer,
      ptkpStatus: status,
      taxYear: 2024,
      employmentIncome,
    });

    expect(result.summary.ptkpAmount).toBe(expectedAmount);
  };

  it('should use correct PTKP for TK/0', () => testPTKPAmount('TK/0', 54_000_000));
  it('should use correct PTKP for TK/3', () => testPTKPAmount('TK/3', 67_500_000));
  it('should use correct PTKP for K/0', () => testPTKPAmount('K/0', 58_500_000));
  it('should use correct PTKP for K/3', () => testPTKPAmount('K/3', 72_000_000));
  it('should use correct PTKP for K/I/0', () => testPTKPAmount('K/I/0', 112_500_000));
  it('should use correct PTKP for K/I/3', () => testPTKPAmount('K/I/3', 126_000_000));
});

// ============================================================================
// SPOUSE INCOME TESTS
// ============================================================================

describe('Spouse Income (K/I Status)', () => {
  it('should include spouse income when isJointFiling is true', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];
    const spouseIncome: SpouseIncomeData = {
      spouseName: 'Test Spouse',
      grossIncome: 50_000_000,
      netIncome: 45_000_000,
      taxWithheld: 2_000_000,
      isJointFiling: true,
    };

    const result = calculateSPT1770S({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'K/I/0',
      taxYear: 2024,
      employmentIncome,
      spouseIncome,
    });

    expect(result.summary.spouseNetIncome).toBe(45_000_000);
    expect(result.summary.totalNetIncome).toBe(
      result.summary.totalEmploymentNetIncome + 45_000_000
    );
  });

  it('should not include spouse income when isJointFiling is false', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];
    const spouseIncome: SpouseIncomeData = {
      spouseName: 'Test Spouse',
      grossIncome: 50_000_000,
      netIncome: 45_000_000,
      taxWithheld: 2_000_000,
      isJointFiling: false,
    };

    const result = calculateSPT1770S({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'K/0',
      taxYear: 2024,
      employmentIncome,
      spouseIncome,
    });

    expect(result.summary.spouseNetIncome).toBe(0);
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateSPT1770S', () => {
  it('should validate valid SPT data', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

    const sptData = calculateSPT1770S({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      employmentIncome,
    });

    const validation = validateSPT1770S(sptData);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should report error for missing NPWP', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

    const sptData = calculateSPT1770S({
      taxpayer: { ...baseTaxpayer, npwp: '' },
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      employmentIncome,
    });

    const validation = validateSPT1770S(sptData);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('NPWP wajib pajak tidak boleh kosong');
  });

  it('should report error for invalid NPWP format', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

    const sptData = calculateSPT1770S({
      taxpayer: { ...baseTaxpayer, npwp: '123456789' },
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      employmentIncome,
    });

    const validation = validateSPT1770S(sptData);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Format NPWP tidak valid');
  });

  it('should warn for K/I status without spouse income', () => {
    const employmentIncome = [createIncomeSource(100_000_000, 5_000_000)];

    const sptData = calculateSPT1770S({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'K/I/0',
      taxYear: 2024,
      employmentIncome,
      // No spouse income provided
    });

    const validation = validateSPT1770S(sptData);

    expect(validation.warnings).toContain(
      'Status K/I dipilih tapi data penghasilan istri tidak diisi'
    );
  });
});

// ============================================================================
// ELIGIBILITY TESTS
// ============================================================================

describe('checkSPT1770SEligibility', () => {
  it('should suggest 1770 SS for single source low income', () => {
    const employmentIncome = [createIncomeSource(50_000_000, 2_000_000)];

    const result = checkSPT1770SEligibility({ employmentIncome });

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.suggestedForm).toBe('1770SS');
    }
  });

  it('should be eligible for multiple income sources', () => {
    const employmentIncome = [
      createIncomeSource(30_000_000, 1_500_000),
      createIncomeSource(25_000_000, 1_200_000),
    ];

    const result = checkSPT1770SEligibility({ employmentIncome });

    expect(result.eligible).toBe(true);
  });

  it('should be eligible for single source high income', () => {
    const employmentIncome = [createIncomeSource(80_000_000, 4_000_000)];

    const result = checkSPT1770SEligibility({ employmentIncome });

    expect(result.eligible).toBe(true);
  });

  it('should suggest 1770 for business income', () => {
    const employmentIncome = [createIncomeSource(50_000_000, 2_000_000)];

    const result = checkSPT1770SEligibility({
      employmentIncome,
      hasBusinessIncome: true,
    });

    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.suggestedForm).toBe('1770');
    }
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  describe('formatRupiah', () => {
    it('should format positive numbers', () => {
      expect(formatRupiah(1_000_000)).toMatch(/Rp.*1[\.,]000[\.,]000/);
    });

    it('should format zero', () => {
      expect(formatRupiah(0)).toMatch(/Rp.*0/);
    });
  });

  describe('formatNumber', () => {
    it('should format with thousand separators', () => {
      const formatted = formatNumber(1_234_567);
      expect(formatted).toMatch(/1[\.,]234[\.,]567/);
    });
  });

  describe('getPTKPDescription', () => {
    it('should return correct description for TK/0', () => {
      expect(getPTKPDescription('TK/0')).toBe('Tidak Kawin / Tanpa Tanggungan');
    });

    it('should return correct description for K/I/3', () => {
      expect(getPTKPDescription('K/I/3')).toBe(
        'Kawin + Penghasilan Istri Digabung / 3 Tanggungan'
      );
    });
  });
});
