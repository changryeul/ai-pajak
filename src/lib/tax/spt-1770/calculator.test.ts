/**
 * SPT 1770 Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSPT1770,
  validateSPT1770,
  calculateBusinessIncome,
  calculatePembukuanIncome,
  calculateNormaIncome,
  calculateAssetDepreciation,
  calculateMultipleAssetsDepreciation,
  getDepreciationCategory,
  getNormaPercentage,
  isUMKMEligible,
  isBookkeepingRequired,
  formatRupiah,
} from './index';
import type { TaxpayerData } from '../shared/types';
import type { BusinessIncomeInput, DepreciationAssetInput } from './index';

// ============================================================================
// TEST DATA
// ============================================================================

const baseTaxpayer: TaxpayerData = {
  npwp: '12.345.678.9-012.345',
  nik: '1234567890123456',
  name: 'Test Business Owner',
  address: 'Jl. Usaha No. 1, Jakarta',
};

const createBusinessInput = (
  grossRevenue: number,
  method: 'PEMBUKUAN' | 'NORMA' = 'NORMA'
): BusinessIncomeInput => ({
  businessId: 'BIZ-001',
  businessName: 'Toko Test',
  businessType: 'TRADING',
  kluCode: '47100',
  bookkeepingMethod: method,
  grossRevenue,
  returnsAndAllowances: 0,
});

// ============================================================================
// BUSINESS INCOME CALCULATOR TESTS
// ============================================================================

describe('Business Income Calculator', () => {
  describe('calculateNormaIncome', () => {
    it('should calculate using Norma percentage', () => {
      const input = createBusinessInput(100_000_000, 'NORMA');

      const result = calculateNormaIncome(input);

      // KLU 47100 (retail) has 20% norma
      expect(result.bookkeepingMethod).toBe('NORMA');
      expect(result.normaPercentage).toBe(0.20);
      expect(result.netBusinessIncome).toBe(20_000_000);
    });

    it('should throw error for revenue >= 4.8B', () => {
      const input = createBusinessInput(5_000_000_000, 'NORMA');

      expect(() => calculateNormaIncome(input)).toThrow(
        /Norma method not allowed/
      );
    });

    it('should use custom norma percentage if provided', () => {
      const input: BusinessIncomeInput = {
        ...createBusinessInput(100_000_000, 'NORMA'),
        customNormaPercentage: 0.30,
      };

      const result = calculateNormaIncome(input);

      expect(result.normaPercentage).toBe(0.30);
      expect(result.netBusinessIncome).toBe(30_000_000);
    });
  });

  describe('calculatePembukuanIncome', () => {
    it('should calculate with COGS for trading business', () => {
      const input: BusinessIncomeInput = {
        businessId: 'BIZ-001',
        businessName: 'Toko Test',
        businessType: 'TRADING',
        kluCode: '47100',
        bookkeepingMethod: 'PEMBUKUAN',
        grossRevenue: 500_000_000,
        cogs: {
          beginningInventory: 50_000_000,
          purchases: 300_000_000,
          freightIn: 5_000_000,
          purchaseReturns: 10_000_000,
          endingInventory: 45_000_000,
        },
        operatingExpenses: {
          salaries: 60_000_000,
          rent: 24_000_000,
          utilities: 12_000_000,
        },
      };

      const result = calculatePembukuanIncome(input, 2024);

      expect(result.bookkeepingMethod).toBe('PEMBUKUAN');
      expect(result.cogs).toBeDefined();
      expect(result.cogs!.costOfGoodsSold).toBe(300_000_000); // 50M + (300M+5M-10M) - 45M
      expect(result.grossProfit).toBe(200_000_000); // 500M - 300M COGS
      expect(result.operatingExpenses!.totalExpenses).toBe(96_000_000);
    });

    it('should include depreciation', () => {
      const input: BusinessIncomeInput = {
        businessId: 'BIZ-001',
        businessName: 'Jasa Test',
        businessType: 'SERVICES',
        kluCode: '69200',
        bookkeepingMethod: 'PEMBUKUAN',
        grossRevenue: 200_000_000,
        operatingExpenses: {
          salaries: 50_000_000,
        },
        assets: [
          {
            assetId: 'ASSET-001',
            assetName: 'Komputer',
            assetCategory: 'GROUP_1',
            acquisitionDate: '2024-01-01',
            acquisitionCost: 20_000_000,
          },
        ],
      };

      const result = calculatePembukuanIncome(input, 2024);

      expect(result.depreciation).toHaveLength(1);
      expect(result.totalDepreciation).toBe(5_000_000); // 25% of 20M
    });
  });

  describe('calculateBusinessIncome', () => {
    it('should auto-select correct method', () => {
      const normaInput = createBusinessInput(100_000_000, 'NORMA');
      const pembukuanInput = createBusinessInput(100_000_000, 'PEMBUKUAN');

      const normaResult = calculateBusinessIncome(normaInput, 2024);
      const pembukuanResult = calculateBusinessIncome(pembukuanInput, 2024);

      expect(normaResult.bookkeepingMethod).toBe('NORMA');
      expect(pembukuanResult.bookkeepingMethod).toBe('PEMBUKUAN');
    });
  });
});

// ============================================================================
// DEPRECIATION CALCULATOR TESTS
// ============================================================================

describe('Depreciation Calculator', () => {
  describe('calculateAssetDepreciation', () => {
    it('should calculate straight-line depreciation', () => {
      const asset: DepreciationAssetInput = {
        assetId: 'ASSET-001',
        assetName: 'Komputer',
        assetCategory: 'GROUP_1',
        acquisitionDate: '2024-01-01',
        acquisitionCost: 10_000_000,
        depreciationMethod: 'STRAIGHT_LINE',
      };

      const result = calculateAssetDepreciation(asset, 2024);

      expect(result.usefulLife).toBe(4);
      expect(result.annualDepreciationRate).toBe(0.25);
      expect(result.currentYearDepreciation).toBe(2_500_000);
      expect(result.bookValue).toBe(7_500_000);
    });

    it('should calculate declining balance depreciation', () => {
      const asset: DepreciationAssetInput = {
        assetId: 'ASSET-001',
        assetName: 'Kendaraan',
        assetCategory: 'GROUP_2',
        acquisitionDate: '2024-01-01',
        acquisitionCost: 100_000_000,
        depreciationMethod: 'DECLINING_BALANCE',
      };

      const result = calculateAssetDepreciation(asset, 2024);

      expect(result.usefulLife).toBe(8);
      expect(result.annualDepreciationRate).toBe(0.25);
      expect(result.currentYearDepreciation).toBe(25_000_000); // 25% of 100M
      expect(result.bookValue).toBe(75_000_000);
    });

    it('should prorate first year depreciation', () => {
      const asset: DepreciationAssetInput = {
        assetId: 'ASSET-001',
        assetName: 'Komputer',
        assetCategory: 'GROUP_1',
        acquisitionDate: '2024-07-01', // July = month 7
        acquisitionCost: 10_000_000,
        depreciationMethod: 'STRAIGHT_LINE',
      };

      const result = calculateAssetDepreciation(asset, 2024);

      // 6 months of 12 = 50% of annual depreciation
      expect(result.currentYearDepreciation).toBe(1_250_000); // 2.5M * 6/12
    });

    it('should handle prior year depreciation', () => {
      const asset: DepreciationAssetInput = {
        assetId: 'ASSET-001',
        assetName: 'Komputer',
        assetCategory: 'GROUP_1',
        acquisitionDate: '2023-01-01',
        acquisitionCost: 10_000_000,
        depreciationMethod: 'STRAIGHT_LINE',
      };

      const result = calculateAssetDepreciation(asset, 2025);

      // Prior: 2023 (2.5M) + 2024 (2.5M) = 5M
      // Current: 2025 (2.5M)
      expect(result.priorDepreciation).toBe(5_000_000);
      expect(result.currentYearDepreciation).toBe(2_500_000);
      expect(result.accumulatedDepreciation).toBe(7_500_000);
      expect(result.bookValue).toBe(2_500_000);
    });
  });

  describe('calculateMultipleAssetsDepreciation', () => {
    it('should calculate total depreciation', () => {
      const assets: DepreciationAssetInput[] = [
        {
          assetId: 'A1',
          assetName: 'Komputer',
          assetCategory: 'GROUP_1',
          acquisitionDate: '2024-01-01',
          acquisitionCost: 10_000_000,
        },
        {
          assetId: 'A2',
          assetName: 'Furniture',
          assetCategory: 'GROUP_2',
          acquisitionDate: '2024-01-01',
          acquisitionCost: 20_000_000,
        },
      ];

      const result = calculateMultipleAssetsDepreciation(assets, 2024);

      expect(result.items).toHaveLength(2);
      // 10M * 25% + 20M * 12.5% = 2.5M + 2.5M = 5M
      expect(result.totalCurrentYearDepreciation).toBe(5_000_000);
    });
  });

  describe('getDepreciationCategory', () => {
    it('should categorize assets correctly', () => {
      expect(getDepreciationCategory('komputer')).toBe('GROUP_1');
      expect(getDepreciationCategory('kendaraan')).toBe('GROUP_2');
      expect(getDepreciationCategory('mesin')).toBe('GROUP_3');
      expect(getDepreciationCategory('bangunan permanen')).toBe('BUILDING_PERMANENT');
    });
  });
});

// ============================================================================
// MAIN CALCULATOR TESTS
// ============================================================================

describe('SPT 1770 Calculator', () => {
  describe('calculateSPT1770', () => {
    it('should calculate SPT for business income only', () => {
      const result = calculateSPT1770({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        businessIncome: [createBusinessInput(200_000_000, 'NORMA')],
        assets: [],
        liabilities: [],
      });

      expect(result.taxYear).toBe(2024);
      expect(result.businessIncome).toHaveLength(1);
      // Norma 20% = 40M net income
      expect(result.summary.totalNetBusinessIncome).toBe(40_000_000);
    });

    it('should combine business and employment income', () => {
      const result = calculateSPT1770({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'K/1',
        taxYear: 2024,
        businessIncome: [createBusinessInput(100_000_000, 'NORMA')],
        employmentIncome: [
          {
            employerNpwp: '01.234.567.8-901.234',
            employerName: 'PT Employer',
            periodStart: '01',
            periodEnd: '12',
            taxYear: 2024,
            grossIncome: 100_000_000,
            positionCosts: 5_000_000,
            pensionContribution: 2_000_000,
            netIncome: 93_000_000,
            ptkpAmount: 63_000_000,
            taxableIncome: 30_000_000,
            taxDue: 1_500_000,
            taxWithheld: 1_500_000,
          },
        ],
        assets: [],
        liabilities: [],
      });

      // Business: 100M * 20% = 20M
      // Employment: 93M net
      expect(result.summary.totalNetBusinessIncome).toBe(20_000_000);
      expect(result.summary.totalEmploymentIncome).toBe(93_000_000);
      expect(result.summary.grossTotalIncome).toBe(113_000_000);
    });

    it('should apply loss carryforward', () => {
      const result = calculateSPT1770({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        businessIncome: [createBusinessInput(500_000_000, 'NORMA')],
        lossCarryforward: [
          {
            taxYear: 2022,
            originalLoss: 50_000_000,
            previouslyUsed: 0,
            usedThisYear: 0,
            remaining: 50_000_000,
            expiryYear: 2027,
            isExpired: false,
          },
        ],
        assets: [],
        liabilities: [],
      });

      // Gross: 500M * 20% = 100M
      // Loss: 50M
      // Net: 50M
      expect(result.summary.lossCarryforwardUsed).toBe(50_000_000);
      expect(result.summary.totalNetIncome).toBe(50_000_000);
    });

    it('should calculate correct tax with PTKP', () => {
      const result = calculateSPT1770({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'K/3',
        taxYear: 2024,
        businessIncome: [createBusinessInput(600_000_000, 'NORMA')],
        assets: [],
        liabilities: [],
      });

      // Net business income: 600M * 20% = 120M
      // PTKP K/3: 72M
      // PKP: 48M
      // Tax: 48M * 5% = 2.4M (all in first bracket)
      expect(result.summary.ptkpAmount).toBe(72_000_000);
      expect(result.summary.taxableIncome).toBe(48_000_000);
      expect(result.summary.taxDue).toBe(2_400_000);
    });
  });

  describe('Tax credits', () => {
    it('should apply PPh 21 from employment', () => {
      const result = calculateSPT1770({
        taxpayer: baseTaxpayer,
        ptkpStatus: 'TK/0',
        taxYear: 2024,
        businessIncome: [createBusinessInput(300_000_000, 'NORMA')],
        employmentIncome: [
          {
            employerNpwp: '01.234.567.8-901.234',
            employerName: 'PT Employer',
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
            taxWithheld: 2_000_000,
          },
        ],
        assets: [],
        liabilities: [],
      });

      expect(result.taxCredits.pph21Withheld).toBe(2_000_000);
    });
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateSPT1770', () => {
  it('should validate correct SPT data', () => {
    const sptData = calculateSPT1770({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      businessIncome: [createBusinessInput(100_000_000, 'NORMA')],
      assets: [
        {
          id: 'A1',
          assetType: 'CASH',
          description: 'Tabungan',
          acquisitionYear: 2020,
          acquisitionValue: 50_000_000,
          currentValue: 60_000_000,
        },
      ],
      liabilities: [],
    });

    const validation = validateSPT1770(sptData);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should report error for missing NPWP', () => {
    const sptData = calculateSPT1770({
      taxpayer: { ...baseTaxpayer, npwp: '' },
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      businessIncome: [createBusinessInput(100_000_000, 'NORMA')],
      assets: [],
      liabilities: [],
    });

    const validation = validateSPT1770(sptData);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('NPWP wajib pajak tidak boleh kosong');
  });

  it('should warn for missing assets', () => {
    const sptData = calculateSPT1770({
      taxpayer: baseTaxpayer,
      ptkpStatus: 'TK/0',
      taxYear: 2024,
      businessIncome: [createBusinessInput(100_000_000, 'NORMA')],
      assets: [],
      liabilities: [],
    });

    const validation = validateSPT1770(sptData);

    expect(validation.warnings).toContain(
      'Daftar harta kosong. SPT 1770 memerlukan pelaporan harta.'
    );
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  describe('getNormaPercentage', () => {
    it('should return correct percentage for known KLU', () => {
      expect(getNormaPercentage('47100')).toBe(0.20); // Retail
      expect(getNormaPercentage('69200')).toBe(0.50); // Accounting
      expect(getNormaPercentage('86102')).toBe(0.50); // Medical
    });

    it('should return default for unknown KLU', () => {
      expect(getNormaPercentage('99999')).toBe(0.25);
    });
  });

  describe('isUMKMEligible', () => {
    it('should return true for revenue < 4.8B', () => {
      expect(isUMKMEligible(1_000_000_000)).toBe(true);
      expect(isUMKMEligible(4_799_999_999)).toBe(true);
    });

    it('should return false for revenue >= 4.8B', () => {
      expect(isUMKMEligible(4_800_000_000)).toBe(false);
      expect(isUMKMEligible(10_000_000_000)).toBe(false);
    });
  });

  describe('isBookkeepingRequired', () => {
    it('should return false for revenue < 4.8B', () => {
      expect(isBookkeepingRequired(4_000_000_000)).toBe(false);
    });

    it('should return true for revenue >= 4.8B', () => {
      expect(isBookkeepingRequired(4_800_000_000)).toBe(true);
      expect(isBookkeepingRequired(10_000_000_000)).toBe(true);
    });
  });

  describe('formatRupiah', () => {
    it('should format currency correctly', () => {
      expect(formatRupiah(1_000_000)).toMatch(/Rp.*1[\.,]000[\.,]000/);
    });
  });
});
